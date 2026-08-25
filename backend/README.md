# AgriInsight Backend

Standalone FastAPI service for CSV/XLSX validation and deterministic farm analysis.

The frontend reads `VITE_BACKEND_URL` for this service. Copy the repository
`.env.example` to `.env` when the backend runs somewhere other than the local
default `http://localhost:8000`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

In a second terminal, start the frontend from the repository root:

```powershell
npm run dev
```

Endpoints:

- `GET /health`
- `GET /api/database/check` verifies the configured Supabase connection
- `POST /api/datasets/upload` with multipart field `file`

For Supabase, copy `.env.example` to `.env`, replace the project URL and
backend secret key, then open `/api/database/check`. The backend must use a
secret or legacy service-role key; a publishable key is rejected intentionally.
Set `SUPABASE_PERSISTENCE_ENABLED=true` after the tables and private bucket are
ready. Enabled uploads save dataset metadata, source records, generated
insights, and the original file.

The service enforces the 10 MB and 100,000-row limits, validates the canonical columns and values, and returns profile, KPI, crop, field, and evidence data. It does not contain AI calculations; numeric results are produced by pandas.
