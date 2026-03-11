import { useEffect, useRef, useState } from "react";
import { getSettings, type Settings } from "../../api/settings";
import { getClientById, type Client } from "../../api/clients";
import { getInvoiceById, type InvoiceDetail } from "../../api/invoices";
import { getQuoteById, type QuoteDetail } from "../../api/quotes";
import { getPaymentsForInvoice, type Payment } from "../../api/payments";
import { formatFCFA, formatDate } from "../../lib/format";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Printer, Download, X } from "lucide-react";

// ── Types ──────────────────────────────────────

interface PrintInvoiceProps {
  type: "invoice";
  id: number;
  onClose: () => void;
}

interface PrintQuoteProps {
  type: "quote";
  id: number;
  onClose: () => void;
}

interface PrintReceiptProps {
  type: "receipt";
  id: number;
  onClose: () => void;
}

type PrintDocumentProps = PrintInvoiceProps | PrintQuoteProps | PrintReceiptProps;

interface LineData {
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tva_rate: number;
  line_total: number;
}

// ── Helpers ────────────────────────────────────

function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  mtn_momo: "MTN Mobile Money",
  orange_money: "Orange Money",
  virement: "Virement bancaire",
  cheque: "Chèque",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "BROUILLON",
  sent: "ENVOYÉE",
  paid: "PAYÉE",
  cancelled: "ANNULÉE",
  accepted: "ACCEPTÉ",
  refused: "REFUSÉ",
  expired: "EXPIRÉ",
};

// ── PDF helpers (Rust backend) ─────────────────

async function writePdfAndOpen(bytes: number[], filePath: string, baseDir?: number) {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const data = new Uint8Array(bytes);
  if (baseDir !== undefined) {
    await writeFile(filePath, data, { baseDir });
  } else {
    await writeFile(filePath, data);
  }
  let fullPath = filePath;
  if (baseDir !== undefined) {
    const { tempDir } = await import("@tauri-apps/api/path");
    fullPath = `${await tempDir()}${filePath}`;
  }
  await invoke("open_file", { path: fullPath });
}

/** Print: generate PDF via Rust, save to temp, open with system viewer */
async function printPdf(docType: string, id: number, filename: string): Promise<void> {
  const bytes: number[] = await invoke("generate_document_pdf", { docType, id });
  const { BaseDirectory } = await import("@tauri-apps/plugin-fs");
  await writePdfAndOpen(bytes, filename, BaseDirectory.Temp);
}

/** Download: user picks save location, Rust generates PDF, write + open */
async function downloadPdf(docType: string, id: number, filename: string): Promise<void> {
  const filePath = await save({
    defaultPath: filename,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!filePath) return;
  const bytes: number[] = await invoke("generate_document_pdf", { docType, id });
  await writePdfAndOpen(bytes, filePath);
}

// ── Main component ─────────────────────────────

export default function PrintDocument(props: PrintDocumentProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setSettings(s);

        if (props.type === "invoice") {
          const inv = await getInvoiceById(props.id);
          setInvoice(inv);
          const c = await getClientById(inv.client_id);
          setClient(c);
        } else if (props.type === "quote") {
          const q = await getQuoteById(props.id);
          setQuote(q);
          const c = await getClientById(q.client_id);
          setClient(c);
        } else if (props.type === "receipt") {
          // Fetch payment via Rust, then load invoice + client for preview
          const p = await invoke<Payment>("get_payment_by_id", { id: props.id });
          setPayment(p);
          const inv = await getInvoiceById(p.invoice_id);
          setInvoice(inv);
          const c = await getClientById(inv.client_id);
          setClient(c);
          const allPayments = await getPaymentsForInvoice(p.invoice_id);
          setTotalPaid(allPayments.reduce((sum, pay) => sum + pay.amount, 0));
        }
      } catch (e) {
        console.error("Print data load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [props.type, props.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props.onClose]);

  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine filename for PDF operations
  const pdfFilename = props.type === "receipt"
    ? `${payment?.number ?? "receipt"}.pdf`
    : `${(props.type === "invoice" ? invoice : quote)?.number ?? "document"}.pdf`;

  async function handlePrint() {
    setBusy("print");
    setError(null);
    try {
      await printPdf(props.type, props.id, pdfFilename);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Impression: ${msg}`);
      console.error("Print failed:", e);
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy("download");
    setError(null);
    try {
      await downloadPdf(props.type, props.id, pdfFilename);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Telechargement: ${msg}`);
      console.error("PDF download failed:", e);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="print-overlay">
        <div style={{ margin: "auto", color: "#78716C", fontSize: 14 }}>Chargement...</div>
      </div>
    );
  }

  // ── Receipt render ──
  if (props.type === "receipt") {
    if (!payment || !invoice || !settings || !client) return null;
    const remaining = invoice.total - totalPaid;
    return (
      <div className="print-overlay" onClick={props.onClose}>
        <div className="print-toolbar no-print" onClick={(e) => e.stopPropagation()}>
          <button className="print-toolbar-btn" onClick={handlePrint} disabled={!!busy}>
            <Printer size={16} /> {busy === "print" ? "Ouverture..." : "Imprimer"}
          </button>
          <button className="print-toolbar-btn primary" onClick={handleDownload} disabled={!!busy}>
            <Download size={16} /> {busy === "download" ? "Enregistrement..." : "Télécharger PDF"}
          </button>
          <button className="print-toolbar-btn ghost" onClick={props.onClose}>
            <X size={16} /> Fermer
          </button>
          {error && (
            <div style={{ position: "absolute", bottom: -32, left: "50%", transform: "translateX(-50%)", background: "#DC2626", color: "white", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>
              {error}
            </div>
          )}
        </div>
        <div className="print-page" ref={pageRef} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="print-header">
            <div className="print-company">
              <div className="print-company-name">{settings.company_name || "Kola Invoice"}</div>
              {settings.company_address && <div className="print-company-line">{settings.company_address}</div>}
              {settings.company_phone && <div className="print-company-line">Tél: {settings.company_phone}</div>}
              {settings.company_email && <div className="print-company-line">{settings.company_email}</div>}
              {settings.company_niu && <div className="print-company-line">NIU: {settings.company_niu}</div>}
            </div>
            <div className="print-doc-title-block">
              <div className="print-doc-title">REÇU DE PAIEMENT</div>
              <div className="print-doc-number">{payment.number}</div>
            </div>
          </div>
          {/* Client */}
          <div className="print-info-row">
            <div className="print-info-box">
              <div className="print-info-label">Client</div>
              <div className="print-info-value bold">{client.name}</div>
              {client.address && <div className="print-info-value">{client.address}</div>}
              {client.phone && <div className="print-info-value">Tél: {client.phone}</div>}
            </div>
            <div className="print-info-box">
              <div className="print-dates">
                <div>
                  <div className="print-info-label">Date du paiement</div>
                  <div className="print-info-value bold">{formatDate(payment.payment_date)}</div>
                </div>
                <div>
                  <div className="print-info-label">Mode de paiement</div>
                  <div className="print-info-value bold">{PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Payment details */}
          <div style={{ margin: "24px 0", padding: "16px", border: "1px solid #D6D3D1", background: "#FAFAF9" }}>
            <div style={{ fontSize: 12, color: "#78716C", marginBottom: 12 }}>
              Paiement pour la facture <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{invoice.number}</span>
            </div>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 0", color: "#78716C" }}>Montant payé</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 16 }}>{formatFCFA(payment.amount)}</td>
                </tr>
                <tr style={{ borderTop: "1px solid #E7E5E4" }}>
                  <td style={{ padding: "6px 0", color: "#78716C" }}>Total facture</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace" }}>{formatFCFA(invoice.total)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0", color: "#78716C" }}>Cumul payé</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace" }}>{formatFCFA(totalPaid)}</td>
                </tr>
                <tr style={{ borderTop: "1px solid #D6D3D1" }}>
                  <td style={{ padding: "6px 0", fontWeight: 700 }}>{remaining <= 0 ? "FACTURE SOLDÉE" : "Reste à payer"}</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: remaining <= 0 ? "#16A34A" : "#D97706" }}>
                    {remaining <= 0 ? "0 FCFA" : formatFCFA(remaining)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Notes */}
          {payment.notes && (
            <div className="print-notes">
              <div className="print-notes-title">Notes</div>
              <div className="print-notes-text">{payment.notes}</div>
            </div>
          )}
          {/* Footer */}
          <div className="print-footer">
            <div>{settings.company_name}</div>
            {settings.company_niu && <div>NIU: {settings.company_niu}</div>}
            {settings.company_phone && <div>Tél: {settings.company_phone}</div>}
          </div>
        </div>
      </div>
    );
  }

  const isInvoice = props.type === "invoice";
  const doc = isInvoice ? invoice : quote;
  if (!doc || !settings || !client) return null;

  const docTitle = isInvoice ? "FACTURE" : "DEVIS";
  const docNumber = doc.number;
  const status = doc.status;
  const issueDate = formatDate(doc.issue_date);
  const secondDate = isInvoice
    ? formatDate((doc as InvoiceDetail).due_date)
    : formatDate((doc as QuoteDetail).validity_date);
  const secondDateLabel = isInvoice ? "Échéance" : "Validité";
  const lines: LineData[] = doc.lines;
  const notes = doc.notes;

  const isDraft = status === "draft";
  const showWatermark = isDraft && settings.pdf_watermark_draft;

  return (
    <div className="print-overlay" onClick={props.onClose}>
      {/* ── Action bar (hidden in print) ── */}
      <div className="print-toolbar no-print" onClick={(e) => e.stopPropagation()}>
        <button className="print-toolbar-btn" onClick={handlePrint} disabled={!!busy}>
          <Printer size={16} /> {busy === "print" ? "Ouverture..." : "Imprimer"}
        </button>
        <button
          className="print-toolbar-btn primary"
          onClick={handleDownload}
          disabled={!!busy}
        >
          <Download size={16} /> {busy === "download" ? "Enregistrement..." : "Télécharger PDF"}
        </button>
        <button className="print-toolbar-btn ghost" onClick={props.onClose}>
          <X size={16} /> Fermer
        </button>
        {error && (
          <div style={{ position: "absolute", bottom: -32, left: "50%", transform: "translateX(-50%)", background: "#DC2626", color: "white", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Document A4 (preview only — PDF is generated by Rust) ── */}
      <div className="print-page" ref={pageRef} onClick={(e) => e.stopPropagation()}>
        {/* Watermark */}
        {showWatermark && <div className="print-watermark">{STATUS_LABELS[status] ?? "BROUILLON"}</div>}

        {/* ── Header ── */}
        <div className="print-header">
          <div className="print-company">
            <div className="print-company-name">{settings.company_name || "Kola Invoice"}</div>
            {settings.company_address && <div className="print-company-line">{settings.company_address}</div>}
            {settings.company_phone && <div className="print-company-line">Tél: {settings.company_phone}</div>}
            {settings.company_email && <div className="print-company-line">{settings.company_email}</div>}
            {settings.company_niu && <div className="print-company-line">NIU: {settings.company_niu}</div>}
            {settings.company_rccm && <div className="print-company-line">RCCM: {settings.company_rccm}</div>}
          </div>
          <div className="print-doc-title-block">
            <div className="print-doc-title">{docTitle}</div>
            <div className="print-doc-number">{docNumber}</div>
            <div className="print-doc-status" data-status={status}>
              {STATUS_LABELS[status] ?? status}
            </div>
          </div>
        </div>

        {/* ── Client + Dates ── */}
        <div className="print-info-row">
          <div className="print-info-box">
            <div className="print-info-label">Client</div>
            <div className="print-info-value bold">{client.name}</div>
            {client.niu && <div className="print-info-value">NIU: {client.niu}</div>}
            {client.phone && <div className="print-info-value">Tél: {client.phone}</div>}
            {client.email && <div className="print-info-value">{client.email}</div>}
            {client.address && <div className="print-info-value">{client.address}</div>}
          </div>
          <div className="print-info-box">
            <div className="print-dates">
              <div>
                <div className="print-info-label">Date d'émission</div>
                <div className="print-info-value bold">{issueDate}</div>
              </div>
              <div>
                <div className="print-info-label">{secondDateLabel}</div>
                <div className="print-info-value bold">{secondDate}</div>
              </div>
              {isInvoice && (invoice as InvoiceDetail).payment_method && (
                <div>
                  <div className="print-info-label">Mode de paiement</div>
                  <div className="print-info-value">{(invoice as InvoiceDetail).payment_method}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Quote object ── */}
        {!isInvoice && (quote as QuoteDetail).object && (
          <div className="print-object">
            <span className="print-object-label">Objet :</span> {(quote as QuoteDetail).object}
          </div>
        )}

        {/* ── Lines table ── */}
        <table className="print-table">
          <thead>
            <tr>
              <th className="print-th" style={{ width: "40%" }}>Description</th>
              <th className="print-th center">Qté</th>
              <th className="print-th right">Prix unit.</th>
              <th className="print-th center">Remise</th>
              <th className="print-th center">TVA</th>
              <th className="print-th right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const ht = line.unit_price * line.quantity * (1 - line.discount / 100);
              return (
                <tr key={i}>
                  <td className="print-td">{line.description}</td>
                  <td className="print-td center mono">{line.quantity}</td>
                  <td className="print-td right mono">{fmt(line.unit_price)}</td>
                  <td className="print-td center mono">{line.discount ? `${line.discount}%` : "—"}</td>
                  <td className="print-td center mono">{line.tva_rate ? `${line.tva_rate}%` : "—"}</td>
                  <td className="print-td right mono bold">{fmt(Math.round(ht))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Totals ── */}
        <div className="print-totals-wrapper">
          <div className="print-totals">
            <div className="print-total-row">
              <span>Sous-total HT</span>
              <span className="mono">{formatFCFA(doc.subtotal)}</span>
            </div>
            <div className="print-total-row">
              <span>TVA</span>
              <span className="mono">{formatFCFA(doc.tva_amount)}</span>
            </div>
            <div className="print-total-row main">
              <span>Total TTC</span>
              <span className="mono">{formatFCFA(doc.total)}</span>
            </div>
            {isInvoice && (
              <div className="print-total-row paid">
                <span>Montant payé</span>
                <span className="mono">{formatFCFA((invoice as InvoiceDetail).amount_paid)}</span>
              </div>
            )}
            {isInvoice && (invoice as InvoiceDetail).amount_paid < doc.total && (
              <div className="print-total-row due">
                <span>Reste à payer</span>
                <span className="mono">{formatFCFA(doc.total - (invoice as InvoiceDetail).amount_paid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes ── */}
        {notes && (
          <div className="print-notes">
            <div className="print-notes-title">Notes</div>
            <div className="print-notes-text">{notes}</div>
          </div>
        )}

        {/* ── Bank details ── */}
        {isInvoice && settings.bank_name && (
          <div className="print-bank">
            <div className="print-bank-title">Coordonnées bancaires</div>
            <div className="print-bank-line">Banque: {settings.bank_name}</div>
            {settings.bank_account && <div className="print-bank-line">Compte: {settings.bank_account}</div>}
            {settings.bank_swift && <div className="print-bank-line">SWIFT: {settings.bank_swift}</div>}
          </div>
        )}

        {/* ── Default mentions ── */}
        {settings.default_mentions && (
          <div className="print-mentions">{settings.default_mentions}</div>
        )}

        {/* ── Footer ── */}
        <div className="print-footer">
          <div>{settings.company_name}</div>
          {settings.company_niu && <div>NIU: {settings.company_niu}</div>}
          {settings.company_phone && <div>Tél: {settings.company_phone}</div>}
        </div>
      </div>
    </div>
  );
}
