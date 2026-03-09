import { Pool, Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DBUser, DBCase, DBCaseField } from './types/index';

let pool: Pool;

export function initDatabase(connectionString: string) {
  pool = new Pool({
    connectionString,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export async function setupSchema() {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Asyc_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create cases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Asyc_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create case_fields table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Asyc_case_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES Asyc_cases(id) ON DELETE CASCADE,
        field_name VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        value TEXT,
        locked_by_user_id UUID REFERENCES Asyc_users(id) ON DELETE SET NULL,
        locked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(case_id, field_name)
      )
    `);

    // Create field_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS Asyc_field_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        field_id UUID NOT NULL REFERENCES Asyc_case_fields(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES Asyc_users(id) ON DELETE CASCADE,
        old_value TEXT,
        new_value TEXT NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asyc_case_fields_case_id ON Asyc_case_fields(case_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asyc_case_fields_locked_by ON Asyc_case_fields(locked_by_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asyc_field_history_field_id ON Asyc_field_history(field_id)`);

    await client.query('COMMIT');
    console.log('Database schema created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function seedData() {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Create test users
    const userA = await client.query<DBUser>(
      `INSERT INTO Asyc_users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, password_hash, created_at`,
      ['user_a', 'usera@test.com', 'hashed_pass_a']
    );

    const userB = await client.query<DBUser>(
      `INSERT INTO Asyc_users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, password_hash, created_at`,
      ['user_b', 'userb@test.com', 'hashed_pass_b']
    );

    const userC = await client.query<DBUser>(
      `INSERT INTO Asyc_users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, password_hash, created_at`,
      ['user_c', 'userc@test.com', 'hashed_pass_c']
    );

    console.log('Created test users');

    // Create demo cases
    const case1 = await client.query<DBCase>(
      `INSERT INTO Asyc_cases (title, description, status) VALUES ($1, $2, $3) RETURNING id, title, description, status, created_at`,
      ['Customer Service Issue', 'Customer reported login problems', 'open']
    );

    const case2 = await client.query<DBCase>(
      `INSERT INTO Asyc_cases (title, description, status) VALUES ($1, $2, $3) RETURNING id, title, description, status, created_at`,
      ['Bug Report', 'Dashboard shows incorrect data', 'in_progress']
    );

    const case3 = await client.query<DBCase>(
      `INSERT INTO Asyc_cases (title, description, status) VALUES ($1, $2, $3) RETURNING id, title, description, status, created_at`,
      ['Feature Request', 'Add export to CSV functionality', 'pending']
    );

    console.log('Created demo cases');

    const fieldTypes = ['text', 'textarea', 'number', 'datetime', 'checkbox', 'dropdown', 'slider', 'radio', 'text', 'number'];
    const fieldNames = [
      'Name',
      'Description',
      'Priority',
      'Due Date',
      'Urgent',
      'Category',
      'Severity',
      'Status',
      'Assignee',
      'Budget',
    ];

    const caseIds = [case1.rows[0].id, case2.rows[0].id, case3.rows[0].id];

    // Create fields for each case
    for (const caseId of caseIds) {
      for (let i = 0; i < 10; i++) {
        await client.query<DBCaseField>(
          `INSERT INTO Asyc_case_fields (case_id, field_name, field_type, value) VALUES ($1, $2, $3, $4)`,
          [caseId, fieldNames[i], fieldTypes[i], '']
        );
      }
    }

    console.log('Created fields for all cases');

    await client.query('COMMIT');
    console.log('Database seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserByUsername(username: string): Promise<DBUser | null> {
  const result = await getPool().query<DBUser>(
    `SELECT id, username, email, password_hash, created_at FROM Asyc_users WHERE username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

export async function getAllCases() {
  const result = await getPool().query<DBCase>(`
    SELECT id, title, description, status, created_at FROM Asyc_cases ORDER BY created_at DESC
  `);
  return result.rows;
}

export async function getCaseWithFields(caseId: string) {
  const caseResult = await getPool().query<DBCase>(
    `SELECT id, title, description, status, created_at FROM Asyc_cases WHERE id = $1`,
    [caseId]
  );

  if (caseResult.rows.length === 0) {
    return null;
  }

  const fieldsResult = await getPool().query<DBCaseField>(
    `SELECT id, case_id, field_name, field_type, value, locked_by_user_id, locked_at FROM Asyc_case_fields WHERE case_id = $1`,
    [caseId]
  );

  return {
    ...caseResult.rows[0],
    fields: fieldsResult.rows,
  };
}

export async function updateFieldValue(fieldId: string, value: string, userId: string) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Get old value for history
    const oldValueResult = await client.query<{ value: string }>(
      `SELECT value FROM Asyc_case_fields WHERE id = $1`,
      [fieldId]
    );

    const oldValue = oldValueResult.rows[0]?.value || null;

    // Update field
    await client.query(
      `UPDATE Asyc_case_fields SET value = $1, updated_at = CURRENT_TIMESTAMP, locked_by_user_id = NULL, locked_at = NULL WHERE id = $2`,
      [value, fieldId]
    );

    // Record history
    await client.query(
      `INSERT INTO Asyc_field_history (field_id, user_id, old_value, new_value) VALUES ($1, $2, $3, $4)`,
      [fieldId, userId, oldValue, value]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function lockField(fieldId: string, userId: string): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE Asyc_case_fields SET locked_by_user_id = $1, locked_at = CURRENT_TIMESTAMP WHERE id = $2 AND locked_by_user_id IS NULL RETURNING id`,
    [userId, fieldId]
  );
  return result.rows.length > 0;
}

export async function unlockField(fieldId: string) {
  await getPool().query(
    `UPDATE Asyc_case_fields SET locked_by_user_id = NULL, locked_at = NULL WHERE id = $1`,
    [fieldId]
  );
}

export async function getFieldLock(fieldId: string) {
  const result = await getPool().query(
    `SELECT locked_by_user_id, locked_at FROM Asyc_case_fields WHERE id = $1`,
    [fieldId]
  );
  return result.rows[0] || null;
}
