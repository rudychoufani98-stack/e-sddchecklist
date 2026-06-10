# E&S Due Diligence Tracker

A full-stack web application for LCCH to track Environmental & Social (E&S) due diligence deliverables across projects, with a built-in Data Room for document management.

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher

## Setup

### 1. Install dependencies

```bash
cd es-tracker
npm run install:all
```

This installs dependencies for the root, server, and client.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set secure passwords:

```
ADMIN_PASSWORD=your_secure_admin_password
SKYKAPITAL_PASSWORD=your_secure_skykapital_password
HITECH_PASSWORD=your_secure_hitech_password
JWT_SECRET=a_long_random_secret_string_at_least_32_chars
PORT=3001
```

### 3. Run the application

```bash
npm run dev
```

This starts:
- **Backend API** on `http://localhost:3001`
- **Frontend** on `http://localhost:3000`

Open your browser to `http://localhost:3000`.

## Login Credentials

| Username   | Password (from .env)        | Role  |
|------------|-----------------------------|-------|
| admin      | `ADMIN_PASSWORD`            | Admin |
| skykapital | `SKYKAPITAL_PASSWORD`       | Viewer |
| hitech     | `HITECH_PASSWORD`           | Viewer |

Sessions expire after **8 hours**.

## Role Capabilities

| Capability                          | Admin | Viewer (Skykapital / Hitech) |
|-------------------------------------|-------|------------------------------|
| View dashboard & progress bars      | Yes   | Yes                          |
| View section detail & checklists    | Yes   | Yes                          |
| Edit deliverable status             | Yes   | No                           |
| Edit delivery dates & comments      | Yes   | No                           |
| Upload files                        | Yes   | No                           |
| Download files                      | Yes   | Yes                          |
| Delete files                        | Yes   | No                           |
| View Data Room                      | Yes   | Yes                          |

Viewer roles see a completely clean read-only interface — edit controls are hidden entirely, not just disabled.

## Adding Files to the Data Room

### As Admin

**Method 1 — Via Section Detail:**
1. Navigate to a section (e.g. LCCH 3)
2. Click the paperclip icon in the **Files** column of any deliverable row
3. Use the upload area in the file panel

**Method 2 — Via Data Room page:**
1. Click **Data Room** in the top navigation
2. Click **Upload File**
3. Select a section, optionally link to a specific deliverable, then choose a file

### Supported file types
PDF, DOCX, XLSX, PNG, JPG, KMZ, ZIP — maximum 50 MB per file.

## Project Structure

```
es-tracker/
├── server/          Express API + SQLite
│   ├── index.js     Entry point
│   ├── db.js        Database setup & seeding
│   ├── auth.js      JWT middleware
│   └── routes/      API route handlers
├── client/          React frontend
│   └── src/
│       ├── pages/   Login, Dashboard, SectionDetail, DataRoom
│       └── components/  NavBar, ProgressBar, DeliverableRow, FilePanel, StatusBadge
├── .env.example     Environment variable template
└── README.md
```

## Data Persistence

- Database: `server/data/app.db` (SQLite, auto-created on first run)
- Uploaded files: `server/uploads/` (auto-created on first run)
- Both are gitignored and persist across restarts
