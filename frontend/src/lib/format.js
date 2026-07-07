export function inr(n) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ddmmyyyy(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
