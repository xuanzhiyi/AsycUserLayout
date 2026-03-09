import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initDatabase, setupSchema, seedData } from './database';
import { initializeSocketHandlers } from './socket-handlers';
import authRoutes from './routes/auth';
import casesRoutes from './routes/cases';
import fieldsRoutes from './routes/fields';
import { AppState } from './types';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost/collab_gui';

// Initialize app state
const appState: AppState = {
  fieldLocks: new Map(),
  userPresence: new Map(),
  activeCases: new Map(),
};

// Middleware
app.use(express.json());
app.use(express.static('../frontend/dist'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/cases/:caseId/fields', fieldsRoutes);

// Socket.IO
initializeSocketHandlers(io, appState);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function startServer() {
  try {
    console.log('Initializing database...');
    initDatabase(DB_URL);

    console.log('Setting up schema...');
    await setupSchema();

    console.log('Checking if data needs to be seeded...');
    const { getAllCases } = await import('./database');
    const cases = await getAllCases();
    if (cases.length === 0) {
      console.log('Seeding initial data...');
      await seedData();
    } else {
      console.log('Data already exists, skipping seed');
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, httpServer, io, appState };
