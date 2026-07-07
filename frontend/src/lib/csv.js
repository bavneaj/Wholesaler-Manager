import { ddmmyyyy, inr } from "@/lib/format";

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function exportOrdersCsv(orders, wholesalerNameById) {
  const rows = orders.flatMap((o) =>
    (o.items || []).map((it) => ({
      order_id: o.id,
      wholesaler: wholesalerNameById[o.wholesaler_id] || "",
      date_ordered: ddmmyyyy(o.date_ordered),
      expected_delivery: ddmmyyyy(o.expected_delivery),
      actual_delivery: ddmmyyyy(o.actual_delivery),
      status: o.status,
      item: it.item,
      qty: it.qty,
      unit: it.unit,
      price: it.price,
      line_total: (Number(it.qty) || 0) * (Number(it.price) || 0),
      order_total: o.total,
      discrepancy: o.discrepancy || "",
      note: o.discrepancy_note || "",
    }))
  );
  download(`orders_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}

export function exportPaymentsCsv(payments, wholesalerNameById, orderById) {
  const rows = payments.map((p) => ({
    payment_id: p.id,
    date: ddmmyyyy(p.date),
    wholesaler: wholesalerNameById[p.wholesaler_id] || "",
    amount: p.amount,
    kind: p.kind,
    linked_order_id: p.order_id || "",
    linked_order_date: p.order_id && orderById[p.order_id] ? ddmmyyyy(orderById[p.order_id].date_ordered) : "",
    linked_order_total: p.order_id && orderById[p.order_id] ? orderById[p.order_id].total : "",
    note: p.note || "",
  }));
  download(`payments_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}

export { inr };
