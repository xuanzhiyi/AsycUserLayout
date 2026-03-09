import { getState, setCurrentCase, setFieldLocked, setFieldUnlocked, setUserPresence, removeUserPresence } from '../state';
import {
  emitCaseOpen,
  emitFocusField,
  emitBlurField,
  emitRequestLock,
  emitReleaseLock,
  emitCommitField,
  onStateSync,
  onFieldLocked,
  onFieldUnlocked,
  onUserFocus,
  onUserBlur,
  onFieldUpdated,
  offStateSync,
  offFieldLocked,
  offFieldUnlocked,
  offUserFocus,
  offUserBlur,
  offFieldUpdated,
} from '../socket-client';
import { createFormField } from '../components/form-fields';
import { CaseField } from '../../shared/types';

const DEBOUNCE_DELAY = 500; // 500ms
const AUTO_SAVE_DELAY = 5000; // 5 seconds

// Track debounce and save timers per field
const fieldTimers = new Map<string, { debounceTimer?: NodeJS.Timeout; saveTimer?: NodeJS.Timeout }>();

export function createCaseDetailsPage(caseId: string, onBack: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'page';

  const content = document.createElement('div');
  content.className = 'container';

  // Header
  const header = document.createElement('div');
  header.style.marginBottom = '20px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.textContent = '← Back to Cases';
  backBtn.addEventListener('click', onBack);
  header.appendChild(backBtn);

  const activeUsersContainer = document.createElement('div');
  activeUsersContainer.className = 'active-users';
  activeUsersContainer.id = 'active-users';
  header.appendChild(activeUsersContainer);

  content.appendChild(header);

  // Case info
  const caseInfo = document.createElement('div');
  caseInfo.className = 'case-details';
  caseInfo.id = 'case-info';
  content.appendChild(caseInfo);

  // Form fields
  const formFields = document.createElement('div');
  formFields.className = 'form-fields';
  formFields.id = 'form-fields';
  caseInfo.appendChild(formFields);

  container.appendChild(content);

  // Load and render case
  loadCaseDetails(caseId, container);

  // Setup event listeners
  const user = getState().currentUser;
  if (user) {
    emitCaseOpen(caseId);
  }

  // Handle socket events
  setupSocketListeners(caseId);

  // Cleanup on destroy
  (container as any).__cleanup = () => {
    // Clear all pending timers for this case
    Array.from(fieldTimers.entries()).forEach(([fieldKey, timers]) => {
      if (fieldKey.startsWith(`${caseId}:`)) {
        if (timers.debounceTimer) clearTimeout(timers.debounceTimer);
        if (timers.saveTimer) clearTimeout(timers.saveTimer);
        fieldTimers.delete(fieldKey);
      }
    });

    offStateSync(() => {});
    offFieldLocked(() => {});
    offFieldUnlocked(() => {});
    offUserFocus(() => {});
    offUserBlur(() => {});
    offFieldUpdated(() => {});
  };

  return container;
}

async function loadCaseDetails(caseId: string, container: HTMLElement) {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const response = await fetch(`/api/cases/${caseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!data.success || !data.data) return;

    setCurrentCase(data.data, caseId);
    renderCaseDetails(container, data.data);
  } catch (error) {
    console.error('Error loading case:', error);
  }
}

function renderCaseDetails(container: HTMLElement, caseData: any) {
  const caseInfo = container.querySelector('#case-info') as HTMLElement;
  if (!caseInfo) return;

  // Clear and render header
  const title = document.createElement('h2');
  title.textContent = caseData.title;
  caseInfo.innerHTML = '';
  caseInfo.appendChild(title);

  if (caseData.description) {
    const desc = document.createElement('p');
    desc.textContent = caseData.description;
    desc.style.color = '#7f8c8d';
    desc.style.marginBottom = '20px';
    caseInfo.appendChild(desc);
  }

  // Render fields
  const formFields = document.createElement('div');
  formFields.className = 'form-fields';
  formFields.id = 'form-fields';

  const state = getState();
  const user = state.currentUser;

  caseData.fields.forEach((field: CaseField) => {
    const lock = state.fieldLocks.get(field.id);
    const presenceUsers = Array.from(state.userPresence.values()).filter((p) => p.focusedFieldId === field.id && p.userId !== user?.id);

    const fieldComponent = createFormField({
      field,
      isLocked: !!lock && lock.userId !== user?.id,
      lockedByUsername: lock?.username,
      presenceUsers,
      onFocus: () => {
        emitFocusField(caseData.id, field.id);
        emitRequestLock(caseData.id, field.id);
      },
      onBlur: () => {
        emitBlurField(caseData.id, field.id);
        // CRITICAL: Do NOT cancel the save timer on blur!
        // The save timer must fire to persist the value to the database
        // Only cancel the debounce timer since the user is no longer typing
        const fieldKey = `${caseData.id}:${field.id}`;
        const timers = fieldTimers.get(fieldKey);
        if (timers?.debounceTimer) {
          console.log('Clearing debounce timer on blur, but keeping save timer alive');
          clearTimeout(timers.debounceTimer);
          timers.debounceTimer = undefined;
        }
        // Keep saveTimer running! It needs to fire to save to database
      },
      onChange: (value) => {
        handleFieldChange(caseData.id, field.id, value);
      },
      saveStatus: state.fieldSaveStatus.get(field.id),
    });

    formFields.appendChild(fieldComponent);
  });

  caseInfo.appendChild(formFields);
}

function handleFieldChange(caseId: string, fieldId: string, value: any) {
  console.log('handleFieldChange called:', { caseId, fieldId, value });
  const fieldKey = `${caseId}:${fieldId}`;
  const timers = fieldTimers.get(fieldKey) || {};

  // CRITICAL: Renew the lock on every keystroke to prevent lock timeout while typing
  emitRequestLock(caseId, fieldId);
  console.log('Renewed lock request to prevent timeout');

  // Clear previous debounce timer if it exists
  if (timers.debounceTimer) {
    console.log('Clearing previous debounce timer');
    clearTimeout(timers.debounceTimer);
  }

  // Set new debounce timer
  const debounceTimer = setTimeout(() => {
    console.log('Debounce timer expired, starting 5s save timer for:', { fieldId, value });
    // Clear any previous save timer
    if (timers.saveTimer) {
      console.log('Clearing previous save timer');
      clearTimeout(timers.saveTimer);
    }

    // Auto-save after debounce + delay
    const saveTimer = setTimeout(() => {
      console.log('Save timer expired, calling emitCommitField with value:', value);
      emitCommitField(caseId, fieldId, value);
      // Clear the save timer from tracking
      const currentTimers = fieldTimers.get(fieldKey);
      if (currentTimers) {
        currentTimers.saveTimer = undefined;
        if (!currentTimers.debounceTimer) {
          fieldTimers.delete(fieldKey);
        }
      }
    }, AUTO_SAVE_DELAY);

    // Update timer tracking
    fieldTimers.set(fieldKey, { ...timers, saveTimer });
  }, DEBOUNCE_DELAY);

  // Update timer tracking
  fieldTimers.set(fieldKey, { ...timers, debounceTimer });
}

function setupSocketListeners(caseId: string) {
  const state = getState();
  const user = state.currentUser;
  if (!user) return;

  console.log('setupSocketListeners called for caseId:', caseId, 'currentUser:', user);

  // Handle state sync
  const handleStateSync = (data: any) => {
    if (data.caseId === caseId) {
      setCurrentCase(data.caseData, caseId);
      renderCaseDetails(document.querySelector('#app') || document.body, data.caseData);

      // Update locks
      Object.entries(data.locks).forEach(([fieldId, lock]: [string, any]) => {
        setFieldLocked(fieldId, { userId: lock.userId, username: lock.username });
      });

      // Update presence
      Object.entries(data.userPresence).forEach(([userId, presence]: [string, any]) => {
        setUserPresence(userId, presence);
      });

      // Update active users display
      const activeUsers = Array.from(data.userPresence.values()).map((p: any) => p.username).filter((u: string) => u !== user.username);
      updateActiveUsers(activeUsers, user.username);
    }
  };

  // Handle field lock events
  const handleFieldLocked = (data: any) => {
    console.log('handleFieldLocked called:', data, 'comparing caseId:', data.caseId, 'vs', caseId);
    if (data.caseId === caseId) {
      setFieldLocked(data.fieldId, { userId: data.userId, username: data.username });
      // Only rerender if another user locked the field
      // Skip rerender for current user's lock to preserve focus
      if (data.userId !== user.id) {
        console.log('Rerendering due to another user locking');
        rerenderFields();
      }
    }
  };

  const handleFieldUnlocked = (data: any) => {
    console.log('handleFieldUnlocked called:', data, 'comparing caseId:', data.caseId, 'vs', caseId);
    if (data.caseId === caseId) {
      setFieldUnlocked(data.fieldId);
      console.log('Field unlocked - rerendering with smart value preservation');
      // Rerender with smart preservation:
      // - If DOM ≠ State: preserve DOM (current user is editing)
      // - If DOM == State: use State (remote update already applied)
      rerenderFields(true);
    }
  };

  // Handle user focus
  const handleUserFocus = (data: any) => {
    if (data.caseId === caseId) {
      setUserPresence(data.userId, {
        userId: data.userId,
        username: data.username,
        focusedFieldId: data.fieldId,
      });
      // Only rerender if another user focused a field
      // Skip rerender for current user's focus to preserve field interaction
      if (data.userId !== user.id) {
        rerenderFields();
      }
    }
  };

  const handleUserBlur = (data: any) => {
    if (data.caseId === caseId) {
      const presence = state.userPresence.get(data.userId);
      if (presence) {
        presence.focusedFieldId = null;
        setUserPresence(data.userId, presence);
      }
      rerenderFields();
    }
  };

  // Handle field updates from other users
  const handleFieldUpdated = (data: any) => {
    console.log('field-updated event received:', data);
    console.log('Current caseId:', caseId, 'event caseId:', data.caseId, 'current user:', user.id, 'event userId:', data.userId);

    if (data.caseId === caseId && data.userId !== user.id) {
      console.log('✓ Processing field update from another user');
      const caseData = getState().currentCase;
      console.log('Current case data:', caseData);

      if (caseData) {
        const field = caseData.fields.find((f: CaseField) => f.id === data.fieldId);
        console.log('Found field:', field?.fieldName, 'with id:', data.fieldId);

        if (field) {
          console.log('Updating field value:', field.fieldName, 'from', field.value, 'to', data.value);
          field.value = data.value;
          console.log('Field value after update:', field.value);
        }
      }
      // Rerender without preserving values to show the updated field from another user
      console.log('Calling rerenderFields(false) to show updated value');
      rerenderFields(false);
    } else {
      console.log('✗ Skipping field update');
      if (data.caseId !== caseId) console.log('  Reason: Case ID mismatch:', data.caseId, '!==', caseId);
      if (data.userId === user.id) console.log('  Reason: Same user:', data.userId, '===', user.id);
    }
  };

  console.log('Registering socket event listeners');
  onStateSync(handleStateSync);
  onFieldLocked(handleFieldLocked);
  onFieldUnlocked(handleFieldUnlocked);
  onUserFocus(handleUserFocus);
  onUserBlur(handleUserBlur);
  onFieldUpdated(handleFieldUpdated);
  console.log('Socket event listeners registered');
}

function updateActiveUsers(otherUsers: string[], currentUser: string) {
  const container = document.querySelector('#active-users') as HTMLElement;
  if (!container) return;

  container.innerHTML = '';

  const currentBadge = document.createElement('div');
  currentBadge.className = 'user-presence';
  currentBadge.innerHTML = `
    <span class="presence-indicator"></span>
    <span>${currentUser} (You)</span>
  `;
  container.appendChild(currentBadge);

  otherUsers.forEach((username) => {
    const badge = document.createElement('div');
    badge.className = 'user-presence';
    badge.innerHTML = `
      <span class="presence-indicator"></span>
      <span>${username}</span>
    `;
    container.appendChild(badge);
  });
}

function rerenderFields(preserveValues = true) {
  // Get form fields container
  const formFieldsContainer = document.querySelector('#form-fields') as HTMLElement;
  const caseInfo = document.querySelector('#case-info') as HTMLElement;

  if (!formFieldsContainer || !caseInfo) return;

  const state = getState();
  const caseData = state.currentCase;
  const user = state.currentUser;

  if (!caseData || !user) return;

  // Smart value preservation strategy:
  // - For each field, compare DOM value with state value
  // - If different: preserve DOM (user is editing this field)
  // - If same: use state (remote update from another user)
  const currentValues = new Map<string, string>();
  caseData.fields.forEach((field: CaseField) => {
    const input = document.querySelector(`input[data-field-id="${field.id}"], textarea[data-field-id="${field.id}"], select[data-field-id="${field.id}"]`) as any;
    if (input) {
      const domValue = input.value;
      const stateValue = String(field.value || '');

      // If DOM value differs from state value, the user is editing → preserve DOM value
      if (domValue !== stateValue && preserveValues) {
        console.log(`Field ${field.id}: DOM="${domValue}" differs from state="${stateValue}" - preserving DOM`);
        currentValues.set(field.id, domValue);
      } else if (domValue === stateValue && preserveValues) {
        console.log(`Field ${field.id}: DOM="${domValue}" matches state - using state`);
        // Don't set currentValues, will use state value
      }
    }
  });

  // Re-render all fields
  const newFieldsContainer = document.createElement('div');
  newFieldsContainer.className = 'form-fields';
  newFieldsContainer.id = 'form-fields';

  caseData.fields.forEach((field: CaseField) => {
    const lock = state.fieldLocks.get(field.id);
    const presenceUsers = Array.from(state.userPresence.values()).filter((p) => p.focusedFieldId === field.id && p.userId !== user.id);

    // Use current value if being edited, otherwise use server value
    const fieldToRender = { ...field };
    if (currentValues.has(field.id)) {
      fieldToRender.value = currentValues.get(field.id);
    }

    const fieldComponent = createFormField({
      field: fieldToRender,
      isLocked: !!lock && lock.userId !== user.id,
      lockedByUsername: lock?.username,
      presenceUsers,
      onFocus: () => {
        emitFocusField(caseData.id, field.id);
        emitRequestLock(caseData.id, field.id);
      },
      onBlur: () => {
        emitBlurField(caseData.id, field.id);
        // CRITICAL: Do NOT cancel the save timer on blur!
        // The save timer must fire to persist the value to the database
        // Only cancel the debounce timer since the user is no longer typing
        const fieldKey = `${caseData.id}:${field.id}`;
        const timers = fieldTimers.get(fieldKey);
        if (timers?.debounceTimer) {
          console.log('Clearing debounce timer on blur, but keeping save timer alive');
          clearTimeout(timers.debounceTimer);
          timers.debounceTimer = undefined;
        }
        // Keep saveTimer running! It needs to fire to save to database
      },
      onChange: (value) => {
        handleFieldChange(caseData.id, field.id, value);
      },
      saveStatus: state.fieldSaveStatus.get(field.id),
    });

    newFieldsContainer.appendChild(fieldComponent);
  });

  formFieldsContainer.replaceWith(newFieldsContainer);
}
