import { FieldType } from '../../../shared/types';

export interface DBUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface DBCase {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export interface DBCaseField {
  id: string;
  case_id: string;
  field_name: string;
  field_type: FieldType;
  value: string;
  locked_by_user_id: string | null;
  locked_at: string | null;
}

export interface DBFieldHistory {
  id: string;
  field_id: string;
  user_id: string;
  old_value: string | null;
  new_value: string;
  changed_at: string;
}

// Runtime state for field locks
export interface FieldLock {
  userId: string;
  username: string;
  lockedAt: number;
  timeout: NodeJS.Timeout;
}

// In-memory state
export interface AppState {
  fieldLocks: Map<string, FieldLock>; // key: "caseId:fieldId"
  userPresence: Map<string, { userId: string; username: string; focusedFieldId: string | null }>;
  activeCases: Map<string, Set<string>>; // case -> set of user IDs
}
