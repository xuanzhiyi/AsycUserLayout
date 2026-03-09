// Shared Types for Real-time Collaborative GUI POC

export type FieldType = 'text' | 'textarea' | 'number' | 'datetime' | 'checkbox' | 'dropdown' | 'slider' | 'radio';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface CaseField {
  id: string;
  caseId: string;
  fieldName: string;
  fieldType: FieldType;
  value: string | number | boolean;
  lockedByUserId: string | null;
  lockedAt: string | null;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  status: string;
  fields: CaseField[];
  createdAt: string;
}

export interface CaseListItem {
  id: string;
  title: string;
  description: string;
  status: string;
  activeEditors: string[]; // List of usernames currently editing
}

// Socket.IO Event Types
export interface SocketEvents {
  // Client to Server
  'user-connect': { userId: string; username: string };
  'focus-field': { caseId: string; fieldId: string };
  'blur-field': { caseId: string; fieldId: string };
  'field-value-change': { caseId: string; fieldId: string; value: any };
  'request-lock': { caseId: string; fieldId: string };
  'release-lock': { caseId: string; fieldId: string };
  'commit-field': { caseId: string; fieldId: string; value: any };

  // Server to Client
  'state-sync': {
    cases: CaseListItem[];
    locks: Record<string, { userId: string; username: string }>;
    userPresence: Record<string, { userId: string; username: string; focusedFieldId: string | null }>;
  };
  'user-joined': { userId: string; username: string };
  'user-left': { userId: string; username: string };
  'field-locked': { caseId: string; fieldId: string; userId: string; username: string };
  'field-unlocked': { caseId: string; fieldId: string };
  'user-focus': { userId: string; username: string; caseId: string; fieldId: string };
  'user-blur': { userId: string; caseId: string; fieldId: string };
  'field-updated': { caseId: string; fieldId: string; value: any; userId: string };
  'lock-denied': { caseId: string; fieldId: string; lockedBy: string };
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}
