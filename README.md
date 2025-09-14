# Zuno — AI Shopping Intelligence Copilot

Zuno is an AI-powered shopping copilot that helps you discover better deals, track prices over time, manage subscriptions, and optimize payments. It connects to your commerce footprint (via Knot or mock data), augments it with web/product intelligence, and uses LLMs to turn raw purchase data into actionable savings.

## Features

- Voice-first concierge: Chat with text or voice (Whisper STT toggle) → LLM answers
- Deal Hunter: Transaction-derived and web-enriched product picks from trusted merchants (Amazon, Target, Walmart), with concise LLM explanations
- Price Tracking: Create price watches from canonical IDs or product URLs; automatic background scans create alerts when items drop near your target; view price history
- Subscription Auditor: Detect recurring charges from your history; generate a ready-to-send cancellation email draft
- Payment Optimizer (stub): Simple, merchant-aware brand suggestion for which card to use

## Tech Stack

- Frontend: React + Vite + Tailwind + shadcn UI
- Backend: Flask (Python), LangChain/OpenAI-compatible LLM, optional Anthropic, APScheduler background jobs
- Storage: SQLite (`zuno.db`)

## Repository Layout

- `app.py` — Flask backend (API, schedulers, persistence)
- `src/` — React frontend
  - `pages/` — `Dashboard`, `DealHunter`, `PriceTracker`, `Subscriptions`, `Chat`, etc.
  - `components/` — UI components and widgets
- `requirements.txt` — Python deps
- `package.json` — Frontend deps/scripts
- `zuno.db` — SQLite database (created at runtime)

## Quick Start (Development)

1) Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # optional; fill what you have
# Fast dev boot without loading Whisper
SKIP_WHISPER=1 DEBUG=1 HOST=127.0.0.1 PORT=5001 python app.py
```

2) Frontend

```bash
npm install
npm run dev
# Open http://localhost:5173
```

Optional: set `VITE_API_BASE_URL=http://127.0.0.1:5001` in an `.env` file for the frontend if needed.

## Environment Variables

See `.env.example` for a full list. Common flags:

- Server: `HOST`, `PORT`, `DEBUG`, `USE_RELOADER`, `APP_ENV`
- Database: `DB_PATH` (defaults to `./zuno.db`)
- Scheduler: `SCHED_ENABLED`, `SCHED_INTERVAL_MIN`
- STT: `SKIP_WHISPER` (set to `1` to skip Whisper model load)
- LLM: `CEREBRAS_BASE_URL` + `CEREBRAS_API_KEY` (or `OPENAI_BASE_URL` + `OPENAI_API_KEY`)
- Anthropic (optional): `ANTHROPIC_API_KEY`
- Brave search (optional): `BRAVE_API_KEY`
- Knot (optional; mock fallback when missing): `KNOT_CLIENT_ID`, `KNOT_CLIENT_SECRET`, `KNOT_BASE_URL`

## Core Endpoints (Backend)

Health/LLM
- GET `/health` — server status
- GET `/llm/health` — model/env visibility
- POST `/llm/chat` — generic concierge chat; accepts `{ message, system?, history? }`

Deal Hunter
- POST `/dealhunter/search` — transactions-derived deals (mock fallback when Knot disabled)
- POST `/dealhunter/claude_search` — trusted-site web search + OG/price extraction + optional LLM ranking
- POST `/dealhunter/rag_search` — vague-intent handling + RAG/Anthropic expansion → `claude_search`

Knot
- GET `/knot/health` — `{ enabled, base_url }`
- GET `/knot/merchants`
- POST `/knot/transactions/sync`
- GET `/knot/amazon/transactions?mock=1` — convenience + mock fallback

Price Tracking
- POST `/price-protection/watch`
- GET `/price-protection/list?external_user_id=...`
- GET `/price-protection/watch/:id`, PATCH `/price-protection/watch/:id`, DELETE `/price-protection/watch/:id`
- POST `/price-protection/check` — run evaluation now
- GET `/price-protection/matches?external_user_id=...` — alerts

Product/History
- POST `/product/resolve` — URL → `{ title, price_usd, canonical }` (best-effort)
- GET `/price-history/list?canonical_id=...&since_days=365`
- POST `/price-history/seed_demo` — generate smooth demo series for all current watches
- POST `/price-history/backfill_wayback` — Wayback snapshots → price points
- POST `/price-history/llm_series` — LLM-estimated series (labeled)

Subscriptions
- POST `/subscriptions/audit` — recurring detection
- POST `/subscriptions/cancel_draft` — cancel email draft

Purchase (scaffold)
- POST `/purchase/preview` — build a preview quote for an item
- POST `/purchase/confirm` — confirm a preview (returns synthetic `order_id`)

## Using the App

- Dashboard: run quick tools (merchants, sync, audit) and inspect watches/matches JSON
- Deal Hunter: search, filter, and “Track price” for any result
- Price Tracker: add watches by canonical ID or paste a product URL; see alerts and charts
- Subscriptions: run audit and generate a cancel email draft
- Chat: ask Zuno to find deals, audit, or add a watch; try voice (if STT enabled)

## Data & Persistence

- SQLite tables are created on startup. Data persists in `zuno.db`.
- Background job (APScheduler) periodically evaluates watches and appends matches.

## Mock Mode & Fallbacks

- Without Knot credentials, endpoints return mock transaction data so demos keep working.
- Web search enrichment and Anthropic are fully optional.

## Production Notes

- Provide real LLM keys (`CEREBRAS_*` or `OPENAI_*`) and Knot credentials for live data.
- Consider a production WSGI server (e.g., gunicorn) and a managed DB.
- Respect robots and site ToS when enabling web product enrich.

## Troubleshooting

- Server boots but STT endpoints 503 — set `SKIP_WHISPER=0` and ensure transformers/torch installed (or keep disabled for speed)
- LLM errors — check `CEREBRAS_*` or `OPENAI_*` env; use `/llm/health`
- No deals in DealHunter — in mock mode, send empty `query` to see default items; set Knot creds for live data
- No matches — lower the target price or call `/price-protection/check` to trigger evaluation

## License

MIT (include your preferred license terms here).
