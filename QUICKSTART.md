# Quick Start Guide

Get the Real-time Collaborative Case Management POC running in 5 minutes.

## Prerequisites Check

- [ ] Node.js 16+ installed (`node --version`)
- [ ] PostgreSQL running (local or Neon)
- [ ] Database URL ready

## Step 1: Setup (2 minutes)

```bash
# 1. Install dependencies for all workspaces
npm install

# 2. Create backend .env file
cd backend
cp .env.example .env

# 3. Edit .env with your database URL
# Windows: notepad .env
# Mac/Linux: nano .env

# 4. Go back to root
cd ..
```

## Step 2: Start Backend (1 minute)

```bash
# Terminal 1
cd backend
npm run dev
```

Wait for output: `Server running on http://localhost:5000`

## Step 3: Start Frontend (1 minute)

```bash
# Terminal 2 (new terminal)
cd frontend
npm run dev
```

Wait for output showing Vite is ready on `http://localhost:3000`

## Step 4: Test Multi-user Collaboration (1 minute)

### Open 3 Browser Windows

**Window 1:**
1. Go to `http://localhost:3000`
2. Login as `user_a` / `pass_a`
3. Click any case (e.g., "Customer Service Issue")

**Window 2:**
1. Go to `http://localhost:3000` in new window
2. Login as `user_b` / `pass_b`
3. Open same case

**Window 3:**
1. Go to `http://localhost:3000` in new window
2. Login as `user_c` / `pass_c`
3. Open same case

### Watch Real-time Collaboration

- All three windows show the same case
- Click in a field in Window 1 → watch it lock in Windows 2 & 3 (🔒 icon appears)
- Stop typing for 5 seconds → field auto-unlocks
- See presence avatars appear when another user focuses a field
- See "Currently editing" status update on case list in real-time

## Quick Testing Checklist

- [ ] Can login with test users
- [ ] Can open case list page
- [ ] Can navigate to case details
- [ ] Field locks when you focus (shows 🔒 in other windows)
- [ ] Lock releases after 5 seconds of inactivity
- [ ] Can see other users' presence (colored avatars)
- [ ] Case list shows active editors in real-time
- [ ] Can edit all 10 field types
- [ ] Changes auto-save after 5 seconds
- [ ] Can logout and login as different user

## Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot GET /api/health" | Backend not running. Check Terminal 1 |
| "WebSocket error" | CORS issue. Check FRONTEND_URL in backend .env |
| Database connection error | Check DATABASE_URL format in .env |
| Port 3000/5000 already in use | Kill existing processes or change ports |
| Field locks not working | Refresh browser and try again. Check socket.io in network tab |

## Database Connection Examples

```bash
# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@xxx.neon.tech/database

# Local PostgreSQL (default)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/collab_gui

# Remote PostgreSQL
DATABASE_URL=postgresql://user:pass@db.example.com:5432/db_name
```

## Next Steps

- Read full README.md for architecture details
- Check implementation plan at `.claude/plans/dapper-wiggling-balloon.md`
- Explore backend code in `backend/src/`
- Explore frontend code in `frontend/src/`
- Run `npm run build` in each workspace for production builds

## Need Help?

Check the README.md "Troubleshooting" section or review the console logs in both terminals for detailed error messages.
