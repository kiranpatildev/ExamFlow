# ExamFlow — College Answer Sheet Digitization & Evaluation System

ExamFlow is a locally-deployed system for digitalizing, managing, and evaluating college exam answer sheets. It runs entirely on the college LAN — no internet or cloud required.

---

## Architecture

- **Backend**: Django 4.2 + Django REST Framework + PostgreSQL
- **Frontend**: React 18 + Vite + Axios
- **Auth**: JWT (simplejwt) — Access: 60 min, Refresh: 7 days
- **Three roles**: Scanning Staff, Teacher, Exam Department

---

## Setup Instructions

### Step 1 — Install PostgreSQL

1. Download and install PostgreSQL 15 from https://www.postgresql.org/download/
2. During installation, set a password for the `postgres` user.
3. Open **pgAdmin**, connect to the server, and create a database named `examflow`.

---

### Step 2 — Backend Setup

Open a terminal (Command Prompt or PowerShell) in the `backend/` folder.

```bash
# 3. Create a virtual environment
python -m venv venv

# 4. Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# 5. Install all dependencies
pip install -r requirements.txt

# 6. Copy the environment file and fill in your details
copy .env.example .env
```

Now open `.env` and fill in:
- `SECRET_KEY` — any long random string
- `DB_NAME=examflow`
- `DB_USER=postgres`
- `DB_PASSWORD=` — your PostgreSQL password
- `ALLOWED_HOSTS` — include your server's LAN IP (e.g. `localhost,127.0.0.1,192.168.1.100`)
- `CORS_ALLOWED_ORIGINS` — include the Vite frontend URL (e.g. `http://192.168.1.100:5173`)

```bash
# 7. Run database migrations
python manage.py migrate

# 8. Create the superuser / admin account
python manage.py createsuperuser

# 9. Start the backend server (accessible on LAN)
python manage.py runserver 0.0.0.0:8000
```

The backend is now running at `http://localhost:8000` and accessible on your LAN at `http://<server-ip>:8000`.

---

### Step 3 — Frontend Setup

Open a **second terminal** in the `frontend/` folder.

```bash
# 10. Install frontend dependencies
npm install

# 11. Copy and configure the environment file
copy .env.example .env
```

Open `frontend/.env` and set:
```
VITE_API_BASE_URL=http://192.168.1.100:8000
```
Replace `192.168.1.100` with your actual server's LAN IP address.

```bash
# 12. Start the frontend dev server (accessible on LAN)
npm run dev -- --host
```

---

### Step 4 — Access the App

The frontend will display URLs like:
```
Local:   http://localhost:5173
Network: http://192.168.1.100:5173
```

Other computers on the same WiFi/LAN can open `http://192.168.1.100:5173` in their browser.

---

## Login Portals

| Role | Login URL |
|------|-----------|
| Scanning Staff | `/login/scanning` |
| Teacher | `/login/teacher` |
| Exam Department | `/login/exam-dept` |

Create user accounts via Django admin at `http://localhost:8000/admin/` or using the createsuperuser command.

---

## User Roles & Features

### 📷 Scanning Staff
1. Create a bundle session by entering/scanning the QR code from the bundle cover.
2. Upload answer sheet images one by one — barcode is auto-detected on the first page.
3. Finalize each answer sheet (compiles images into a PDF).
4. Review finalized sheets and submit the bundle.

### 📝 Teacher
1. See all assigned answer sheets on the dashboard.
2. Click "Evaluate" to open the split-panel view: PDF on the left, marking form on the right.
3. Enter marks per question, review totals, and submit evaluation.

### 🏛️ Exam Department
1. **Dashboard**: Overview of all bundles and answer sheets with statistics.
2. **Assign Teachers**: Multi-select sheets and assign to teachers.
3. **Subjects & Schemes**: Full CRUD for subjects; dynamic marking scheme builder.
4. **Reports**: Filter results and export to Excel or PDF.

---

## Project Structure

```
examflow/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── examflow/          ← Django project settings
│   └── apps/
│       ├── users/          ← Custom User model + JWT auth
│       ├── subjects/       ← Subject + MarkingScheme
│       ├── bundles/        ← Bundle sessions
│       ├── answer_sheets/  ← Image upload, barcode, PDF, AnswerSheet
│       ├── evaluations/    ← EvaluationResult
│       └── reports/        ← Excel + PDF export
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api/            ← Axios wrappers for every endpoint
│       ├── context/        ← AuthContext with localStorage
│       ├── routes/         ← ProtectedRoute (role guard)
│       ├── pages/          ← All portal pages
│       └── components/     ← Shared UI components
└── README.md
```

---

## Media Files

Uploaded images (temporary) and compiled PDFs are stored under `backend/media/`:
- Temporary images: `media/tmp/{bundle_id}/{roll_number}/`
- Final PDFs: `media/answer_sheets/{bundle_id}/{roll_number}.pdf`

---

## Troubleshooting

**"Module not found" errors**: Make sure the virtual environment is activated before running Django commands.

**"Connection refused" on other PCs**: Ensure the backend is started with `0.0.0.0:8000` and the frontend with `--host`.

**Barcode not detected**: Ensure the barcode/QR code is clearly visible on the first page of the image. Avoid blur or low contrast.

**PostgreSQL connection error**: Check that PostgreSQL is running and the `.env` credentials match.
