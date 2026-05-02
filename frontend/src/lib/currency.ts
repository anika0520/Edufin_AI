// Indian Rupee formatting helpers.
// All monetary values across the app are stored in INR (rupees) and rendered
// with the ₹ symbol using the Indian numbering system (lakh / crore).

const inrFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** Full INR amount with grouping, e.g. ₹12,45,000 */
export function formatINR(value: number): string {
  return `₹${inrFormatter.format(Math.round(value))}`;
}

/**
 * Compact INR for tight UI (cards, axes, chips).
 * 1,23,000 → ₹1.23L · 2,50,00,000 → ₹2.5Cr · 8,500 → ₹8.5K
 */
export function formatINRCompact(value: number): string {
  const v = Math.round(value);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}₹${abs}`;
}
