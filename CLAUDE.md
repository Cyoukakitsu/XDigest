# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XDigest — a tool for tracking and summarizing X (Twitter) user activity. Users add X accounts to a watchlist, then fetch and read AI-generated summaries of their recent tweets, with a follow-up chat interface powered by OpenRouter.

## Development Commands

### Backend (FastAPI + Python)

```bash
cd backend
source venv/bin/activate

# Run dev server
uvicorn main:app --reload

# Run all tests
pytest

# Run a single test file
pytest tests/test_users.py

# Run a single test
pytest tests/test_users.py::test_add_user
```

### Frontend (React + Vite + Tailwind)

```bash
cd frontend

# Dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## Architecture

### Backend (`backend/`)

- **`main.py`** — FastAPI app. All routes live here. Reads/writes `users.json` for the watchlist and delegates to `scraper` and `ai` modules.
- **`scraper.py`** — Wraps `twikit` to log in to X and fetch a user's tweets from the last 24 hours. Login state is persisted in `cookies.json`.
- **`ai.py`** — Calls OpenRouter for both one-shot summarization and SSE streaming chat. Model is configurable via `OPENROUTER_MODEL`.
- **`twikit_patches.py`** — **Must be imported before `twikit`** (see `main.py` line 13). Monkey-patches two twikit 2.3.x breakages: `ClientTransaction.init` failure on X's changed JS bundle, and `User.__init__` `KeyError` on missing optional fields.

Persistent files at runtime: `backend/cookies.json` (X session), `backend/users.json` (watchlist).

### Frontend (`frontend/src/`)

- **`store.js`** — Zustand store. Single source of truth for: user list, selected user, fetched tweets, AI summary, and chat history.
- **`App.jsx`** — Root layout: `<Sidebar>` (left) + `<Summary>` + `<ChatBox>` (right column) + `<LoginModal>` overlay.
- All components read/write via `useStore`. API base URL comes from `VITE_API_URL` env var (default: `http://localhost:8000`).

### Data Flow

1. User adds an X username → `POST /api/users` → saved to `users.json`
2. User selects an account → `POST /api/fetch/{username}` → scraper fetches tweets → AI summarizes → returns `{tweets, summary}`
3. User chats → `POST /api/chat` with `{messages, tweets}` → SSE stream from OpenRouter → chunks appended to store via `appendAssistantChunk`

## Environment Variables

**`backend/.env`**
```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/auto   # any OpenRouter model slug
```

**`frontend/.env`**
```
VITE_API_URL=http://localhost:8000
```

## Testing Notes

Tests mock `scraper` and `ai` modules entirely via `conftest.py` (`patched_modules` fixture). The `USERS_PATH` is redirected to a `tmp_path` per test. No real X or OpenRouter calls are made in tests.
