import { Server as SocketIOServer, Socket } from 'socket.io';
import { AppState, FieldLock } from './types';
import { updateFieldValue, getCaseWithFields } from './database';
import { addActiveEditor, removeActiveEditor, getActiveEditors } from './routes/cases';

const LOCK_TIMEOUT = 7000; // 7 seconds - must be longer than debounce (500ms) + save delay (5000ms)
const FIELD_LOCK_KEY = (caseId: string, fieldId: string) => `${caseId}:${fieldId}`;

export function initializeSocketHandlers(io: SocketIOServer, appState: AppState) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    let currentUser: { userId: string; username: string } | null = null;
    let currentCaseId: string | null = null;

    // User connects to the app
    socket.on('user-connect', async (data: { userId: string; username: string; caseId?: string }) => {
      console.log('🔌 user-connect received:', data);
      currentUser = { userId: data.userId, username: data.username };
      console.log('✓ currentUser set to:', currentUser.username);
      if (data.caseId) {
        currentCaseId = data.caseId;
        console.log('✓ currentCaseId set to:', data.caseId);
        addActiveEditor(data.caseId, data.username);

        // Notify others
        io.emit('user-joined', {
          userId: data.userId,
          username: data.username,
        });

        // Send state sync to this client
        await sendStateSync(socket, appState, data.caseId);

        // Broadcast active editors update
        io.emit('active-editors-update', {
          caseId: data.caseId,
          activeEditors: getActiveEditors(data.caseId),
        });
      }
    });

    // User navigates to a case
    socket.on('case-open', async (data: { caseId: string }) => {
      console.log('📂 case-open received:', data);
      if (currentUser) {
        console.log('✓ case-open from user:', currentUser.username);
        // Remove from previous case
        if (currentCaseId) {
          removeActiveEditor(currentCaseId, currentUser.username);
          io.emit('active-editors-update', {
            caseId: currentCaseId,
            activeEditors: getActiveEditors(currentCaseId),
          });
        }

        currentCaseId = data.caseId;
        addActiveEditor(data.caseId, currentUser.username);

        // Send state sync
        await sendStateSync(socket, appState, data.caseId);

        // Broadcast active editors update
        io.emit('active-editors-update', {
          caseId: data.caseId,
          activeEditors: getActiveEditors(data.caseId),
        });
      }
    });

    // User focuses on a field
    socket.on('focus-field', (data: { caseId: string; fieldId: string }) => {
      console.log('👁️ focus-field received:', data, 'from user:', currentUser?.username || 'UNKNOWN');
      if (currentUser) {
        appState.userPresence.set(currentUser.userId, {
          userId: currentUser.userId,
          username: currentUser.username,
          focusedFieldId: data.fieldId,
        });

        io.emit('user-focus', {
          userId: currentUser.userId,
          username: currentUser.username,
          caseId: data.caseId,
          fieldId: data.fieldId,
        });
      }
    });

    // User blurs from a field
    socket.on('blur-field', (data: { caseId: string; fieldId: string }) => {
      if (currentUser) {
        const presence = appState.userPresence.get(currentUser.userId);
        if (presence) {
          presence.focusedFieldId = null;
        }

        io.emit('user-blur', {
          userId: currentUser.userId,
          caseId: data.caseId,
          fieldId: data.fieldId,
        });
      }
    });

    // User requests lock on field
    socket.on('request-lock', async (data: { caseId: string; fieldId: string }) => {
      console.log('🔒 request-lock received:', data, 'from user:', currentUser?.username || 'UNKNOWN');
      if (!currentUser) {
        console.log('⚠️ request-lock: currentUser is null, returning');
        return;
      }

      const lockKey = FIELD_LOCK_KEY(data.caseId, data.fieldId);
      const existingLock = appState.fieldLocks.get(lockKey);

      // If field is locked by another user, deny
      if (existingLock && existingLock.userId !== currentUser.userId) {
        socket.emit('lock-denied', {
          caseId: data.caseId,
          fieldId: data.fieldId,
          lockedBy: existingLock.username,
        });
        return;
      }

      // If already locked by this user, just extend the timeout
      if (existingLock && existingLock.userId === currentUser.userId) {
        clearTimeout(existingLock.timeout);
      }

      // Create or refresh lock
      const timeout = setTimeout(() => {
        appState.fieldLocks.delete(lockKey);
        io.emit('field-unlocked', {
          caseId: data.caseId,
          fieldId: data.fieldId,
        });
      }, LOCK_TIMEOUT);

      appState.fieldLocks.set(lockKey, {
        userId: currentUser.userId,
        username: currentUser.username,
        lockedAt: Date.now(),
        timeout,
      });

      // Broadcast lock to all clients
      io.emit('field-locked', {
        caseId: data.caseId,
        fieldId: data.fieldId,
        userId: currentUser.userId,
        username: currentUser.username,
      });
    });

    // User releases lock (manual)
    socket.on('release-lock', (data: { caseId: string; fieldId: string }) => {
      if (!currentUser) return;

      const lockKey = FIELD_LOCK_KEY(data.caseId, data.fieldId);
      const lock = appState.fieldLocks.get(lockKey);

      if (lock && lock.userId === currentUser.userId) {
        clearTimeout(lock.timeout);
        appState.fieldLocks.delete(lockKey);

        io.emit('field-unlocked', {
          caseId: data.caseId,
          fieldId: data.fieldId,
        });
      }
    });

    // User commits field value
    socket.on('commit-field', async (data: { caseId: string; fieldId: string; value: any }) => {
      console.log('commit-field event received, currentUser:', currentUser ? currentUser.username : 'null');
      if (!currentUser) {
        console.log('WARNING: currentUser is null, returning early');
        return;
      }

      try {
        console.log('commit-field received from', currentUser.username, 'with data:', data);

        // Save to database
        console.log('About to save field value to database...');
        const result = await updateFieldValue(data.fieldId, String(data.value), currentUser.userId);
        console.log('updateFieldValue result:', result);

        // Release lock
        const lockKey = FIELD_LOCK_KEY(data.caseId, data.fieldId);
        const lock = appState.fieldLocks.get(lockKey);
        if (lock && lock.userId === currentUser.userId) {
          clearTimeout(lock.timeout);
          appState.fieldLocks.delete(lockKey);
        }

        // Broadcast update to all clients
        console.log('Broadcasting field-updated to all clients');
        io.emit('field-updated', {
          caseId: data.caseId,
          fieldId: data.fieldId,
          value: data.value,
          userId: currentUser.userId,
        });

        // Broadcast unlock
        console.log('Broadcasting field-unlocked');
        io.emit('field-unlocked', {
          caseId: data.caseId,
          fieldId: data.fieldId,
        });
      } catch (error) {
        console.error('Error committing field:', error);
        socket.emit('error', { message: 'Failed to save field' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      if (currentUser) {
        // Remove from active editors
        if (currentCaseId) {
          removeActiveEditor(currentCaseId, currentUser.username);
          io.emit('active-editors-update', {
            caseId: currentCaseId,
            activeEditors: getActiveEditors(currentCaseId),
          });
        }

        // Release all locks held by this user
        for (const [lockKey, lock] of appState.fieldLocks.entries()) {
          if (lock.userId === currentUser.userId) {
            clearTimeout(lock.timeout);
            appState.fieldLocks.delete(lockKey);

            const [caseId, fieldId] = lockKey.split(':');
            io.emit('field-unlocked', { caseId, fieldId });
          }
        }

        // Remove from presence
        appState.userPresence.delete(currentUser.userId);

        // Notify others
        io.emit('user-left', {
          userId: currentUser.userId,
          username: currentUser.username,
        });
      }
    });
  });
}

async function sendStateSync(socket: Socket, appState: AppState, caseId: string) {
  try {
    // Get current case data
    const caseData = await getCaseWithFields(caseId);

    // Build locks map
    const locks: Record<string, { userId: string; username: string }> = {};
    for (const [lockKey, lock] of appState.fieldLocks.entries()) {
      if (lockKey.startsWith(`${caseId}:`)) {
        const fieldId = lockKey.split(':')[1];
        locks[fieldId] = {
          userId: lock.userId,
          username: lock.username,
        };
      }
    }

    // Build presence map
    const userPresence: Record<string, { userId: string; username: string; focusedFieldId: string | null }> = {};
    for (const [userId, presence] of appState.userPresence.entries()) {
      userPresence[userId] = presence;
    }

    socket.emit('state-sync', {
      caseId,
      caseData: caseData
        ? {
            id: caseData.id,
            title: caseData.title,
            description: caseData.description,
            status: caseData.status,
            fields: caseData.fields.map((f) => ({
              id: f.id,
              caseId: f.case_id,
              fieldName: f.field_name,
              fieldType: f.field_type,
              value: f.value || '',
              lockedByUserId: f.locked_by_user_id,
              lockedAt: f.locked_at,
            })),
          }
        : null,
      locks,
      userPresence,
    });
  } catch (error) {
    console.error('Error sending state sync:', error);
  }
}
