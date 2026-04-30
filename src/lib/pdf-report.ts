import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtNum, fmtPct, fmtMcap, fmtMcapUsd, fmtPrice, fmtVol } from "@/lib/format";

type AnyResult = any;

function safe(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return String(v);
  return String(v);
}

export function downloadTerminalPdf(result: AnyResult): void {
  const t = result.target;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(56, 189, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GLOBAL EQUITY TERMINAL", margin, 24);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toUTCString()}`, margin, 40);
  doc.text("rankaisolutions.tech", pageW - margin, 24, { align: "right" });
  doc.text("Informational only — not financial advice", pageW - margin, 40, { align: "right" });

  y = 90;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${t.symbol}  ${t.companyName ?? ""}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${t.fullExchange ?? t.exchange ?? "—"} · ${t.country ?? t.region ?? "—"} · ${t.currency ?? "—"} · ${t.sector ?? "—"} / ${t.industry ?? "—"}`,
    margin,
    y,
  );
  y += 24;

  // Recommendation card
  const rec = t.recommendation;
  const recColor: [number, number, number] =
    rec?.rec === "Buy" ? [22, 163, 74] : rec?.rec === "Avoid" ? [220, 38, 38] : [217, 119, 6];
  doc.setFillColor(...recColor);
  doc.roundedRect(margin, y, 120, 50, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RECOMMENDATION", margin + 10, y + 16);
  doc.setFontSize(20);
  doc.text(safe(rec?.rec ?? "—").toUpperCase(), margin + 10, y + 38);

  // Snapshot stats
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const stats: { label: string; value: string }[] = [
    { label: "Price", value: fmtPrice(t.price, t.currency) },
    { label: "5D", value: fmtPct(t.perf5d) },
    { label: "RSI(14)", value: fmtNum(t.rsi14, 1) },
    { label: "Mcap", value: fmtMcap(t.marketCap, t.currency) },
    { label: "Mcap (USD)", value: fmtMcapUsd(t.marketCapUsd) },
    { label: "Net Score", value: rec?.net != null ? `${rec.net}/10` : "—" },
  ];
  let sx = margin + 140;
  let sy = y + 14;
  stats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = sx + col * 130;
    const cy = sy + row * 20;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text(s.label.toUpperCase(), cx, cy);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(s.value, cx, cy + 12);
  });
  y += 70;

  // Recommendation rationale
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Why this recommendation", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const rationale = `${t.companyName ?? t.symbol} on ${t.fullExchange ?? t.exchange ?? "global markets"} ${t.passesGlobal ? "meets" : "fails"} ${t.region} liquidity/size filters and ${t.passesValue ? "qualifies" : "does not qualify"} as a value candidate. Momentum is ${String(t.outlook ?? "").toLowerCase() || "neutral"} with ${String(t.signal ?? "").toLowerCase() || "mixed"} signals. Net composite score is ${rec?.net ?? "—"}/10 (value ${rec?.valueScore ?? "—"}, momentum ${rec?.momentumScore ?? "—"}, penalties ${rec?.penalties ?? 0}). Confidence: ${rec?.confidence ?? "—"}. Horizon: ${rec?.horizon ?? "—"}.`;
  const wrapped = doc.splitTextToSize(rationale, pageW - margin * 2);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 12 + 10;

  // Fundamentals + technicals tables
  autoTable(doc, {
    startY: y,
    head: [["Fundamentals", "Value"]],
    body: [
      ["Price", fmtPrice(t.price, t.currency)],
      ["52W Low", fmtPrice(t.low52, t.currency)],
      ["52W High", fmtPrice(t.high52, t.currency)],
      ["% from 52W Low", fmtPct(t.pctFromLow)],
      ["P/E (TTM)", fmtNum(t.pe, 2)],
      ["Avg Volume", fmtVol(t.avgVolume)],
      ["Market Cap (Local)", fmtMcap(t.marketCap, t.currency)],
      ["Market Cap (USD)", fmtMcapUsd(t.marketCapUsd)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: margin, right: pageW / 2 + 6 },
    tableWidth: (pageW - margin * 2) / 2 - 6,
  });
  autoTable(doc, {
    startY: y,
    head: [["Technicals", "Value"]],
    body: [
      ["5D Performance", fmtPct(t.perf5d)],
      ["ROC(14)", fmtPct(t.roc14)],
      ["ROC(21)", fmtPct(t.roc21)],
      ["RSI(14)", fmtNum(t.rsi14, 1)],
      ["MA(20)", fmtPrice(t.ma20, t.currency)],
      ["MA(50)", fmtPrice(t.ma50, t.currency)],
      ["MA(200)", fmtPrice(t.ma200, t.currency)],
      ["Earnings Date", safe(t.earningsDate)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: pageW / 2 + 6, right: margin },
    tableWidth: (pageW - margin * 2) / 2 - 6,
  });
  // @ts-ignore lastAutoTable is added by jspdf-autotable
  y = (doc as any).lastAutoTable.finalY + 16;

  // Score breakdown
  if (rec) {
    autoTable(doc, {
      startY: y,
      head: [["Score Breakdown", "Value"]],
      body: [
        ["Value Score", `${rec.valueScore ?? "—"}`],
        ["Momentum Score", `${rec.momentumScore ?? "—"}`],
        ["Penalties", `${rec.penalties ?? 0}`],
        ["Net Composite", `${rec.net ?? "—"} / 10`],
        ["Recommendation", String(rec.rec ?? "—")],
        ["Confidence", String(rec.confidence ?? "—")],
        ["Horizon", String(rec.horizon ?? "—")],
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // Footer — disclaimer + attribution
  const pageH = doc.internal.pageSize.getHeight();
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  const footerText =
    "Informational only — not financial advice. Market data is provided by third-party sources (primarily Finimpulse) and remains the property of the originating exchanges and providers; it may be delayed, incomplete, or stale. AI-generated commentary, where included, is paraphrased and may contain errors — verify with cited sources. Trademarks belong to their respective owners.";
  const wrappedFooter = doc.splitTextToSize(footerText, pageW - margin * 2);
  doc.text(wrappedFooter, margin, pageH - 38);
  doc.text(`rankaisolutions.tech/terminal/${t.symbol}`, pageW - margin, pageH - 12, { align: "right" });
  doc.text(`Generated ${new Date().toUTCString()}`, margin, pageH - 12);

  doc.save(`${t.symbol}-equity-report.pdf`);
}
