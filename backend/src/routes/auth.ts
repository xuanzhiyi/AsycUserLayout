import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByUsername } from '../database';
import { AuthResponse } from '../../../shared/types';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Hardcoded test users for demo
const TEST_USERS = {
  user_a: { password: 'pass_a', id: 'user-a-id', email: 'usera@test.com' },
  user_b: { password: 'pass_b', id: 'user-b-id', email: 'userb@test.com' },
  user_c: { password: 'pass_c', id: 'user-c-id', email: 'userc@test.com' },
};

export interface AuthToken {
  userId: string;
  username: string;
  email: string;
}

router.post('/login', async (req: Request, res: Response<AuthResponse>) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Check against test users
    const testUser = TEST_USERS[username as keyof typeof TEST_USERS];
    if (!testUser || testUser.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Try to get user from database, or use test user info
    let dbUser;
    try {
      dbUser = await getUserByUsername(username);
    } catch (error) {
      // If DB is not available, use test user
      console.warn('Could not fetch user from DB, using test user', error);
    }

    const userId = dbUser?.id || testUser.id;
    const userEmail = dbUser?.email || testUser.email;

    const token = jwt.sign(
      {
        userId,
        username,
        email: userEmail,
      } as AuthToken,
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        username,
        email: userEmail,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

export function verifyToken(token: string): AuthToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as AuthToken;
  } catch (error) {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: any) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  (req as any).user = decoded;
  next();
}

export default router;
