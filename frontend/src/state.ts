import { Case, CaseListItem } from '../shared/types';

export interface FieldLockState {
  userId: string;
  username: string;
}

export interface UserPresence {
  userId: string;
  username: string;
  focusedFieldId: string | null;
}

export interface AppState {
  // Auth state
  currentUser: {
    id: string;
    username: string;
    email: string;
    token: string;
  } | null;

  // Cases state
  cases: CaseListItem[];
  currentCaseId: string | null;
  currentCase: Case | null;

  // Field locks: key is fieldId, value is lock info
  fieldLocks: Map<string, FieldLockState>;

  // User presence: key is userId
  userPresence: Map<string, UserPresence>;

  // Active editors for current case
  activeEditors: string[];

  // Debounce timers per field
  fieldDebounceTimers: Map<string, NodeJS.Timeout>;

  // Auto-save timers per field
  fieldSaveTimers: Map<string, NodeJS.Timeout>;

  // Field change status
  fieldSaveStatus: Map<string, 'idle' | 'saving' | 'saved' | 'error'>;
}

// Initial state
const initialState: AppState = {
  currentUser: null,
  cases: [],
  currentCaseId: null,
  currentCase: null,
  fieldLocks: new Map(),
  userPresence: new Map(),
  activeEditors: [],
  fieldDebounceTimers: new Map(),
  fieldSaveTimers: new Map(),
  fieldSaveStatus: new Map(),
};

// State management
let state: AppState = { ...initialState };
const subscribers: Set<() => void> = new Set();

export function getState(): AppState {
  return state;
}

export function setState(updates: Partial<AppState>) {
  state = { ...state, ...updates };
  notifySubscribers();
}

export function updateState(updater: (state: AppState) => AppState) {
  state = updater(state);
  notifySubscribers();
}

export function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

// Helper functions
export function setCurrentUser(user: AppState['currentUser']) {
  setState({ currentUser: user });
}

export function setCurrentCase(caseData: Case | null, caseId: string | null) {
  setState({ currentCase: caseData, currentCaseId: caseId });
}

export function updateCasesList(cases: CaseListItem[]) {
  setState({ cases });
}

export function updateActiveEditors(editors: string[]) {
  setState({ activeEditors: editors });
}

export function setFieldLocked(fieldId: string, lock: FieldLockState) {
  updateState((state) => {
    const newLocks = new Map(state.fieldLocks);
    newLocks.set(fieldId, lock);
    return { ...state, fieldLocks: newLocks };
  });
}

export function setFieldUnlocked(fieldId: string) {
  updateState((state) => {
    const newLocks = new Map(state.fieldLocks);
    newLocks.delete(fieldId);
    return { ...state, fieldLocks: newLocks };
  });
}

export function setUserPresence(userId: string, presence: UserPresence) {
  updateState((state) => {
    const newPresence = new Map(state.userPresence);
    newPresence.set(userId, presence);
    return { ...state, userPresence: newPresence };
  });
}

export function removeUserPresence(userId: string) {
  updateState((state) => {
    const newPresence = new Map(state.userPresence);
    newPresence.delete(userId);
    return { ...state, userPresence: newPresence };
  });
}

export function clearFieldPresence(fieldId: string) {
  updateState((state) => {
    const newPresence = new Map(state.userPresence);
    for (const [userId, presence] of newPresence.entries()) {
      if (presence.focusedFieldId === fieldId) {
        presence.focusedFieldId = null;
      }
    }
    return { ...state, userPresence: newPresence };
  });
}

export function setFieldDebounceTimer(fieldId: string, timer: NodeJS.Timeout) {
  updateState((state) => {
    const newTimers = new Map(state.fieldDebounceTimers);
    // Clear existing timer
    const existing = newTimers.get(fieldId);
    if (existing) clearTimeout(existing);
    newTimers.set(fieldId, timer);
    return { ...state, fieldDebounceTimers: newTimers };
  });
}

export function clearFieldDebounceTimer(fieldId: string) {
  updateState((state) => {
    const newTimers = new Map(state.fieldDebounceTimers);
    const existing = newTimers.get(fieldId);
    if (existing) clearTimeout(existing);
    newTimers.delete(fieldId);
    return { ...state, fieldDebounceTimers: newTimers };
  });
}

export function setFieldSaveTimer(fieldId: string, timer: NodeJS.Timeout) {
  updateState((state) => {
    const newTimers = new Map(state.fieldSaveTimers);
    // Clear existing timer
    const existing = newTimers.get(fieldId);
    if (existing) clearTimeout(existing);
    newTimers.set(fieldId, timer);
    return { ...state, fieldSaveTimers: newTimers };
  });
}

export function clearFieldSaveTimer(fieldId: string) {
  updateState((state) => {
    const newTimers = new Map(state.fieldSaveTimers);
    const existing = newTimers.get(fieldId);
    if (existing) clearTimeout(existing);
    newTimers.delete(fieldId);
    return { ...state, fieldSaveTimers: newTimers };
  });
}

export function setFieldSaveStatus(fieldId: string, status: 'idle' | 'saving' | 'saved' | 'error') {
  updateState((state) => {
    const newStatus = new Map(state.fieldSaveStatus);
    newStatus.set(fieldId, status);
    return { ...state, fieldSaveStatus: newStatus };
  });
}

export function resetState() {
  // Clear all timers
  state.fieldDebounceTimers.forEach((timer) => clearTimeout(timer));
  state.fieldSaveTimers.forEach((timer) => clearTimeout(timer));

  state = { ...initialState };
  notifySubscribers();
}
