import { useEffect, useState } from "react";
import { useQuotes } from "../hooks/useQuotes";
import { formatDate } from "../lib/format";
import { ConfirmModal } from "../components/ui/Modal";
import SlidePanel from "../components/ui/SlidePanel";
import { useToast } from "../hooks/useToast";
import { Topbar } from "../App";
import type { QuoteStatus, QuoteDetail } from "../api/quotes";
import { Search, FileText, Pencil, Eye, Download, Copy, ArrowRight } from "lucide-react";
import PrintDocument from "../components/print/PrintDocument";

// Valid status transitions (mirroring Rust backend)
const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "refused", "expired", "cancelled"],
  accepted: ["cancelled"],
  refused: [],
  expired: [],
  cancelled: [],
};

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-stone-100 text-stone-500 border border-stone-300",
  sent: "bg-blue-50 text-blue-600 border border-blue-600",
  accepted: "bg-green-50 text-green-600 border border-green-600",
  refused: "bg-red-50 text-red-600 border border-red-600",
  expired: "bg-amber-50 text-amber-600 border border-amber-600",
  cancelled: "bg-stone-100 text-stone-400 border border-stone-300",
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoye",
  accepted: "Accepte",
  refused: "Refuse",
  expired: "Expire",
  cancelled: "Annule",
};

function Quotes({
  onNavigate,
}: {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const store = useQuotes();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; number: string } | null>(null);
  const [search, setSearch] = useState("");
  const [viewQuote, setViewQuote] = useState<QuoteDetail | null>(null);
  const [printId, setPrintId] = useState<number | null>(null);

  useEffect(() => {
    store.fetch();
  }, [store.fetch]);

  const { quotes, loading, statusFilter } = store;

  // Counts per status
  const counts: Record<string, number> = {
    "": quotes.length,
    draft: quotes.filter((q) => q.status === "draft").length,
    sent: quotes.filter((q) => q.status === "sent").length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
    expired: quotes.filter((q) => q.status === "expired").length,
    refused: quotes.filter((q) => q.status === "refused").length,
  };

  // Search filter
  const filtered = search.trim()
    ? quotes.filter(
        (q) =>
          q.number.toLowerCase().includes(search.toLowerCase()) ||
          q.client_name.toLowerCase().includes(search.toLowerCase()) ||
          q.object.toLowerCase().includes(search.toLowerCase()),
      )
    : quotes;

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await store.remove(deleteTarget.id);
      toast.show("Devis supprime", "success");
    } catch (e) {
      toast.show(String(e), "error");
    }
    setDeleteTarget(null);
  }

  // All rows open the modal (like the mockup)
  async function handleRowClick(quoteId: number) {
    try {
      const detail = await store.getById(quoteId);
      setViewQuote(detail);
    } catch (e) {
      toast.show(String(e), "error");
    }
  }

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  async function handleStatusChange(newStatus: string) {
    if (!viewQuote) return;

    // For "accepted", show confirmation first
    if (newStatus === "accepted") {
      setConfirmAction({
        title: "Accepter le devis",
        message: `Confirmer l'acceptation du devis ${viewQuote.number} ? Le devis sera verrouille et ne pourra plus etre modifie.`,
        confirmLabel: "Accepter",
        onConfirm: async () => {
          try {
            const updated = await store.changeStatus(viewQuote.id, "accepted");
            toast.show("Devis accepte");
            setConfirmAction(null);
            // Prompt to create invoice
            setConfirmAction({
              title: "Creer la facture ?",
              message: `Le devis ${viewQuote.number} est maintenant accepte. Voulez-vous creer la facture correspondante ?`,
              confirmLabel: "Creer la facture",
              onConfirm: async () => {
                try {
                  const invoiceId = await store.convert(updated.id);
                  toast.show("Facture creee");
                  setConfirmAction(null);
                  setViewQuote(null);
                  onNavigate("invoice-form", { invoiceId });
                } catch (e) {
                  toast.show(String(e), "error");
                  setConfirmAction(null);
                }
              },
            });
          } catch (e) {
            toast.show(String(e), "error");
            setConfirmAction(null);
          }
        },
      });
      return;
    }

    // For cancellation, confirm
    if (newStatus === "cancelled") {
      setConfirmAction({
        title: "Annuler le devis",
        message: `Confirmer l'annulation du devis ${viewQuote.number} ? Cette action est irreversible.`,
        confirmLabel: "Annuler le devis",
        danger: true,
        onConfirm: async () => {
          try {
            await store.changeStatus(viewQuote.id, "cancelled");
            toast.show("Devis annule");
            setConfirmAction(null);
            setViewQuote(null);
          } catch (e) {
            toast.show(String(e), "error");
            setConfirmAction(null);
          }
        },
      });
      return;
    }

    // Other transitions (sent, refused, expired) — direct
    try {
      await store.changeStatus(viewQuote.id, newStatus);
      toast.show("Statut mis a jour");
      // Refresh the detail
      const updated = await store.getById(viewQuote.id);
      setViewQuote(updated);
    } catch (e) {
      toast.show(String(e), "error");
    }
  }

  async function handleConvert() {
    if (!viewQuote) return;
    if (viewQuote.invoice_id) {
      toast.show("Ce devis a deja ete converti", "error");
      return;
    }
    try {
      const invoiceId = await store.convert(viewQuote.id);
      toast.show("Facture creee");
      setViewQuote(null);
      onNavigate("invoice-form", { invoiceId });
    } catch (e) {
      toast.show(String(e), "error");
    }
  }

  async function handleDuplicate() {
    if (!viewQuote) return;
    try {
      const newQuote = await store.duplicate(viewQuote.id);
      toast.show(`Devis duplique : ${newQuote.number}`);
      setViewQuote(null);
      onNavigate("quote-form", { quoteId: newQuote.id });
    } catch (e) {
      toast.show(String(e), "error");
    }
  }

  return (
    <>
      <Topbar
        title="Devis"
        subtitle={`${quotes.length} devis au total`}
        actions={
          <button
            className="btn-primary"
            onClick={() => onNavigate("quote-form")}
          >
            + Nouveau devis
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-2.5 mb-[18px]">
          <StatCard label="En attente" value={String(counts.sent)} sub="Envoyes" />
          <StatCard label="Acceptes" value={String(counts.accepted)} sub="Total" color="green" />
          <StatCard label="Expires" value={String(counts.expired)} sub="A renouveler" color="amber" />
          <StatCard label="Refuses" value={String(counts.refused)} sub="Total" color="red" />
        </div>

        {/* Filters + Search */}
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          {[
            { value: "", label: "Tous" },
            { value: "draft", label: "Brouillon" },
            { value: "sent", label: "Envoyes" },
            { value: "accepted", label: "Acceptes" },
            { value: "expired", label: "Expires" },
            { value: "refused", label: "Refuses" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => store.setStatusFilter(tab.value)}
              className={`font-sans text-[12px] font-medium px-3 py-[5px] cursor-pointer border transition-all ${
                statusFilter === tab.value
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-500 border-stone-200 hover:bg-stone-100"
              }`}
            >
              {tab.label} ({counts[tab.value] ?? 0})
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-[7px] bg-white border border-stone-200 px-[11px] py-[5px]">
            <Search size={14} className="text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="font-sans text-[13px] border-none outline-none bg-transparent text-stone-900 w-[180px] placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-stone-200 overflow-hidden mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200">
                <Th>N° Devis</Th>
                <Th>Client</Th>
                <Th>Objet</Th>
                <Th>Emission</Th>
                <Th>Validite</Th>
                <Th align="right">Montant HT</Th>
                <Th>Statut</Th>
                <th className="px-3.5 py-[9px] w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-[60px] gap-2.5">
                      <FileText size={40} className="text-stone-300" />
                      <div className="text-[13px] text-stone-400">
                        {loading ? "Chargement..." : "Aucun devis"}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group transition-colors"
                    onClick={() => handleRowClick(q.id)}
                  >
                    <td className="px-3.5 py-[11px] font-mono text-[12px] text-amber-700 font-medium">
                      {q.number}
                    </td>
                    <td className="px-3.5 py-[11px]">
                      <div className="text-[13px] font-medium text-stone-800">
                        {q.client_name}
                      </div>
                    </td>
                    <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                      {q.object}
                    </td>
                    <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                      {formatDate(q.issue_date)}
                    </td>
                    <td className={`px-3.5 py-[11px] text-[12px] ${q.status === "expired" ? "text-red-600" : "text-stone-500"}`}>
                      {formatDate(q.validity_date)}
                    </td>
                    <td className="px-3.5 py-[11px] text-right font-mono text-[13px] font-semibold text-stone-900">
                      {fmt(q.subtotal)}
                    </td>
                    <td className="px-3.5 py-[11px]">
                      <span className={`badge ${STATUS_STYLES[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td
                      className="px-3.5 py-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <HoverBtn
                          label={<Pencil size={13} />}
                          title="Modifier"
                          onClick={() => onNavigate("quote-form", { quoteId: q.id })}
                        />
                        <HoverBtn
                          label={<Eye size={13} />}
                          title="Voir"
                          onClick={() => handleRowClick(q.id)}
                        />
                        <HoverBtn
                          label={<Download size={13} />}
                          title="PDF"
                          onClick={() => setPrintId(q.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="flex items-center gap-1 px-3.5 py-2.5 border-t border-stone-100 bg-white">
              <span className="text-[11px] text-stone-400 mr-auto">
                {filtered.length} devis
              </span>
            </div>
          )}
        </div>

        <ConfirmModal
          open={!!deleteTarget}
          title="Supprimer le devis"
          message={
            deleteTarget
              ? `Supprimer definitivement le devis ${deleteTarget.number} ?`
              : ""
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>

      {/* Detail modal */}
      {viewQuote && (
        <QuoteDetailModal
          quote={viewQuote}
          onClose={() => {
            setViewQuote(null);
            store.fetch();
          }}
          onEdit={() => {
            setViewQuote(null);
            onNavigate("quote-form", { quoteId: viewQuote.id });
          }}
          onPrint={() => setPrintId(viewQuote.id)}
          onStatusChange={handleStatusChange}
          onConvert={handleConvert}
          onDuplicate={handleDuplicate}
          onNavigate={onNavigate}
        />
      )}

      {/* Confirmation modal */}
      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirmer"}
        danger={confirmAction?.danger}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />

      {printId !== null && (
        <PrintDocument type="quote" id={printId} onClose={() => setPrintId(null)} />
      )}
    </>
  );
}

// ─── Quote Detail Modal ──────────────────────────
function QuoteDetailModal({
  quote,
  onClose,
  onEdit,
  onPrint,
  onStatusChange,
  onConvert,
  onDuplicate,
  onNavigate,
}: {
  quote: QuoteDetail;
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onStatusChange: (status: string) => void;
  onConvert: () => void;
  onDuplicate: () => void;
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const isDraft = quote.status === "draft";
  const isFrozen = !isDraft;
  const canConvert = quote.status === "accepted" && !quote.invoice_id;
  const hasInvoice = !!quote.invoice_id;
  const canDuplicate = ["refused", "expired", "cancelled"].includes(quote.status);
  const allowedTransitions = VALID_TRANSITIONS[quote.status] ?? [];

  return (
    <SlidePanel
      open
      onClose={onClose}
      title={`${quote.number} — ${quote.object}`}
      subtitle={`${quote.client_name}`}
      wide
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-secondary btn-sm" onClick={onPrint}>
            ⬇ PDF
          </button>
          {canDuplicate && (
            <button className="btn-secondary btn-sm" onClick={onDuplicate}>
              <span className="inline-flex items-center gap-1"><Copy size={13} /> Dupliquer</span>
            </button>
          )}
          {isDraft && (
            <button className="btn-primary btn-sm" onClick={onEdit}>
              <span className="inline-flex items-center gap-1"><Pencil size={13} /> Modifier</span>
            </button>
          )}
        </>
      }
    >
      {/* Frozen banner */}
      {isFrozen && !canDuplicate && (
        <div className="bg-blue-50 border border-blue-200 px-3.5 py-2.5 mb-4 text-[12px] text-blue-700">
          Ce devis est verrouille ({STATUS_LABELS[quote.status]}) et ne peut plus etre modifie.
        </div>
      )}

      {/* Invoice link banner */}
      {hasInvoice && (
        <div
          className="bg-green-50 border border-green-200 px-3.5 py-2.5 mb-4 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => {
            onClose();
            onNavigate("invoice-form", { invoiceId: quote.invoice_id });
          }}
        >
          <span className="text-[12px] text-green-700">
            Facture creee : <span className="font-mono font-bold">{quote.invoice_number}</span>
          </span>
          <span className="text-green-600 inline-flex items-center gap-1 text-[12px] font-medium">
            Voir la facture <ArrowRight size={12} />
          </span>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3.5 mb-[18px]">
        <div className="bg-stone-50 border border-stone-200 p-3.5">
          <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 mb-1.5">
            Client
          </div>
          <div className="text-[13px] font-bold">{quote.client_name}</div>
        </div>
        <div className="bg-stone-50 border border-stone-200 p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                Emission
              </div>
              <div className="text-[13px] font-semibold mt-1">
                {formatDate(quote.issue_date)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                Validite
              </div>
              <div
                className={`text-[13px] font-semibold mt-1 ${
                  quote.status === "expired" ? "text-red-600" : ""
                }`}
              >
                {formatDate(quote.validity_date)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lines table */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="text-left py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
              Description
            </th>
            <th className="text-center py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 w-14">
              Qte
            </th>
            <th className="text-left py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 w-16">
              Unite
            </th>
            <th className="text-right py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 w-24">
              Prix unit.
            </th>
            <th className="text-center py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 w-16">
              Remise
            </th>
            <th className="text-right py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 w-24">
              Total HT
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l) => {
            const ht = Math.round(
              l.quantity * l.unit_price * (1 - l.discount / 100),
            );
            return (
              <tr key={l.id} className="border-b border-stone-100">
                <td className="py-2.5 text-[13px]">{l.description}</td>
                <td className="py-2.5 text-center font-mono text-[13px]">
                  {l.quantity}
                </td>
                <td className="py-2.5 text-[12px] text-stone-500">
                  {/* unit not stored in line */}
                </td>
                <td className="py-2.5 text-right font-mono text-[13px]">
                  {fmt(l.unit_price)}
                </td>
                <td className="py-2.5 text-center font-mono text-[13px] text-amber-700">
                  {l.discount ? `${l.discount}%` : "—"}
                </td>
                <td className="py-2.5 text-right font-mono text-[13px] font-semibold">
                  {fmt(ht)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="bg-white border border-stone-200 p-4 w-[260px]">
          <div className="flex justify-between text-[13px] text-stone-600 mb-1.5">
            <span>Sous-total HT</span>
            <span className="font-mono font-semibold">
              {fmt(quote.subtotal)} FCFA
            </span>
          </div>
          <div className="flex justify-between text-[13px] text-stone-600 mb-1.5">
            <span>TVA</span>
            <span className="font-mono font-semibold">
              {fmt(quote.tva_amount)} FCFA
            </span>
          </div>
          <div className="border-t border-stone-200 pt-2 mt-1 flex justify-between">
            <span className="text-[13px] font-bold text-stone-900">
              Total TTC
            </span>
            <span className="font-mono text-[19px] font-bold text-amber-700">
              {fmt(quote.total)} FCFA
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div className="bg-stone-50 border border-stone-200 p-3.5 text-[12px] text-stone-600 mb-4">
          {quote.notes}
        </div>
      )}

      {/* Status transitions */}
      {allowedTransitions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-stone-400 mr-2">
            Changer statut :
          </span>
          {allowedTransitions.map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`btn-sm text-[12px] ${
                s === "cancelled" ? "btn-danger" : "btn-secondary"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Convert button (accepted, not yet converted) */}
      {canConvert && (
        <button className="btn-primary" onClick={onConvert}>
          → Convertir en facture
        </button>
      )}
    </SlidePanel>
  );
}

// ─── Sub-components ──────────────────────────────

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "center";
}) {
  return (
    <th
      className={`px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 ${
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  const topColor =
    color === "green"
      ? "border-t-green-600"
      : color === "red"
        ? "border-t-red-600"
        : color === "amber"
          ? "border-t-amber-500"
          : "border-t-amber-500";
  return (
    <div
      className={`bg-white border border-stone-200 border-t-[3px] ${topColor} px-4 py-3`}
    >
      <div className="stat-label">{label}</div>
      <div className="font-mono text-[17px] font-semibold text-stone-900 leading-none">
        {value}
      </div>
      <div className="text-[11px] text-stone-400 mt-[3px]">{sub}</div>
    </div>
  );
}

function HoverBtn({
  label,
  title,
  onClick,
  danger,
}: {
  label: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`bg-transparent border-none cursor-pointer px-1.5 py-1 text-[12px] font-sans hover:bg-stone-100 transition-colors ${
        danger
          ? "text-red-400 hover:text-red-600"
          : "text-stone-400 hover:text-stone-700"
      }`}
    >
      {label}
    </button>
  );
}

function fmt(n: number): string {
  return Math.round(n)
    .toLocaleString("fr-FR")
    .replace(/\u202f/g, " ");
}

export default Quotes;
