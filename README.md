# ◈ Aurora — AI-Powered Study Website (SQLite Edition)

An intelligent study platform where students can ask AI questions, upload notes, and take AI-generated quizzes.  
**Database: SQLite (zero-config, file-based — no MongoDB or database server needed!)**

---

## 🤖 AI Modules Implemented

| Module | AI Feature | How It Works |
|--------|-----------|--------------|
| **Chatbot Q&A** | Natural language Q&A | Claude API answers academic questions with context awareness |
| **Quiz Generator** | Auto MCQ generation | Claude generates quizzes from any topic or uploaded notes |

---

## 📁 Project Structure

```
aurora/
│
├── backend/                         # Node.js + Express API
│   ├── server.js                    # Main entry point
│   ├── .env.example                 # Environment variables template
│   ├── package.json
│   │
│   ├── database/
│   │   └── db.js                    # ⭐ SQLite setup (replaces MongoDB)
│   │                                #    study_assistant.sqlite auto-created on first run
│   │
│   ├── controllers/
│   │   ├── authController.js        # Register, Login, GetMe
│   │   ├── chatController.js        # ⭐ AI Chat (main AI module)
│   │   ├── quizController.js        # ⭐ AI Quiz generation
│   │   ├── notesController.js       # Upload PDF/TXT + manual notes
│   │   └── dashboardController.js   # Stats & recent activity
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── notes.js
│   │   ├── quiz.js
│   │   └── dashboard.js
│   │
│   └── middleware/
│       └── auth.js                  # JWT protection middleware
│
└── frontend/                        # React.js SPA (unchanged)
    ├── package.json
    └── src/
        ├── App.js
        ├── context/AuthContext.js
        ├── components/Layout/
        └── pages/
            ├── LoginPage.js
            ├── RegisterPage.js
            ├── DashboardPage.js
            ├── ChatPage.js
            ├── NotesPage.js
            ├── QuizPage.js
            └── QuizTakePage.js
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js v18+
- Anthropic API Key → https://console.anthropic.com
- **No MongoDB or database server needed!** SQLite is fully embedded.

---

### 1. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
JWT_SECRET=any_random_secret_string_here
ANTHROPIC_API_KEY=sk-ant-your-key-here
NODE_ENV=development
```

Start backend:
```bash
npm run dev
```

On first run, `study_assistant.sqlite` is automatically created in the `backend/` folder.  
No database setup, no connection strings, no servers to manage.

---

### 2. Setup Frontend

```bash
cd frontend
npm install
npm start
```

- Frontend: http://localhost:3000  
- Backend:  http://localhost:5000

---

## 🗄️ SQLite vs MongoDB — What Changed

| Aspect | Old (MongoDB) | New (SQLite) |
|--------|--------------|--------------|
| Installation | Separate MongoDB server required | Zero — embedded in the app |
| Configuration | `MONGODB_URI` in `.env` | Nothing needed |
| Data storage | Remote/local Mongo instance | `backend/study_assistant.sqlite` file |
| Library | `mongoose` | `sql.js` (pure JS, no native build) |
| Schema | Mongoose models (4 files) | SQL tables in `database/db.js` |
| Queries | Mongoose ORM methods | Raw SQL via helper functions |
| Data format | BSON documents | Relational tables with foreign keys |
| Backup | `mongodump` | Just copy the `.sqlite` file |

---

## 🗃️ Database Schema

```sql
users       — id, name, email, password, stats (chats/quizzes/notes/avg_score), timestamps
chats       — id, user_id (FK), title, subject, note_context, timestamps
messages    — id, chat_id (FK), role (user|assistant), content, created_at
notes       — id, user_id (FK), title, content, file_name, file_type, subject, word_count, timestamps
quizzes     — id, user_id (FK), title, topic, questions (JSON), score, attempted, time_taken, answers (JSON), timestamps
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET  | `/api/auth/me` | Get current user |

### Chat (AI ⭐)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/send` | Send message → get AI response |
| GET  | `/api/chat` | Get all chats |
| GET  | `/api/chat/:id` | Get chat with messages |
| DELETE | `/api/chat/:id` | Delete chat |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notes/upload` | Upload PDF/TXT |
| POST | `/api/notes` | Create note manually |
| GET  | `/api/notes` | Get all notes |
| GET  | `/api/notes/:id` | Get single note |
| DELETE | `/api/notes/:id` | Delete note |

### Quiz (AI ⭐)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quiz/generate` | AI generates quiz |
| POST | `/api/quiz/:id/submit` | Submit quiz answers |
| GET  | `/api/quiz` | Get all quizzes |
| GET  | `/api/quiz/:id` | Get quiz with questions |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/dashboard` | Get stats + recent activity |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Router v6, Axios |
| Styling | Custom CSS with CSS Variables |
| Backend | Node.js, Express.js |
| Database | **SQLite via sql.js** (replaces MongoDB) |
| Authentication | JWT + bcryptjs |
| AI | Anthropic Claude API |
| File Upload | Multer + pdf-parse |
| Notifications | react-hot-toast |
| Markdown | react-markdown |

---

## 💾 Backup & Data Management

Your entire database is a single file:
```
backend/study_assistant.sqlite
```

**Backup:** Just copy this file anywhere.  
**Reset:** Delete the file — it recreates automatically on next server start.  
**Inspect:** Open with [DB Browser for SQLite](https://sqlitebrowser.org/) (free GUI tool).

---

## 📌 How to Get Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Go to **API Keys** → Create new key
4. Copy and paste into your `.env` file

---

## 🌐 Publish online (share a public link)

GitHub stores your code and can host the **React UI** on **GitHub Pages**. Your **Express API + SQLite** cannot run on GitHub Pages — run them on a small Node host ([Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io), etc.). Use HTTPS everywhere.

### 1. Push this repo to GitHub

Create a new repository on GitHub, then from your machine:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Do **not** commit real API keys (keep using `.gitignore` for `.env` files).

### 2. Deploy the backend

On your host, deploy the **`backend/`** folder as a Node web service:

- **Start command:** `npm start`
- **Environment variables:** copy from `backend/.env.example` into the host’s dashboard (real `JWT_SECRET`, `GEMINI_API_KEY` or `OPENROUTER_API_KEY`, etc.).
- **Production:** set `NODE_ENV=production`.
- **CORS:** set `FRONTEND_ORIGIN` to the exact browser origin users see when opening your site (no path). Examples:
  - GitHub Pages user site: `https://YOUR_USERNAME.github.io`
  - GitHub Pages project site still sends Origin `https://YOUR_USERNAME.github.io` — use that unless your provider differs.

Copy the service **HTTPS URL** (e.g. `https://your-api.onrender.com`) — that is your API root (**no** `/api` suffix).

**SQLite note:** Free tiers often use **ephemeral** disks — data may reset on redeploy. For persistent SQLite, use a plan or volume from your provider.

### 3. Deploy the frontend to GitHub Pages

1. Repo **Settings → Pages**: **Source** = **GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions**: add **`REACT_APP_API_URL`** = your backend HTTPS root (same value as step 2, e.g. `https://your-api.onrender.com`).
3. Push to **`main`** (or run the workflow manually). The workflow `.github/workflows/deploy-github-pages.yml` builds with **`REACT_APP_USE_HASH_ROUTER=true`** so routes look like `https://….github.io/your-repo/#/dashboard` (required for GitHub Pages without extra server rules).

After deployment, share your **Pages URL**. Registration/login and AI calls go from the browser to your hosted API.

### Optional: One URL only

If you build the frontend (`npm run build` in `frontend/`) and deploy **both** the `frontend/build` output and `backend/` together on one Node host, set `SERVE_FRONTEND=true`, `NODE_ENV=production`, and `FRONTEND_ORIGIN` to that same site’s origin — then you don’t need GitHub Pages for the UI.

---

## 👨‍💻 Author

Built as an AI-based university project.  
AI Module: Claude API integrated in Chat Q&A and Quiz Generation modules.  
Database: Migrated from MongoDB to SQLite for zero-config simplicity.
