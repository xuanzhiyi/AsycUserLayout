import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUser: { userId: string; username: string } | null = null;

export function initSocketConnection(
  token: string,
  user: { userId: string; username: string }
): Socket {
  const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  currentUser = user;

  socket = io(serverUrl, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('Connected to server', currentUser);
    // Emit user-connect when socket connects
    if (currentUser && socket) {
      socket.emit('user-connect', {
        userId: currentUser.userId,
        username: currentUser.username,
      });
      console.log('Emitted user-connect:', currentUser);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocketConnection first.');
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Helper functions for common socket events
export function emitUserConnect(userId: string, username: string, caseId?: string) {
  getSocket().emit('user-connect', { userId, username, caseId });
}

export function emitCaseOpen(caseId: string) {
  getSocket().emit('case-open', { caseId });
}

export function emitFocusField(caseId: string, fieldId: string) {
  getSocket().emit('focus-field', { caseId, fieldId });
}

export function emitBlurField(caseId: string, fieldId: string) {
  getSocket().emit('blur-field', { caseId, fieldId });
}

export function emitRequestLock(caseId: string, fieldId: string) {
  getSocket().emit('request-lock', { caseId, fieldId });
}

export function emitReleaseLock(caseId: string, fieldId: string) {
  getSocket().emit('release-lock', { caseId, fieldId });
}

export function emitCommitField(caseId: string, fieldId: string, value: any) {
  console.log('emitCommitField called:', { caseId, fieldId, value });
  const socket = getSocket();
  console.log('Socket connected?', socket.connected);
  socket.emit('commit-field', { caseId, fieldId, value });
  console.log('commit-field event emitted');
}

// Event listeners
export function onStateSync(callback: (data: any) => void) {
  getSocket().on('state-sync', callback);
}

export function onFieldLocked(callback: (data: any) => void) {
  getSocket().on('field-locked', callback);
}

export function onFieldUnlocked(callback: (data: any) => void) {
  getSocket().on('field-unlocked', callback);
}

export function onUserFocus(callback: (data: any) => void) {
  getSocket().on('user-focus', callback);
}

export function onUserBlur(callback: (data: any) => void) {
  getSocket().on('user-blur', callback);
}

export function onFieldUpdated(callback: (data: any) => void) {
  getSocket().on('field-updated', callback);
}

export function onLockDenied(callback: (data: any) => void) {
  getSocket().on('lock-denied', callback);
}

export function onUserJoined(callback: (data: any) => void) {
  getSocket().on('user-joined', callback);
}

export function onUserLeft(callback: (data: any) => void) {
  getSocket().on('user-left', callback);
}

export function onActiveEditorsUpdate(callback: (data: any) => void) {
  getSocket().on('active-editors-update', callback);
}

export function offStateSync(callback: (data: any) => void) {
  getSocket().off('state-sync', callback);
}

export function offFieldLocked(callback: (data: any) => void) {
  getSocket().off('field-locked', callback);
}

export function offFieldUnlocked(callback: (data: any) => void) {
  getSocket().off('field-unlocked', callback);
}

export function offUserFocus(callback: (data: any) => void) {
  getSocket().off('user-focus', callback);
}

export function offUserBlur(callback: (data: any) => void) {
  getSocket().off('user-blur', callback);
}

export function offFieldUpdated(callback: (data: any) => void) {
  getSocket().off('field-updated', callback);
}

export function offLockDenied(callback: (data: any) => void) {
  getSocket().off('lock-denied', callback);
}

export function offActiveEditorsUpdate(callback: (data: any) => void) {
  getSocket().off('active-editors-update', callback);
}
