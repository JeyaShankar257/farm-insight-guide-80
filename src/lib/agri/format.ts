export function formatKg(value: number | null) {
  if (value === null) return "Not available";
  return `${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatMoney(value: number | null) {
  if (value === null) return "Not available";
  const abs = Math.abs(value);
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${Math.round(value)}`;
}

export function formatMoneyExact(value: number | null) {
  if (value === null) return "—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatMonth(period: string) {
  const date = new Date(`${period}-01`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-IN", { month: "short" });
}

export function formatNumber(value: number | null, digits = 0) {
  if (value === null) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
