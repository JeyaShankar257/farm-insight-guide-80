# AgriInsight — Project Task Tracker

> Agent reference file. Update status markers as work progresses.
>
> **Status key:**
> `[ ]` Queue &nbsp;|&nbsp; `[/]` In Progress &nbsp;|&nbsp; `[x]` Completed

---

## ✅ Completed

### Backend

- [x] FastAPI application skeleton (`main.py`, route structure)
- [x] `GET /health` endpoint
- [x] `POST /api/datasets/upload` endpoint (validation + profiling response)
- [x] CSV / XLSX upload reader — 10 MB and 100 k row limits enforced
- [x] Required-column validation and missing-column reporting
- [x] Row-level value and data-type validation
- [x] Dataset profiling (row count, column types, null stats, sample values, crops, fields, date range)
- [x] Canonical Pydantic dataset model
- [x] Initial deterministic crop-analysis service
- [x] Demo dataset with deliberately planted Field B anomaly
- [x] Backend unit tests (ingestion, validation, profiling, metrics)

### Frontend — Data layer (`src/lib/agri/` + `src/types/`)

- [x] Canonical TypeScript dataset contract — `FarmRecord`, `EvidenceRow`, `DatasetProfile`, `ValidationIssue`, `Dataset`, `Analysis`, `Insight`, `Trend`, `GroupPerformance`, `Anomaly` types (`dataset.ts`)
- [x] CSV parser and row validator — `splitCsv`, `validateRecords` (`parse.ts`)
- [x] Dataset profiler — `profileDataset` (`profile.ts`)
- [x] Full deterministic analysis engine — `analyseDataset`, `toEvidenceRows`, IQR anomaly detection, `groupBy`, `buildTrend` (`analysis.ts`)
- [x] Insight builder — observation → evidence → interpretation → action for anomaly, yield trend, field gap, crop profit, price trend (`insights.ts`)
- [x] React state store — `DatasetProvider`, `useDataset`, filter-aware re-analysis (`store.tsx`)
- [x] Backend API client — `uploadToBackend`, `loadDemoFromBackend`, backend response adapter (`api.ts`)
- [x] Demo CSV data embedded in frontend (`demo-data.ts`)
- [x] Format utilities (`format.ts`)

### Frontend — UI (`src/routes/index.tsx`)

- [x] Farmer upload / landing screen (demo button, CSV upload, error display, template download link)
- [x] Farm dashboard — KPI cards (total yield, avg yield/acre, revenue, profit)
- [x] Yield-per-acre area chart (Recharts, with gradient fill)
- [x] Field comparison bar chart (ranked, relative-width bars)
- [x] Priority insights panel (anomaly, yield trend, field gap, crop profit, price trend)
- [x] Evidence table (date, field, crop, yield/acre, profit; anomaly row highlight)
- [x] Crop / Field / Season filters (live re-analysis on change)
- [x] "New dataset" clear button

---

## ⚡ In Progress

- [x] `GET /api/datasets/demo` backend endpoint — serves the validated demo CSV through the same analysis pipeline
- [x] Full analysis API response shape — returns `evidence`, `byCrop`, `byField`, `trends`, `anomalies`, `insights`, and chart data

---

## ⏳ Queue

### Backend gaps (required for frontend to work end-to-end)

- [x] `GET /api/datasets/demo` endpoint — serve demo dataset through backend
- [x] Full analysis JSON response from `POST /api/datasets/upload` (trends, anomalies, insights, evidence, byCrop, byField)
- [x] `VITE_BACKEND_URL` environment variable documented / `.env.example` added

### Frontend — missing features

- [x] Crop comparison chart (average yield per acre by crop, bar chart)
- [x] Rainfall and temperature trend charts
- [x] Profit-per-acre trend chart
- [ ] Selling-price trend chart
- [ ] Full evidence table route (separate page with full sorting, all columns, pagination)
- [ ] Gemini chatbot panel (suggested questions, answer + evidence, offline fallback)
- [ ] Data quality / profiling view (null stats, column types, warnings)
- [ ] Mobile layout polish (responsive breakpoints for all dashboard sections)
- [ ] Tamil language readiness

### Persistence & Auth

- [x] Supabase dataset and insight metadata storage
  - [x] Backend repository and opt-in upload persistence
  - [x] Enable and verify against the production Supabase project
  - [x] Dataset, record, and insight retrieval APIs
- [x] Supabase Storage for uploaded files (service-role key stays on backend only)
  - [x] Backend repository upload path
  - [x] Enable and verify against the production Supabase bucket
- [ ] Farmer authentication (Supabase Auth)
- [ ] Chat history persistence

### Infrastructure

- [ ] End-to-end browser tests (upload → dashboard → evidence → chat flow)
- [ ] Docker and deployment configuration
- [ ] Farmer demo rehearsal using prepared dataset
