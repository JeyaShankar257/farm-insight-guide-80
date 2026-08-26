import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDatasetGroundingContext,
  isAgricultureQuestion,
  shouldAnswerQuestion,
} from "../src/lib/gemini-rules.ts";

test("accepts agriculture questions about the uploaded farm data", () => {
  const context = buildDatasetGroundingContext({
    datasetName: "Demo farm records",
    totals: { totalYield: 3400, avgYieldPerAcre: 1200, revenue: 56000, profit: 20000 },
    byField: [{ name: "North Field", yieldPerAcre: 1400 }],
    byCrop: [{ name: "Rice", yieldPerAcre: 1350 }],
    anomalies: [{ field: "North Field", crop: "Rice", reason: "Low yield" }],
  });

  assert.equal(isAgricultureQuestion("What is the yield trend in my rice field?"), true);
  assert.equal(shouldAnswerQuestion("What is the yield trend in my rice field?", context), true);
});

test("accepts general agriculture pricing questions", () => {
  assert.equal(isAgricultureQuestion("What is the cost of rice?"), true);
  assert.equal(shouldAnswerQuestion("What is the cost of rice?", "No uploaded farm dataset is loaded."), true);
});

test("rejects non-agriculture questions", () => {
  assert.equal(isAgricultureQuestion("What is the capital of India?"), false);
  assert.equal(
    shouldAnswerQuestion("What is the capital of India?", buildDatasetGroundingContext({ datasetName: "Demo farm records" })),
    false,
  );
});

test("refuses answers that are not grounded in uploaded data", () => {
  const context = buildDatasetGroundingContext({
    datasetName: "Demo farm records",
    totals: { totalYield: 3400, avgYieldPerAcre: 1200 },
  });

  assert.match(context, /Demo farm records/);
  assert.equal(
    shouldAnswerQuestion("Please suggest a holiday plan for my family.", context),
    false,
  );
});
