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
    emitCaseOpen({ caseId });
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
        // Cancel pending debounce/save when user leaves field
        const fieldKey = `${caseData.id}:${field.id}`;
        const timers = fieldTimers.get(fieldKey);
        if (timers?.debounceTimer) {
          clearTimeout(timers.debounceTimer);
          timers.debounceTimer = undefined;
        }
        if (timers?.saveTimer) {
          clearTimeout(timers.saveTimer);
          timers.saveTimer = undefined;
        }
        if (!timers?.debounceTimer && !timers?.saveTimer) {
          fieldTimers.delete(fieldKey);
        }
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
  const fieldKey = `${caseId}:${fieldId}`;
  const timers = fieldTimers.get(fieldKey) || {};

  // Clear previous debounce timer if it exists
  if (timers.debounceTimer) {
    clearTimeout(timers.debounceTimer);
  }

  // Set new debounce timer
  const debounceTimer = setTimeout(() => {
    // Clear any previous save timer
    if (timers.saveTimer) {
      clearTimeout(timers.saveTimer);
    }

    // Auto-save after debounce + delay
    const saveTimer = setTimeout(() => {
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
    if (data.caseId === caseId) {
      setFieldLocked(data.fieldId, { userId: data.userId, username: data.username });
      rerenderFields();
    }
  };

  const handleFieldUnlocked = (data: any) => {
    if (data.caseId === caseId) {
      setFieldUnlocked(data.fieldId);
      rerenderFields();
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
      rerenderFields();
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
    if (data.caseId === caseId && data.userId !== user.id) {
      const caseData = getState().currentCase;
      if (caseData) {
        const field = caseData.fields.find((f: CaseField) => f.id === data.fieldId);
        if (field) {
          field.value = data.value;
          // Update the input element
          const input = document.querySelector(`[data-field-id="${data.fieldId}"]`) as any;
          if (input) {
            input.value = data.value;
          }
        }
      }
    }
  };

  onStateSync(handleStateSync);
  onFieldLocked(handleFieldLocked);
  onFieldUnlocked(handleFieldUnlocked);
  onUserFocus(handleUserFocus);
  onUserBlur(handleUserBlur);
  onFieldUpdated(handleFieldUpdated);
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

function rerenderFields() {
  // Get form fields container
  const formFieldsContainer = document.querySelector('#form-fields') as HTMLElement;
  const caseInfo = document.querySelector('#case-info') as HTMLElement;

  if (!formFieldsContainer || !caseInfo) return;

  const state = getState();
  const caseData = state.currentCase;
  const user = state.currentUser;

  if (!caseData || !user) return;

  // Re-render all fields
  const newFieldsContainer = document.createElement('div');
  newFieldsContainer.className = 'form-fields';
  newFieldsContainer.id = 'form-fields';

  caseData.fields.forEach((field: CaseField) => {
    const lock = state.fieldLocks.get(field.id);
    const presenceUsers = Array.from(state.userPresence.values()).filter((p) => p.focusedFieldId === field.id && p.userId !== user.id);

    const fieldComponent = createFormField({
      field,
      isLocked: !!lock && lock.userId !== user.id,
      lockedByUsername: lock?.username,
      presenceUsers,
      onFocus: () => {
        emitFocusField(caseData.id, field.id);
        emitRequestLock(caseData.id, field.id);
      },
      onBlur: () => {
        emitBlurField(caseData.id, field.id);
        // Cancel pending debounce/save when user leaves field
        const fieldKey = `${caseData.id}:${field.id}`;
        const timers = fieldTimers.get(fieldKey);
        if (timers?.debounceTimer) {
          clearTimeout(timers.debounceTimer);
          timers.debounceTimer = undefined;
        }
        if (timers?.saveTimer) {
          clearTimeout(timers.saveTimer);
          timers.saveTimer = undefined;
        }
        if (!timers?.debounceTimer && !timers?.saveTimer) {
          fieldTimers.delete(fieldKey);
        }
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
