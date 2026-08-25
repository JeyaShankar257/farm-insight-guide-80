import type { Analysis, Anomaly, GroupPerformance, Insight, Trend } from "@/types/dataset";

type InsightInput = {
  totals: Analysis["totals"];
  byCrop: GroupPerformance[];
  byField: GroupPerformance[];
  trends: Record<string, Trend>;
  anomalies: Anomaly[];
};

const kg = (value: number) => `${Math.round(value).toLocaleString("en-IN")} kg`;
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/** Turns computed results into observation → evidence → interpretation → action. */
export function buildInsights({ byCrop, byField, trends, anomalies }: InsightInput): Insight[] {
  const insights: Insight[] = [];

  const anomaly = anomalies[0];
  if (anomaly) {
    const rainfall = trends["rainfall"];
    insights.push({
      id: "anomaly",
      priority: "high",
      title: `${anomaly.field} is outside its normal range`,
      observation: `${anomaly.field} recorded ${anomaly.value.toLocaleString("en-IN")} kg per acre of ${anomaly.crop} on ${anomaly.date}.`,
      evidence: anomaly.reason,
      interpretation:
        rainfall && rainfall.direction === "declining"
          ? "Rainfall was also falling over this period, so water availability may be part of the story."
          : "Rainfall and temperature were within their usual range, so the cause is likely on the ground.",
      action: `Review the irrigation and harvest records for ${anomaly.field} around ${anomaly.date}.`,
    });
  }

  const yieldTrend = trends["yieldPerAcre"];
  if (yieldTrend && yieldTrend.changePercent !== null && yieldTrend.direction !== "stable") {
    const falling = yieldTrend.direction === "declining";
    insights.push({
      id: "yield-trend",
      priority: falling ? "high" : "low",
      title: falling ? "Yield per acre is trending down" : "Yield per acre is trending up",
      observation: `Average yield per acre moved ${yieldTrend.changePercent}% between ${yieldTrend.points[0]?.period} and ${yieldTrend.points[yieldTrend.points.length - 1]?.period}.`,
      evidence: `Best period ${yieldTrend.bestPeriod?.period} at ${kg(yieldTrend.bestPeriod?.value ?? 0)} per acre, weakest ${yieldTrend.worstPeriod?.period} at ${kg(yieldTrend.worstPeriod?.value ?? 0)} per acre.`,
      interpretation: falling
        ? "A steady decline usually points to soil, water or input changes rather than a single bad week."
        : "Whatever changed recently is working in your favour.",
      action: falling
        ? "Compare your input records for the strongest and weakest periods above."
        : "Note what you did differently in the strongest period so you can repeat it.",
    });
  }

  const weakestField = byField[byField.length - 1];
  const strongestField = byField[0];
  if (weakestField && strongestField && weakestField.name !== strongestField.name) {
    insights.push({
      id: "field-gap",
      priority: "medium",
      title: `${weakestField.name} is your lowest-performing field`,
      observation: `${weakestField.name} produced ${Math.round(weakestField.yieldPerAcre ?? 0).toLocaleString("en-IN")} kg per acre against ${Math.round(strongestField.yieldPerAcre ?? 0).toLocaleString("en-IN")} kg per acre in ${strongestField.name}.`,
      evidence: `Based on ${weakestField.records} records covering ${weakestField.totalArea} acres and ${kg(weakestField.totalYield)} of harvest.`,
      interpretation: "A gap this wide between your own fields is usually worth checking before buying new inputs.",
      action: `Walk ${weakestField.name} and compare its soil and watering routine with ${strongestField.name}.`,
    });
  }

  const bestProfitCrop = [...byCrop]
    .filter((c) => c.profitPerAcre !== null)
    .sort((a, b) => (b.profitPerAcre ?? 0) - (a.profitPerAcre ?? 0))[0];
  if (bestProfitCrop) {
    insights.push({
      id: "crop-profit",
      priority: "low",
      title: `${bestProfitCrop.name} returns the most per acre`,
      observation: `${bestProfitCrop.name} returned ${money(bestProfitCrop.profitPerAcre ?? 0)} per acre in this dataset.`,
      evidence: `${kg(bestProfitCrop.totalYield)} harvested across ${bestProfitCrop.totalArea} acres, ${money(bestProfitCrop.profit ?? 0)} total.`,
      interpretation: "Prices and costs in this dataset favour this crop, though prices change between seasons.",
      action: "Keep this figure in mind when planning your next sowing mix.",
    });
  }

  const priceTrend = trends["price"];
  if (priceTrend && priceTrend.direction !== "stable" && priceTrend.changePercent !== null) {
    insights.push({
      id: "price-trend",
      priority: "medium",
      title: `Selling price is ${priceTrend.direction}`,
      observation: `Your average selling price moved ${priceTrend.changePercent}% across the recorded periods.`,
      evidence: `Highest ${priceTrend.bestPeriod?.period} at ₹${priceTrend.bestPeriod?.value}/kg, lowest ${priceTrend.worstPeriod?.period} at ₹${priceTrend.worstPeriod?.value}/kg.`,
      interpretation: "Price movement changes your profit even when yield stays the same.",
      action: "Check the price you are being offered against the best period above before you sell.",
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return insights.sort((a, b) => order[a.priority] - order[b.priority]);
}
