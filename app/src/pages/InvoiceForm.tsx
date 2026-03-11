import { useEffect, useState } from "react";
import { useInvoices } from "../hooks/useInvoices";
import { usePayments } from "../hooks/usePayments";
import { useToast } from "../hooks/useToast";
import { getAllClients, getSystemClientId, type Client } from "../api/clients";
import { getCatalogue } from "../api/catalogue";
import { getSettings, type Settings } from "../api/settings";
import {
  formatFCFA,
  formatPriceInput,
  parsePriceInput,
} from "../lib/format";
import { Topbar } from "../App";
import type {
  InvoiceLinePayload,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  InvoiceDetail,
} from "../api/invoices";
import type { CreatePaymentPayload } from "../api/payments";
import PrintDocument from "../components/print/PrintDocument";
import { ConfirmModal } from "../components/ui/Modal";

// ── Line row state ───────────────────────────────
interface LineRow {
  key: string;
  catalogue_id: number | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  priceDisplay: string;
  discount: number;
  tva_rate: number;
  sort_order: number;
}

function emptyLine(sortOrder: number): LineRow {
  return {
    key: crypto.randomUUID(),
    catalogue_id: null,
    description: "",
    quantity: 1,
    unit: "",
    unit_price: 0,
    priceDisplay: "",
    discount: 0,
    tva_rate: 19.25,
    sort_order: sortOrder,
  };
}

function lineTotal(l: LineRow): number {
  return Math.round(l.quantity * l.unit_price * (1 - l.discount / 100));
}

function fmt(n: number): string {
  return Math.round(n)
    .toLocaleString("fr-FR")
    .replace(/\u202f/g, " ");
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Component ────────────────────────────────────
function InvoiceForm({
  invoiceId,
  mode,
  onBack,
  onNavigate,
}: {
  invoiceId?: number;
  mode?: string;
  onBack: () => void;
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const store = useInvoices();
  const paymentStore = usePayments();
  const toast = useToast();

  // Data sources
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogueItems, setCatalogueItems] = useState<
    { id: number; name: string; unit_price: number; unit: string; tva_applicable: boolean }[]
  >([]);
  const [, setSettings] = useState<Settings | null>(null);

  // Form state
  const [clientId, setClientId] = useState<number | null>(null);
  const [status, setStatus] = useState("draft");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("Paiement par virement ou Mobile Money sous 30 jours.");
  const [lines, setLines] = useState<LineRow[]>([]);

  const [payMethod, setPayMethod] = useState("cash");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!invoiceId);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [printReceiptId, setPrintReceiptId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);

  const isEditing = !!invoiceId;
  const isReadonly = mode === "view" && !!invoiceId;
  const isDirectSale = mode === "direct-sale";

  async function handleStatusChange(newStatus: string) {
    if (!invoiceId) return;
    try {
      await store.changeStatus(invoiceId, newStatus);
      const updated = await store.getById(invoiceId);
      setInvoice(updated);
      setStatus(updated.status);
      toast.show(
        newStatus === "sent" ? "Facture envoyée" : "Facture annulée",
        "success",
      );
    } catch (e) {
      toast.show(String(e), "error");
    }
    setConfirmAction(null);
  }

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  // ── Load data sources ──
  useEffect(() => {
    getAllClients(false).then(setClients).catch(() => {});
    getCatalogue(true).then(setCatalogueItems).catch(() => {});
    getSettings()
      .then((s) => {
        setSettings(s);
      })
      .catch(() => {});
  }, []);

  // ── Pre-fill system client for direct sale ──
  useEffect(() => {
    if (isDirectSale) {
      getSystemClientId().then((id) => setClientId(id));
    }
  }, [isDirectSale]);

  // ── Load invoice for edit/view/payment ──
  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    paymentStore.fetch(invoiceId);
    store
      .getById(invoiceId)
      .then((inv) => {
        setInvoice(inv);
        setClientId(inv.client_id);
        setStatus(inv.status);
        setIssueDate(inv.issue_date.split("T")[0]);
        setDueDate(inv.due_date?.split("T")[0] ?? "");
        setPayMethod(inv.payment_method ?? "cash");
        setNotes(inv.notes);
        setLines(
          inv.lines.map((l) => ({
            key: crypto.randomUUID(),
            catalogue_id: l.catalogue_id,
            description: l.description,
            quantity: l.quantity,
            unit: "",
            unit_price: l.unit_price,
            priceDisplay: formatPriceInput(l.unit_price),
            discount: l.discount,
            tva_rate: l.tva_rate,
            sort_order: l.sort_order,
          })),
        );
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [invoiceId]);

  // ── Line helpers ──
  function updateLine<K extends keyof LineRow>(index: number, key: K, value: LineRow[K]) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(prev.length)]);
  }

  function addFromCatalogue(catId: number) {
    const c = catalogueItems.find((x) => x.id === catId);
    if (!c) return;
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        catalogue_id: c.id,
        description: c.name,
        quantity: 1,
        unit: c.unit,
        unit_price: c.unit_price,
        priceDisplay: formatPriceInput(c.unit_price),
        discount: 0,
        tva_rate: c.tva_applicable ? 19.25 : 0,
        sort_order: prev.length,
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLinePriceChange(index: number, raw: string) {
    const value = parsePriceInput(raw);
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, unit_price: value, priceDisplay: formatPriceInput(value) } : l,
      ),
    );
  }

  // ── Totals ──
  const subtotalHT = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tvaAmount = lines.reduce(
    (s, l) => s + Math.round((lineTotal(l) * l.tva_rate) / 100),
    0,
  );
  const total = subtotalHT + tvaAmount;

  // ── Save ──
  async function handleSave() {
    if (!clientId) {
      setError("Veuillez selectionner un client.");
      return;
    }
    setSaving(true);
    setError(null);

    const linePayloads: InvoiceLinePayload[] = lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({
        catalogue_id: l.catalogue_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: l.discount,
        tva_rate: l.tva_rate,
        sort_order: i,
      }));

    try {
      if (isEditing && invoiceId) {
        const payload: UpdateInvoicePayload = {
          client_id: clientId,
          status,
          issue_date: issueDate,
          due_date: dueDate || null,
          payment_method: payMethod,
          notes,
          lines: linePayloads,
        };
        await store.update(invoiceId, payload);
        toast.show("Facture enregistree", "success");
        onNavigate("invoice-form", { invoiceId, mode: "view" });
      } else {
        const payload: CreateInvoicePayload = {
          client_id: clientId,
          status,
          issue_date: issueDate,
          due_date: dueDate || null,
          payment_method: payMethod,
          notes,
          lines: linePayloads,
        };
        const created = await store.create(payload);
        toast.show("Facture creee", "success");
        onNavigate("invoice-form", { invoiceId: created.id, mode: "view" });
      }
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  // ── Direct sale ──
  async function handleDirectSale() {
    if (!clientId) {
      setError("Veuillez selectionner un client.");
      return;
    }
    const linePayloads: InvoiceLinePayload[] = lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({
        catalogue_id: l.catalogue_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: l.discount,
        tva_rate: l.tva_rate,
        sort_order: i,
      }));

    if (linePayloads.length === 0) {
      setError("Ajoutez au moins une ligne.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await store.directSale({
        client_id: clientId,
        issue_date: issueDate,
        payment_method: payMethod,
        notes,
        lines: linePayloads,
      });
      toast.show("Vente enregistree", "success");
      onNavigate("invoice-form", { invoiceId: created.id, mode: "view" });
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <>
        <Topbar title="Facture" />
        <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
          <div className="text-sm text-stone-400">Chargement...</div>
        </div>
      </>
    );
  }

  // ── Readonly view (non-draft) ──
  if (isReadonly && invoice) {
    return (
      <>
        <Topbar
          title={invoice.number}
          subtitle={invoice.client_name}
          actions={
            <>
              <StatusBadge status={invoice.status} />
              <button className="btn-ghost btn-sm" onClick={onBack}>
                ← Retour
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setShowPrint(true)}>⬇ PDF</button>
              {invoice.status === "draft" && (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setConfirmAction({ action: "sent", label: "Envoyer cette facture ?" })}
                >
                  Envoyer
                </button>
              )}
              {(invoice.status === "draft" || invoice.status === "sent") && (
                <button
                  className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmAction({ action: "cancelled", label: "Annuler cette facture ? Cette action est irreversible." })}
                >
                  Annuler
                </button>
              )}
            </>
          }
        />
        <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
          <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: "1fr 300px" }}>
            <div className="space-y-5">
              {/* Client + dates info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-stone-50 border border-stone-200 p-4">
                  <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600 mb-2">
                    Client
                  </div>
                  <div className="text-[13px] font-bold">{invoice.client_name}</div>
                </div>
                <div className="bg-stone-50 border border-stone-200 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                        Emission
                      </div>
                      <div className="text-[13px] font-semibold mt-1">
                        {invoice.issue_date.split("T")[0]}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                        Echeance
                      </div>
                      <div className="text-[13px] font-semibold mt-1">
                        {invoice.due_date?.split("T")[0] ?? "—"}
                      </div>
                    </div>
                    {invoice.payment_method && (
                      <div>
                        <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                          Paiement
                        </div>
                        <div className="text-[12px] mt-1">{invoice.payment_method}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                        Paye
                      </div>
                      <div
                        className={`font-mono text-sm font-semibold mt-1 ${
                          invoice.amount_paid >= invoice.total
                            ? "text-green-600"
                            : invoice.amount_paid > 0
                              ? "text-amber-600"
                              : "text-stone-400"
                        }`}
                      >
                        {fmt(invoice.amount_paid || 0)} FCFA
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lines table */}
              <table className="lines-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: "center" }}>Qte</th>
                    <th>Unite</th>
                    <th style={{ textAlign: "right" }}>Prix unit.</th>
                    <th style={{ textAlign: "center" }}>Remise</th>
                    <th style={{ textAlign: "center" }}>TVA</th>
                    <th style={{ textAlign: "right" }}>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l) => {
                    const ht = Math.round(
                      l.unit_price * l.quantity * (1 - l.discount / 100),
                    );
                    return (
                      <tr key={l.id}>
                        <td>{l.description}</td>
                        <td className="text-center font-mono">{l.quantity}</td>
                        <td className="text-[12px] text-stone-500">—</td>
                        <td className="text-right font-mono">{fmt(l.unit_price)}</td>
                        <td className="text-center font-mono text-amber-700">
                          {l.discount ? `${l.discount}%` : "—"}
                        </td>
                        <td className="text-center font-mono text-stone-500">
                          {l.tva_rate ? `${l.tva_rate}%` : "—"}
                        </td>
                        <td className="text-right font-mono font-semibold">
                          {fmt(ht)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {invoice.notes && (
                <div className="bg-stone-50 border border-stone-200 p-4 text-[12px] text-stone-600">
                  {invoice.notes}
                </div>
              )}

              {/* Paiements section */}
              <div>
                <div className="section-title flex items-center justify-between">
                  <span>Paiements</span>
                  {invoice.status === "sent" && (
                    <button className="btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
                      + Enregistrer un paiement
                    </button>
                  )}
                </div>

                {paymentStore.payments.length > 0 ? (
                  <table className="lines-table">
                    <thead>
                      <tr>
                        <th>N° Recu</th>
                        <th>Date</th>
                        <th style={{ textAlign: "right" }}>Montant</th>
                        <th>Mode</th>
                        <th style={{ width: "4%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentStore.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono text-amber-700">{p.number}</td>
                          <td>{p.payment_date}</td>
                          <td className="text-right font-mono font-semibold">{fmt(p.amount)} FCFA</td>
                          <td className="text-[12px] text-stone-600">
                            {PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label ?? p.payment_method}
                          </td>
                          <td>
                            <button
                              className="btn-ghost btn-sm text-[11px]"
                              onClick={() => setPrintReceiptId(p.id)}
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-[12px] text-stone-400 py-3">Aucun paiement enregistre</div>
                )}

                {/* Partial payment summary */}
                {invoice.amount_paid > 0 && (
                  <div className={`mt-3 p-3 border text-[12px] ${
                    invoice.amount_paid >= invoice.total
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    <span className="font-semibold">
                      {invoice.amount_paid >= invoice.total ? "Facture soldee" : "Partiellement paye"}
                    </span>
                    {" — "}
                    <span className="font-mono">{fmt(invoice.amount_paid)} / {fmt(invoice.total)} FCFA</span>
                    {invoice.amount_paid < invoice.total && (
                      <span className="ml-2">(Reste : <span className="font-mono font-semibold">{fmt(invoice.total - invoice.amount_paid)} FCFA</span>)</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="flex flex-col gap-3.5 sticky top-0">
              <TotalsCard ht={invoice.subtotal} tva={invoice.tva_amount} ttc={invoice.total} />
            </div>
          </div>
        </div>
        {showPrint && invoiceId && (
          <PrintDocument type="invoice" id={invoiceId} onClose={() => setShowPrint(false)} />
        )}
        {showPayModal && invoice && (
          <PaymentModal
            invoice={invoice}
            onConfirm={async (payload) => {
              await paymentStore.add(payload);
              const updated = await store.getById(invoice.id);
              setInvoice(updated);
              toast.show("Paiement enregistre", "success");
            }}
            onClose={() => setShowPayModal(false)}
          />
        )}
        {printReceiptId && (
          <PrintDocument type="receipt" id={printReceiptId} onClose={() => setPrintReceiptId(null)} />
        )}
        <ConfirmModal
          open={!!confirmAction}
          title={confirmAction?.action === "sent" ? "Envoyer la facture" : "Annuler la facture"}
          message={confirmAction?.label ?? ""}
          confirmLabel={confirmAction?.action === "sent" ? "Envoyer" : "Annuler la facture"}
          danger={confirmAction?.action === "cancelled"}
          onConfirm={() => confirmAction && handleStatusChange(confirmAction.action)}
          onCancel={() => setConfirmAction(null)}
        />
      </>
    );
  }

  // ── Create / Edit form ──
  return (
    <>
      <Topbar
        title={isDirectSale ? "Vente directe" : isEditing ? "Modifier la facture" : "Nouvelle facture"}
        subtitle={isEditing ? invoice?.number ?? "" : "Brouillon — non enregistre"}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={onBack}>
              ← Annuler
            </button>
            {invoiceId && <button className="btn-secondary btn-sm" onClick={() => setShowPrint(true)}>Apercu PDF</button>}
            {isDirectSale ? (
              <button
                className="btn-primary"
                onClick={handleDirectSale}
                disabled={saving}
              >
                {saving ? "..." : "Encaisser"}
              </button>
            ) : (
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "..." : "Enregistrer"}
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* Quote origin banner */}
        {invoice?.quote_number && (
          <div className="bg-amber-50 border border-amber-200 px-3.5 py-2.5 mb-4 text-[12px] text-amber-700">
            Issu du devis <span className="font-mono font-bold">{invoice.quote_number}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-[12px] p-3 mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: "1fr 300px" }}>
          {/* LEFT — Form */}
          <div className="space-y-5">
            {/* Informations generales */}
            <div>
              <div className="section-title">Informations generales</div>
              <div className="grid grid-cols-2 gap-3.5">
                <FormField label="Numero">
                  <input
                    className="form-input font-mono"
                    value={invoice?.number ?? "Auto"}
                    readOnly
                  />
                </FormField>
                <FormField label="Client">
                  <select
                    className="form-input"
                    value={clientId ?? ""}
                    onChange={(e) =>
                      setClientId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">-- Selectionner --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Date emission">
                  <input
                    type="date"
                    className="form-input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </FormField>
                {!isDirectSale && (
                  <FormField label="Date echeance">
                    <input
                      type="date"
                      className="form-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </FormField>
                )}
                <FormField label="Mode de paiement">
                  <select
                    className="form-input"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            {/* Lignes de facturation */}
            <div>
              <div className="section-title">Lignes de facturation</div>
              <table className="lines-table">
                <thead>
                  <tr>
                    <th style={{ width: "32%" }}>Description</th>
                    <th style={{ width: "7%", textAlign: "center" }}>Qte</th>
                    <th style={{ width: "10%" }}>Unite</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Prix unit.</th>
                    <th style={{ width: "9%", textAlign: "center" }}>Remise%</th>
                    <th style={{ width: "8%", textAlign: "center" }}>TVA%</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Total HT</th>
                    <th style={{ width: "4%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const ht = lineTotal(line);
                    return (
                      <tr key={line.key}>
                        <td>
                          <input
                            className="form-input"
                            value={line.description}
                            onChange={(e) => updateLine(i, "description", e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td>
                          <input
                            className="form-input font-mono"
                            style={{ textAlign: "center", width: 50 }}
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(i, "quantity", parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={line.unit}
                            onChange={(e) => updateLine(i, "unit", e.target.value)}
                            placeholder="unite"
                          />
                        </td>
                        <td>
                          <input
                            className="form-input font-mono"
                            style={{ textAlign: "right" }}
                            value={line.priceDisplay}
                            onChange={(e) => handleLinePriceChange(i, e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input font-mono"
                            style={{ textAlign: "center", width: 50 }}
                            value={line.discount || 0}
                            onChange={(e) =>
                              updateLine(i, "discount", parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="form-input font-mono"
                            style={{ textAlign: "center", width: 50 }}
                            value={line.tva_rate}
                            onChange={(e) =>
                              updateLine(i, "tva_rate", parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td
                          className="font-mono font-semibold text-[13px] text-right"
                          style={{ padding: "8px 10px" }}
                        >
                          {fmt(ht)}
                        </td>
                        <td style={{ padding: "8px 4px" }}>
                          <button
                            onClick={() => removeLine(i)}
                            className="bg-transparent border-none cursor-pointer px-1.5 py-1 text-[12px] text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-2.5 py-2 border border-stone-200 border-t-0 bg-stone-50 flex gap-2">
                <button
                  className="btn-ghost btn-sm"
                  style={{ color: "#B45309" }}
                  onClick={addLine}
                >
                  + Ajouter ligne
                </button>
                <CatalogueDropdown items={catalogueItems} onAdd={addFromCatalogue} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="section-title">Notes</div>
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Paiements section (visible when editing an existing invoice) */}
            {isEditing && invoice && (
              <div>
                <div className="section-title flex items-center justify-between">
                  <span>Paiements</span>
                  {invoice.status === "sent" && (
                    <button className="btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
                      + Enregistrer un paiement
                    </button>
                  )}
                </div>

                {paymentStore.payments.length > 0 ? (
                  <table className="lines-table">
                    <thead>
                      <tr>
                        <th>N° Recu</th>
                        <th>Date</th>
                        <th style={{ textAlign: "right" }}>Montant</th>
                        <th>Mode</th>
                        <th style={{ width: "4%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentStore.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono text-amber-700">{p.number}</td>
                          <td>{p.payment_date}</td>
                          <td className="text-right font-mono font-semibold">{fmt(p.amount)} FCFA</td>
                          <td className="text-[12px] text-stone-600">
                            {PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label ?? p.payment_method}
                          </td>
                          <td>
                            <button
                              className="btn-ghost btn-sm text-[11px]"
                              onClick={() => setPrintReceiptId(p.id)}
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-[12px] text-stone-400 py-3">Aucun paiement enregistre</div>
                )}

                {/* Partial payment summary */}
                {invoice.amount_paid > 0 && (
                  <div className={`mt-3 p-3 border text-[12px] ${
                    invoice.amount_paid >= invoice.total
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    <span className="font-semibold">
                      {invoice.amount_paid >= invoice.total ? "Facture soldee" : "Partiellement paye"}
                    </span>
                    {" — "}
                    <span className="font-mono">{fmt(invoice.amount_paid)} / {fmt(invoice.total)} FCFA</span>
                    {invoice.amount_paid < invoice.total && (
                      <span className="ml-2">(Reste : <span className="font-mono font-semibold">{fmt(invoice.total - invoice.amount_paid)} FCFA</span>)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Sidebar */}
          <div className="flex flex-col gap-3.5 sticky top-0">
            {/* Totals */}
            <TotalsCard ht={subtotalHT} tva={tvaAmount} ttc={total} />

            {/* Catalogue shortcuts */}
            {catalogueItems.length > 0 && (
              <div className="bg-stone-50 border border-stone-200 p-4">
                <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600 mb-1.5">
                  Raccourcis catalogue
                </div>
                <div className="max-h-[160px] overflow-y-auto">
                  {catalogueItems.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => addFromCatalogue(c.id)}
                      className="py-1.5 border-b border-stone-100 cursor-pointer text-[12px] text-stone-700 hover:text-stone-900"
                    >
                      + {c.name}{" "}
                      <span className="font-mono text-amber-700 text-[11px]">
                        {fmt(c.unit_price)} FCFA
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected client info */}
            <div className="bg-stone-50 border border-stone-200 p-4">
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-400 mb-2">
                Client selectionne
              </div>
              {selectedClient ? (
                <>
                  <div className="text-[13px] font-semibold text-stone-900">
                    {selectedClient.name}
                  </div>
                  {selectedClient.niu && (
                    <div className="text-[12px] text-stone-500 mt-0.5">
                      NIU : {selectedClient.niu}
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="text-[12px] text-stone-500">
                      {selectedClient.phone}
                    </div>
                  )}
                  {selectedClient.email && (
                    <div className="text-[12px] text-stone-500">
                      {selectedClient.email}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[12px] text-stone-400">
                  Aucun client selectionne
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showPrint && invoiceId && (
        <PrintDocument type="invoice" id={invoiceId} onClose={() => setShowPrint(false)} />
      )}
      {showPayModal && invoice && (
        <PaymentModal
          invoice={invoice}
          onConfirm={async (payload) => {
            await paymentStore.add(payload);
            const updated = await store.getById(invoice.id);
            setInvoice(updated);
            toast.show("Paiement enregistre", "success");
          }}
          onClose={() => setShowPayModal(false)}
        />
      )}
      {printReceiptId && (
        <PrintDocument type="receipt" id={printReceiptId} onClose={() => setPrintReceiptId(null)} />
      )}
    </>
  );
}

// ── Shared sub-components ────────────────────────

const PAYMENT_METHODS = [
  { value: "cash", label: "Especes" },
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "orange_money", label: "Orange Money" },
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Cheque" },
];


function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function TotalsCard({ ht, tva, ttc }: { ht: number; tva: number; ttc: number }) {
  return (
    <div className="bg-white border border-stone-200 p-5">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-amber-700 mb-2.5">
        Recapitulatif
      </div>
      <div className="flex justify-between items-center py-1">
        <span className="text-[12px] text-stone-500">Sous-total HT</span>
        <span className="font-mono text-[13px] font-medium text-stone-900">
          {fmt(ht)} FCFA
        </span>
      </div>
      <div className="flex justify-between items-center py-1">
        <span className="text-[12px] text-stone-500">TVA</span>
        <span className="font-mono text-[13px] font-medium text-stone-900">
          {fmt(tva)} FCFA
        </span>
      </div>
      <div className="flex justify-between items-center pt-2.5 mt-1.5 border-t border-stone-200">
        <span className="text-[13px] font-bold text-stone-900">Total TTC</span>
        <span className="font-mono text-[19px] font-bold text-amber-700">
          {fmt(ttc)} FCFA
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-stone-100 text-stone-500 border-stone-300",
    sent: "bg-blue-50 text-blue-600 border-blue-600",
    paid: "bg-green-50 text-green-600 border-green-600",
    cancelled: "bg-red-50 text-red-600 border-red-600",
  };
  const labels: Record<string, string> = {
    draft: "Brouillon",
    sent: "Envoyee",
    paid: "Payee",
    cancelled: "Annulee",
  };
  return (
    <span
      className={`badge border ${styles[status] ?? styles.draft}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function CatalogueDropdown({
  items,
  onAdd,
}: {
  items: { id: number; name: string; unit_price: number }[];
  onAdd: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button
        className="btn-ghost btn-sm"
        style={{ color: "#A8A29E" }}
        onClick={() => setOpen(!open)}
      >
        + Depuis catalogue
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-stone-200 shadow-lg z-10 w-[280px] max-h-[200px] overflow-y-auto">
          {items.map((c) => (
            <div
              key={c.id}
              onClick={() => { onAdd(c.id); setOpen(false); }}
              className="px-3 py-2 text-[12px] text-stone-700 hover:bg-stone-50 cursor-pointer border-b border-stone-100"
            >
              {c.name}{" "}
              <span className="font-mono text-amber-700 text-[11px]">
                {fmt(c.unit_price)} FCFA
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentModal({
  invoice,
  onConfirm,
  onClose,
}: {
  invoice: InvoiceDetail;
  onConfirm: (payload: CreatePaymentPayload) => Promise<void>;
  onClose: () => void;
}) {
  const remaining = invoice.total - invoice.amount_paid;
  const [amount, setAmount] = useState(remaining);
  const [amountDisplay, setAmountDisplay] = useState(formatPriceInput(remaining));
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (amount <= 0) { setError("Le montant doit etre superieur a 0"); return; }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        invoice_id: invoice.id,
        amount,
        payment_method: method,
        payment_date: date,
        notes,
      });
      onClose();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white border border-stone-200 shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-stone-200">
          <div className="text-[14px] font-bold text-stone-900">Enregistrer un paiement</div>
          <div className="text-[12px] text-stone-500 mt-0.5">
            {invoice.number} — Reste a payer : <span className="font-mono font-semibold">{formatFCFA(remaining)}</span>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          {error && (
            <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-[12px] p-2.5">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3.5">
            <FormField label="Montant (FCFA)">
              <input
                type="text"
                inputMode="numeric"
                className="form-input font-mono"
                value={amountDisplay}
                onChange={(e) => {
                  const v = parsePriceInput(e.target.value);
                  setAmount(v);
                  setAmountDisplay(formatPriceInput(v));
                }}
              />
            </FormField>
            <FormField label="Mode de paiement">
              <select className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Date du paiement">
            <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="Notes (optionnel)">
            <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </div>
        <div className="px-5 py-3.5 border-t border-stone-200 flex justify-end gap-2">
          <button className="btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceForm;
