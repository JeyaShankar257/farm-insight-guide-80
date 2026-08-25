# Farm Insights AI

# AgriInsight Project Overview

## 1. Project Summary

AgriInsight is a farmer-first decision-support platform. It converts a controlled agricultural CSV or XLSX dataset into crop, field, environmental, financial, and priority insights.

The farmer does not need to understand SQL, pandas, database schemas, or statistics. The farmer uploads farm data, views the results in a dashboard, checks the supporting evidence table, reads recommendations, and asks questions through the Gemini AI assistant.

The core principle is:

```text

Farm Data

    -> Dataset Validation

    -> Data Processing

    -> Agricultural Analysis

    -> Insights and Evidence

    -> Recommendations

    -> Farmer Decision

```

## 2. Main Product Flow

```text

Farmer

  -> React Frontend

  -> FastAPI Backend

  -> Dataset Validation

  -> pandas Analysis Engine

  -> Insights and Recommendations

  -> Dashboard and Evidence Table

  -> Gemini AI Assistant

```

The expected farmer workflow is:

1. Open the application.

2. Use demo data or upload a CSV/XLSX file.

3. The backend validates the file and its columns.

4. The backend profiles the dataset and reports data quality.

5. The analysis engine calculates crop, field, trend, and financial results.

6. The dashboard presents important farm information visually.

7. The evidence table displays the source and calculated records row by row.

8. The system creates priority alerts and evidence-based recommendations.

9. The farmer asks a natural-language question through the Gemini chatbot.

10. Gemini selects an approved analysis operation and explains the computed result.

## 3. Controlled Dataset Contract

AgriInsight uses one standard dataset structure. A downloadable CSV template should be provided to farmers.

### Required columns

- `record_date`

- `field_name`

- `crop_name`

- `area_acres`

- `yield_kg`

- `selling_price_per_kg`

- `total_cost`

- `rainfall_mm`

- `temperature_c`

- `season`

### Optional columns

- `production_kg`

- `soil_moisture_pct`

- `water_usage_liters`

- `seed_cost`

- `fertilizer_cost`

- `labor_cost`

- `transport_cost`

The standard format makes the system more reliable because the analysis engine knows which fields to expect. The application should reject incompatible files and explain missing or invalid columns clearly.

## 4. Backend Architecture

The backend is a modular FastAPI application.

```text

backend/app/

  main.py

  api/routes/

  models/

  services/

    ingestion.py

    profiling.py

    analysis.py

    insights.py

    charts.py

    llm/

  repositories/

```

### Backend responsibilities

- Receive uploaded files.

- Enforce file and row limits.

- Read CSV and XLSX files.

- Validate the canonical dataset structure.

- Validate row values and data types.

- Profile the dataset.

- Calculate agricultural metrics.

- Detect trends and anomalies.

- Generate priority insights.

- Create chart-ready response data.

- Validate Gemini analysis plans.

- Store metadata and files through Supabase.

### Current backend endpoints

```text

GET /health

POST /api/datasets/upload

```

The health endpoint confirms that the API is running. The upload endpoint currently reads the file, validates required columns and rows, and returns a dataset profile.

### Current upload protections

- CSV and XLSX file support

- 10 MB maximum upload size

- 100,000 maximum rows

- Empty-file rejection

- Empty-dataset rejection

- Unsupported-file rejection

- Basic parser error handling

- Missing-column reporting

- Invalid-row reporting

## 5. Dataset Profiling

After upload, the backend creates a profile containing:

- Row count

- Column count

- Column names

- Detected data types

- Null count

- Null percentage

- Sample values

- Available crops

- Available fields

- Earliest record date

- Latest record date

- Validation warnings

The farmer sees a simplified version of this information. Technical details such as pandas data types can remain in an advanced data-quality view.

## 6. Deterministic Analysis Engine

The analysis engine uses Python and pandas. Important numbers are never calculated by the AI model.

### Core calculations

```text

yield_per_acre = yield_kg / area_acres

revenue = production_kg * selling_price_per_kg

profit = revenue - total_cost

profit_per_acre = profit / area_acres

```

Revenue and profit should only be calculated when the required production and price data is available. The application must show that a metric is unavailable when its source data is missing.

### Crop and field analysis

The system can calculate:

- Total yield by crop

- Average yield per acre

- Total yield by field

- Field performance ranking

- Crop performance ranking

- Best-performing field

- Lowest-performing field

- Best-performing crop

- Lowest-performing crop

### Trend analysis

The system analyzes values over time, including:

- Yield trend

- Rainfall trend

- Temperature trend

- Profit trend

- Selling-price trend

- Increasing trends

- Declining trends

- Stable trends

- Sudden changes

- Best and worst periods

### Anomaly detection

The first implementation uses the IQR method for explainable outlier detection. It can identify unusual yield-per-acre values and report the affected field, crop, date, value, and reason.

Example:

> Field B has an unusual yield per acre compared with the normal range in this dataset.

The demo dataset contains a deliberately unusual Field B yield so the feature can be demonstrated consistently.

## 7. Insights and Recommendations

The insight engine converts computed results into farmer-friendly information.

Each insight should contain:

```text

Observation

  -> Evidence

  -> Possible interpretation

  -> Suggested action

```

Example:

> Field B yield decreased by 12 percent compared with the previous period. Rainfall was also lower during that period. Review irrigation and harvest records for Field B.

The system must distinguish between:

- Observed facts

- Possible interpretations

- Recommendations

Recommendations are data-informed review actions. They are not guaranteed agronomic prescriptions.

## 8. Frontend Architecture

The frontend will use React, Vite, TypeScript, Tailwind CSS, Recharts, and Lucide icons.

```text

frontend/src/

  app/

  components/

  features/

    upload/

    dashboard/

    evidence/

    chat/

  lib/

  types/

  styles/

```

### Frontend responsibilities

- Provide the farmer upload flow.

- Support prepared demo data.

- Display upload progress and errors.

- Show farm and crop summaries.

- Display charts returned by the backend.

- Show alerts and recommendations.

- Display the evidence table.

- Provide filters for crop, field, season, and date.

- Provide suggested chatbot questions.

- Display Gemini answers and supporting evidence.

- Work on desktop and mobile screens.

### Farmer start screen

The first screen should allow the farmer to:

- Use demo data.

- Upload a CSV/XLSX file.

- Download the dataset template.

- View supported file requirements.

- See upload progress.

- Understand validation errors without technical terminology.

### Farm dashboard

The dashboard should show:

- Selected crop

- Number of fields

- Total yield

- Average yield per acre

- Estimated revenue

- Estimated profit

- Latest data date

- High-priority alert

- Yield trend

- Field comparison

- Crop comparison

### Charts

Recharts can display:

- Yield over time

- Rainfall over time

- Temperature over time

- Profit over time

- Yield by field

- Yield by crop

- Profit per acre

- Selling-price trend

The dashboard and the evidence table must use the same backend results. This prevents the dashboard from showing numbers that differ from the detailed table.

### Evidence table

The evidence view should show source and calculated values such as:

- Date

- Field

- Crop

- Area

- Yield

- Yield per acre

- Rainfall

- Temperature

- Season

- Selling price

- Cost

- Revenue

- Profit

The table should support sorting, filtering, and anomaly highlighting.

## 9. Gemini AI Assistant

Gemini is the natural-language interface for the analysis engine.

The chatbot can answer questions such as:

- How is my rice crop performing?

- Which field has the best yield?

- Why did my profit decrease?

- Which field needs attention?

- Compare rice and maize.

- Show my rainfall trend.

- Which crop gives the highest profit per acre?

- What should I focus on first?

### Gemini request flow

```text

Farmer question

      -> Gemini understands intent

      -> Gemini creates a structured analysis plan

      -> FastAPI validates the plan

      -> pandas performs the calculation

      -> Backend returns actual values

      -> Gemini explains the result

      -> Frontend displays answer, evidence, and chart

```

Gemini receives:

- Farmer context

- Dataset profile

- Available columns

- Supported operations

- Computed analysis results

Gemini must not:

- Execute Python.

- Execute SQL.

- Invent missing data.

- Invent missing columns.

- Calculate unsupported metrics.

- Diagnose crop disease.

- Prescribe fertilizer.

- Make unsupported future predictions.

If Gemini is unavailable, deterministic templates should still display the analysis result and recommendation.

## 10. Supabase Usage

Supabase can provide:

- Farmer authentication

- Farm metadata

- Dataset metadata

- Insight storage

- Chat history

- Uploaded file storage

The Supabase service-role key must remain in the FastAPI backend. It must never be exposed to the React browser application.

For the hackathon, demo mode should remain available so Supabase or authentication problems do not block the presentation.

## 11. Project Characteristics

### Farmer-centered

The application answers the practical question:

> What should I pay attention to first?

### Data-grounded

Every important numeric result comes from deterministic Python and pandas calculations.

### Controlled

All uploaded datasets follow one documented structure.

### Explainable

Every important alert explains why it was generated and shows supporting evidence.

### Proactive

The dashboard automatically highlights trends, anomalies, and priority fields without requiring the farmer to know what question to ask.

### Modular

Ingestion, validation, profiling, analysis, insights, charts, storage, and AI integration remain separate backend responsibilities.

### Resilient

The core analysis works without Gemini. Gemini improves the conversation experience but is not the source of truth for numeric results.

### Accessible

The frontend should use:

- Large readable text

- Large buttons

- Simple charts

- Clear icons

- Local units

- Farmer-friendly language

- Mobile-first layouts

- English and Tamil readiness

## 12. Current Implementation Status

Implemented:

- FastAPI application

- Health endpoint

- CSV/XLSX reader

- File-size and row limits

- Required-column validation

- Row validation

- Dataset profiling

- Canonical Pydantic dataset model

- Basic deterministic metric calculations

- Initial crop-analysis service

- Demo dataset with a planted anomaly

- Dataset template

- Backend tests

Not yet implemented:

- React frontend

- Dashboard UI

- Evidence table UI

- Supabase persistence

- Supabase Storage integration

- Gemini chatbot integration

- Complete analysis API response

- Full insight and recommendation API

- End-to-end browser tests

- Deployment configuration

## 13. Recommended Implementation Sequence

1. Finalize the canonical dataset template and formulas.

2. Complete upload and row validation.

3. Complete the deterministic analysis API.

4. Add insight, recommendation, and chart response models.

5. Build the React upload screen.

6. Build the farmer dashboard.

7. Build the evidence table.

8. Add Supabase persistence and storage.

9. Add Gemini structured-plan integration.

10. Add chatbot responses and fallback templates.

11. Add integration and browser tests.

12. Add Docker and deployment configuration.

13. Rehearse the farmer demo using the prepared dataset.

## 14. Key Differentiator

AgriInsight is not only a CSV analyzer, chatbot, financial dashboard, or crop dashboard. It combines these capabilities into one farmer decision-support workflow.

The strongest technical message is:

> The farmer asks a practical question in simple language. Gemini selects the analysis, but pandas calculates the answer and the application shows the evidence.

create fronted leave backend but create whole structure for our project

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://farm-insight-guide-80.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/656138e9-cc45-49a6-84fa-d30252eee714).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
