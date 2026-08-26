export type DatasetGroundingInput = {
  datasetName?: string;
  totals?: {
    totalYield?: number | null;
    avgYieldPerAcre?: number | null;
    revenue?: number | null;
    profit?: number | null;
    latestDate?: string | null;
    fieldCount?: number | null;
    cropCount?: number | null;
  };
  byField?: Array<{
    name?: string;
    yieldPerAcre?: number | null;
    profitPerAcre?: number | null;
  }>;
  byCrop?: Array<{
    name?: string;
    yieldPerAcre?: number | null;
    profitPerAcre?: number | null;
  }>;
  anomalies?: Array<{
    field?: string;
    crop?: string;
    reason?: string;
  }>;
};

const AGRICULTURE_KEYWORDS = [
  "crop",
  "crops",
  "farm",
  "field",
  "fields",
  "yield",
  "rainfall",
  "temperature",
  "soil",
  "irrigation",
  "fertilizer",
  "pest",
  "disease",
  "harvest",
  "season",
  "acre",
  "profit",
  "revenue",
  "cost",
  "water",
  "anomaly",
  "sowing",
  "planting",
  "rice",
  "wheat",
  "cotton",
  "sugarcane",
  "vegetable",
  "maize",
  "groundnut",
  "paddy",
  "yield per acre",
  "production",
  "spray",
  "fertility",
  "organic",
  "agri",
  "agriculture",
];

const DATASET_KEYWORDS = [
  "yield",
  "profit",
  "revenue",
  "field",
  "crop",
  "rainfall",
  "temperature",
  "soil",
  "harvest",
  "season",
  "acre",
  "anomaly",
  "dataset",
  "records",
  "farm",
  "my field",
  "my crop",
  "uploaded",
  "this dataset",
  "this farm",
];

const NON_AGRICULTURE_KEYWORDS = [
  "capital",
  "movie",
  "song",
  "football",
  "politics",
  "stock",
  "crypto",
  "travel",
  "holiday",
  "birthday",
  "recipe",
  "math",
  "physics",
  "history",
  "weather forecast",
  "news",
  "joke",
  "greeting",
];

export function isAgricultureQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return false;

  const hasAgricultureKeyword = AGRICULTURE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasRestrictedTopic = NON_AGRICULTURE_KEYWORDS.some((keyword) => normalized.includes(keyword));

  return hasAgricultureKeyword && !hasRestrictedTopic;
}

export function buildDatasetGroundingContext(input: DatasetGroundingInput = {}): string {
  const lines: string[] = [];

  if (input.datasetName) {
    lines.push(`Dataset: ${input.datasetName}`);
  }

  if (input.totals?.totalYield != null) {
    lines.push(`Total yield: ${Number(input.totals.totalYield).toLocaleString("en-IN")} kg`);
  }
  if (input.totals?.avgYieldPerAcre != null) {
    lines.push(`Average yield per acre: ${Number(input.totals.avgYieldPerAcre).toLocaleString("en-IN")} kg/acre`);
  }
  if (input.totals?.revenue != null) {
    lines.push(`Revenue: ₹${Math.round(Number(input.totals.revenue)).toLocaleString("en-IN")}`);
  }
  if (input.totals?.profit != null) {
    lines.push(`Profit: ₹${Math.round(Number(input.totals.profit)).toLocaleString("en-IN")}`);
  }
  if (input.totals?.latestDate) {
    lines.push(`Latest record: ${input.totals.latestDate}`);
  }
  if (input.totals?.fieldCount != null) {
    lines.push(`Fields: ${input.totals.fieldCount}`);
  }
  if (input.totals?.cropCount != null) {
    lines.push(`Crops: ${input.totals.cropCount}`);
  }

  if (input.byField?.length) {
    const topField = input.byField.slice(0, 3).map((field) => {
      const name = field.name ?? "Unknown field";
      const yieldText = field.yieldPerAcre != null ? `${Math.round(field.yieldPerAcre)} kg/acre` : "unknown";
      return `${name} (${yieldText})`;
    });
    lines.push(`Top field performance: ${topField.join("; ")}`);
  }

  if (input.byCrop?.length) {
    const topCrop = input.byCrop.slice(0, 3).map((crop) => {
      const name = crop.name ?? "Unknown crop";
      const yieldText = crop.yieldPerAcre != null ? `${Math.round(crop.yieldPerAcre)} kg/acre` : "unknown";
      return `${name} (${yieldText})`;
    });
    lines.push(`Crop performance: ${topCrop.join("; ")}`);
  }

  if (input.anomalies?.length) {
    const anomalies = input.anomalies.slice(0, 3).map((item) => {
      const field = item.field ?? "unknown field";
      const crop = item.crop ?? "unknown crop";
      return `${field} / ${crop}: ${item.reason ?? "abnormal performance"}`;
    });
    lines.push(`Anomalies: ${anomalies.join("; ")}`);
  }

  if (!lines.length) {
    return "No uploaded farm dataset is loaded. Tell the user to upload a CSV or demo dataset before asking a farm-data question.";
  }

  return [
    "Use only this uploaded farm dataset when answering. Do not answer unrelated topics.",
    "Respond only with agriculture/farm-data information that is supported by the dataset above.",
    ...lines,
  ].join("\n");
}

export function shouldAnswerQuestion(question: string, datasetContext: string): boolean {
  const isAgriculture = isAgricultureQuestion(question);
  if (!isAgriculture) return false;

  const hasDatasetInfo = datasetContext.length > 0 && !datasetContext.includes("No uploaded farm dataset is loaded");
  const mentionsDatasetTerms = DATASET_KEYWORDS.some((keyword) => question.toLowerCase().includes(keyword));

  if (!mentionsDatasetTerms) {
    return true;
  }

  return hasDatasetInfo;
}
