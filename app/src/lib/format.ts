/** Format an integer amount as FCFA: "1 250 000 FCFA" */
export function formatFCFA(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

/** Format an integer for input display: "1 250 000" (no suffix) */
export function formatPriceInput(value: number): string {
  if (value === 0) return "";
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Parse a formatted price string back to integer: "1 250 000" → 1250000 */
export function parsePriceInput(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}

/** Format ISO date to JJ/MM/AAAA: "2026-03-10" → "10/03/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("T")[0].split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/** Format ISO datetime to JJ/MM/AAAA HH:MM */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [datePart, timePart] = iso.split("T");
  const date = formatDate(datePart);
  if (!timePart) return date;
  const time = timePart.slice(0, 5); // HH:MM
  return `${date} ${time}`;
}
