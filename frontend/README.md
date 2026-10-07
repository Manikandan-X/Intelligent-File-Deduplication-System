# Intelligent File Deduplication & Storage Optimization System (Frontend)

A React single-page app for the FastAPI deduplication backend. It uploads files, finds
identical content (even with different names), groups duplicates, shows storage
analytics, and lets users delete redundant files safely.

**Stack:** React 18 · Vite 5 · TypeScript · Material UI v6 · Axios · React Router v6 · Chart.js (react-chartjs-2)

---

## Features

| Area | What you get |
|---|---|
| Authentication | Register, sign in (JWT), sign out, automatic redirect to login when the token expires |
| Dashboard | Total files, total storage, duplicate files, duplicate storage, potential savings, duplicate groups, unique-vs-duplicate doughnut chart, largest-files bar chart, largest files and recent uploads tables |
| Files | Upload (drag and drop, multiple files, progress), download, delete, metadata drawer, search by name, filters (file type, size range, duplicate / not duplicate, protected, date range), sorting, pagination |
| Duplicate groups | Original file, duplicate files, file size, upload date, storage consumed, potential savings per group, expandable member list, sort and search |
| Safe deletion | Confirmation pop-up showing the selected file and **storage impact** (space freed, % of storage, used before and after), duplicate / original / unique warning, optional reason, protected files blocked |
| Protected files | Lock indicator, delete disabled; admins can protect or unprotect a file |
| Deletion history | Every deleted file with size freed and date (built from audit events) |
| Audit logs | Filter by action, entity, date range, sort order; admins can view all users |
| User management | Admin only: create, edit, change role, activate / deactivate, delete |
| Profile | Update name and email, change password |

---

## Prerequisites

- **Node.js 18.18+** (Node 20 LTS recommended) and npm
- The **backend** running and reachable (FastAPI, MySQL 8, Redis, Celery worker)

---

## 1. Start the backend first

From your backend project folder:

```bash
# 1. Make sure MySQL and Redis are running, and your backend .env is filled in

# 2. Apply database migrations
alembic upgrade head

# 3. Seed the roles (inserts Admin first, then User)
python -m app.db.seed

# 4. Start the API (port 8000)
uvicorn app.main:app --reload --port 8000

# 5. In a second terminal, start the Celery worker (duplicate detection runs here)
celery -A app.celery_app.celery_app worker --loglevel=info
# On Windows add:  --pool=solo
```

Check it works: open http://localhost:8002/docs (Swagger) or http://localhost:8002/health.

> **Important:** the backend only allows requests from `http://localhost:5174` and
> `http://127.0.0.1:5174` (CORS list in `app/main.py`). This frontend is pinned to port
> **5174** for that reason. If you change the port, add the new origin to the backend CORS list.

---

## 2. Set up the frontend

```bash
cd dedupe-frontend

# install dependencies
npm install

# create your environment file
cp .env.example .env        # Windows (cmd): copy .env.example .env

# start the dev server
npm run dev
```

Open **http://localhost:5174**.

### Environment variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8002` | Base URL of the FastAPI backend, no trailing slash |
| `VITE_ADMIN_ROLE_ID` | `1` | `id` of the **Admin** role in the `roles` table. `/auth/me` returns only `role_id`, so the UI uses this to detect admins |
| `VITE_USER_ROLE_ID` | `2` | `id` of the **User** role (used by the role dropdown on the Users page) |
| `VITE_MAX_FILE_SIZE` | `92274688` (88 MB) | Client-side pre-check for upload size. Keep it equal to `MAX_FILE_SIZE` in the backend `.env`. The server still enforces the real limit |

Vite only exposes variables that start with `VITE_`. Restart `npm run dev` after editing `.env`.

---

## 3. First login

1. Go to http://localhost:5174/register and create an account (new accounts are regular users).
2. Sign in.
3. To get an **admin** account, promote a user in MySQL (the roles must be seeded):

   ```sql
   UPDATE users SET role_id = 1 WHERE email = 'you@example.com';
   ```

   Sign out and back in. Admins see system-wide data, the **Users** page, and the protect / unprotect button.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on port 5174 (fails if the port is taken, by design) |
| `npm run build` | Type-check (`tsc -b`) and create a production build in `dist/` |
| `npm run preview` | Serve the production build on port 5174 |

---

## Project structure

```
src/
├── api/
│   ├── client.ts            Axios instance, JWT header, 401 handling
│   └── endpoints.ts         Typed functions for every backend route
├── components/
│   ├── Layout.tsx           Sidebar, top bar, upload button, account menu
│   ├── DeleteFileDialog.tsx Confirmation pop-up with storage impact
│   ├── UploadDialog.tsx     Drag-and-drop multi-file upload with progress
│   ├── FileDetailsDrawer.tsx File metadata panel
│   ├── StorageBar.tsx       Segmented storage bar used across the app
│   ├── StatCard.tsx, PageHeader.tsx, EmptyState.tsx, FileTypeIcon.tsx
├── context/
│   ├── AuthContext.tsx      User, token, admin detection
│   └── NotifyContext.tsx    Toast notifications
├── pages/
│   ├── LoginPage.tsx, RegisterPage.tsx, AuthShell.tsx
│   ├── DashboardPage.tsx
│   ├── FilesPage.tsx
│   ├── DuplicateGroupsPage.tsx
│   ├── DeletionHistoryPage.tsx
│   ├── AuditLogsPage.tsx
│   ├── UsersPage.tsx        (admin only)
│   └── ProfilePage.tsx
├── utils/                   format helpers, duplicate index hook, refresh events
├── theme.ts                 MUI theme and color palette
├── types.ts                 TypeScript types matching the backend schemas
├── App.tsx                  Routes and route guards
└── main.tsx                 Providers and entry point
```

## Routes

| Path | Access | Page |
|---|---|---|
| `/login`, `/register` | Public | Authentication |
| `/` | Signed in | Dashboard |
| `/files` | Signed in | My files |
| `/duplicates` | Signed in | Duplicate groups |
| `/deletions` | Signed in | Deletion history |
| `/audit-logs` | Signed in | Audit logs |
| `/profile` | Signed in | Profile and password |
| `/users` | Admin | User management |

## Backend endpoints used

| Feature | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me`, `PUT /auth/me/password` |
| Files | `GET /files/`, `GET /files/{id}`, `POST /files/upload`, `GET /files/{id}/download`, `DELETE /files/{id}`, `PATCH /files/{id}/protection` |
| Duplicate groups | `GET /duplicate-groups/`, `GET /duplicate-groups/{id}/files` (optional patch) |
| Analytics | `GET /analytics/overview`, `/largest-files`, `/recent-uploads`, `/duplicate-groups/count` |
| Audit | `GET /audit-logs`, `GET /audit-logs/all` (admin) |
| Users (admin) | `GET/POST /users`, `PUT /users/{id}`, `PATCH /users/{id}/role`, `PATCH /users/{id}/activate`, `PATCH /users/{id}/deactivate`, `DELETE /users/{id}` |



## How the delete flow works

1. Click the delete icon on a file (Files page, duplicate group, or the details drawer).
2. A confirmation pop-up opens showing the file name, size and upload date.
3. **Storage impact** shows the space that will be freed, its percentage of your storage, and the
   used amount before and after, with a before/after bar.
4. A message explains whether the file is a **duplicate** (safe), the **original** of a group, or
   **unique** (no other copy exists).
5. Optionally add a reason (saved with the deletion), then click **Delete file**, or **Keep file** to cancel.
6. Protected files show a lock message and cannot be deleted.

The backend performs a soft delete and records the action in the deletion history and audit log.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach the server" | Backend is not running, or `VITE_API_URL` is wrong. Open `/health` on the backend URL |
| CORS error in the browser console | Open the app on `http://localhost:5174` exactly (not another port), or add your origin to the backend CORS list |
| Port 5174 already in use | Stop the other process. The dev server uses `strictPort` so it will not silently change ports |
| Redirected to login after every action | Token expired or `JWT_SECRET_KEY` changed. Sign in again |
| Uploads work but duplicates never appear | The Celery worker or Redis is not running. Start the worker (step 1.5) |
| Users page or protect button missing | Your user is not an admin, or `VITE_ADMIN_ROLE_ID` does not match the Admin role id in the database |
| Upload rejected | Audio and video files are not allowed, and files must be under the size limit (88 MB by default) |
| List requests return 307 or lose the token | List routes need the trailing slash (`/files/`, `/duplicate-groups/`). The app already uses it; keep it if you add calls |
| `npm install` fails | Use Node 18.18+ and delete `node_modules` and `package-lock.json`, then retry |

---

## Production build

```bash
npm run build      # outputs to dist/
```

Serve `dist/` with any static host (nginx, Caddy, etc.). Because the app uses client-side
routing, configure the server to fall back to `index.html` for unknown paths. Set `VITE_API_URL`
to your production API URL **before** building, and add the production origin to the backend
CORS list.