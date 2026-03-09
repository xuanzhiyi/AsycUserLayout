# Real-time Collaborative Case Management System POC

A proof-of-concept application demonstrating real-time collaborative editing where multiple users can simultaneously work on the same case with field-level locking, auto-save, and real-time presence awareness.

## Features

- **Real-time Collaboration**: Multiple users can edit the same case simultaneously
- **Field-level Locking**: First user to edit a field locks it for others during their editing session
- **Auto-save**: Changes automatically commit after 5 seconds of inactivity
- **Real-time Presence**: See where other users are focusing and who is editing each case
- **10 Field Types**: Text input, textarea, number, datetime, checkbox, dropdown, slider, and radio buttons
- **Multiple Test Users**: Pre-configured UserA, UserB, and UserC for easy testing

## Project Structure

```
project-root/
├── backend/              # Node.js/Express/Socket.IO server
│   ├── src/
│   │   ├── server.ts
│   │   ├── database.ts
│   │   ├── socket-handlers.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── cases.ts
│   │   │   └── fields.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/            # Vanilla TypeScript SPA
│   ├── src/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── pages/
│   │   │   ├── login.ts
│   │   │   ├── case-list.ts
│   │   │   └── case-details.ts
│   │   ├── components/
│   │   │   └── form-fields.ts
│   │   ├── socket-client.ts
│   │   ├── state.ts
│   │   └── styles.css
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── shared/
│   └── types.ts        # Shared TypeScript types
└── package.json        # Root workspace package.json
```

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (Neon PostgreSQL recommended)
- Two terminal windows (one for backend, one for frontend)

## Installation & Setup

### 1. Install Dependencies

```bash
# Install root and workspace dependencies
npm install

# Or for each workspace individually
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment Setup

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database_name

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Database Setup

The backend will automatically:
1. Create the required database schema on first run
2. Seed the database with 3 demo cases and test users (if empty)

## Running the Application

### Terminal 1 - Backend Server

```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:5000`

### Terminal 2 - Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000` and automatically proxy API requests to the backend.

## Test Accounts

Use these credentials to login:

| Username | Password | Purpose |
|----------|----------|---------|
| `user_a` | `pass_a` | UserA - First demo user |
| `user_b` | `pass_b` | UserB - Second demo user |
| `user_c` | `pass_c` | UserC - Third demo user |

## How to Test Real-time Collaboration

### Multi-user Editing

1. Open 3 browser windows (or tabs with different logins)
2. Login as UserA in window 1, UserB in window 2, UserC in window 3
3. All open the same case from the case list
4. Observe:
   - **Real-time presence**: See where other users are focused (colored avatars on fields)
   - **Live editors list**: Case list shows who is currently editing
   - **Field locking**: When UserA focuses on a field, UserB/C see it's locked and can't edit
   - **Lock release**: After 5 seconds of inactivity, the field auto-unlocks
   - **Auto-save**: Changes automatically save after 5 seconds of typing stops

### Testing Specific Features

**Lock Behavior:**
1. UserA focuses on "Name" field → field locks
2. UserB tries to type → input is disabled, shows lock icon
3. UserA stops typing for 5 seconds → lock releases automatically
4. UserB can now edit the field

**Auto-save:**
1. UserA types "John" → debounces for 0.5 seconds
2. UserA continues typing "John Doe" → keeps delaying
3. UserA stops typing → after 5 seconds, saves automatically
4. All other users see the update in real-time

**Presence Awareness:**
1. UserA focuses on "Priority" field
2. UserB sees UserA's initial appear above the field
3. UserA blurs from field
4. UserA's indicator disappears

## Architecture Details

### Backend Components

**Socket.IO Event Flow:**
- `user-connect` → User joins the app
- `case-open` → User navigates to a case
- `focus-field` / `blur-field` → Track cursor position
- `request-lock` → Request exclusive edit access
- `release-lock` → Release lock
- `commit-field` → Save field value to database
- Server broadcasts lock/unlock/presence updates to all clients

**Field Locking Logic:**
1. User focuses on field → requests lock via socket
2. Server checks if field is locked by another user
3. If available: grants lock, sets 5-second timeout
4. If locked: denies lock, broadcasts lock status to client
5. Client displays lock icon with username
6. Lock auto-releases after 5 seconds of inactivity

**Auto-save Implementation:**
- Frontend: Debounces input events (500ms)
- After debounce, waits 5 seconds of inactivity
- Emits `commit-field` event to server
- Server saves to database and broadcasts update
- Server automatically releases the field lock

### Frontend Components

**State Management:**
- Centralized app state with subscriber pattern
- Tracks: current user, active case, field locks, user presence
- Notifies all subscribers on state changes

**Form Fields:**
- Dynamically rendered based on field type
- Each field shows:
  - Lock indicator (if locked by another user)
  - Presence avatars (who's focused on this field)
  - Save status (idle/saving/saved/error)
- Input disabled when locked by another user

**Real-time Updates:**
- Socket.IO listeners update state on all server events
- State subscribers re-render affected UI components
- Smooth animations for presence indicators and save status

## Database Schema

### Users Table
- id (UUID) - Primary key
- username (VARCHAR) - Unique
- email (VARCHAR) - Unique
- password_hash (VARCHAR)
- created_at (TIMESTAMP)

### Cases Table
- id (UUID) - Primary key
- title (VARCHAR)
- description (TEXT)
- status (VARCHAR) - 'open', 'in_progress', 'pending'
- created_at (TIMESTAMP)

### Case Fields Table
- id (UUID) - Primary key
- case_id (UUID) - Foreign key to Cases
- field_name (VARCHAR)
- field_type (VARCHAR) - Type of field
- value (TEXT) - Current value
- locked_by_user_id (UUID) - Who has the lock
- locked_at (TIMESTAMP) - When lock was acquired
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Field History Table
- id (UUID) - Primary key
- field_id (UUID) - Foreign key to Case Fields
- user_id (UUID) - Who made the change
- old_value (TEXT) - Previous value
- new_value (TEXT) - New value
- changed_at (TIMESTAMP)

## Field Types Supported

1. **Text Input** - Single line text field
2. **TextArea** - Multi-line text field
3. **Number** - Numeric input
4. **DateTime** - Date and time picker
5. **Checkbox** - Boolean true/false
6. **Dropdown** - Select from predefined options (High, Medium, Low, Critical)
7. **Slider** - Range selector (0-100%)
8. **Radio Button** - Select one from options (Open, In Progress, Closed)

## Build for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
```

The frontend build will be output to `frontend/dist/` and can be served by the backend.

## Demo Scenarios

### Scenario 1: Simultaneous Editing
- UserA, UserB, UserC all edit "Customer Service Issue" case
- Each focuses on different fields
- See real-time presence of all users
- Try to edit same field - one locks, others see lock

### Scenario 2: Lock Timeout
- UserA focuses on "Priority" field (locks it)
- Leave UserA's browser idle for 5 seconds
- Lock automatically releases
- UserB can now edit the field

### Scenario 3: Case List Updates
- UserA opens "Bug Report" case
- UserB, UserC see "UserA" appears under active editors on case list
- UserA closes case / navigates back
- Status updates in real-time on case list

## Known Limitations & Future Enhancements

**Current POC Limitations:**
- No authentication/authorization (hardcoded test users)
- Field history only tracks but doesn't provide undo/redo
- No conflict resolution if two users somehow edit simultaneously
- Presence data not persisted (resets on server restart)
- No offline support

**Potential Enhancements:**
- Real JWT authentication with password hashing
- Operational transformation or CRDT for conflict-free editing
- Field edit history viewer and rollback capability
- Offline mode with sync on reconnect
- Comment/mention functionality on fields
- Role-based access control (read-only, edit, admin)
- Activity log and audit trail

## Troubleshooting

### Backend won't connect to database
- Verify `DATABASE_URL` is correct in `.env`
- Ensure PostgreSQL service is running
- Check network connectivity to database host

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check browser console for CORS errors
- Verify proxy configuration in `vite.config.ts`

### Socket.IO connection errors
- Check that backend is serving Socket.IO on `/socket.io`
- Verify `FRONTEND_URL` matches frontend origin
- Check browser console for connection logs

### Fields not locking when editing
- Verify Socket.IO events are being emitted (check browser network tab)
- Check backend console for socket connection logs
- Ensure all 3+ browser windows are connected to same backend instance

## Support

For questions or issues with this POC, refer to the implementation plan at `.claude/plans/dapper-wiggling-balloon.md`.
