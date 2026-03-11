import { useEffect, useState } from "react";
import { useInvoices } from "../hooks/useInvoices";
import { formatDate } from "../lib/format";
import { ConfirmModal } from "../components/ui/Modal";
import { useToast } from "../hooks/useToast";
import { Topbar } from "../App";
import type { InvoiceStatus } from "../api/invoices";
import { Search, Receipt, Coins, Pencil, Download } from "lucide-react";
import PrintDocument from "../components/print/PrintDocument";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-stone-100 text-stone-500 border border-stone-300",
  sent: "bg-blue-50 text-blue-600 border border-blue-600",
  paid: "bg-green-50 text-green-600 border border-green-600",
  cancelled: "bg-red-50 text-red-600 border border-red-600",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  paid: "Payee",
  cancelled: "Annulee",
};

function Invoices({
  onNavigate,
}: {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const { invoices, loading, statusFilter, fetch, setStatusFilter, remove } =
    useInvoices();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    number: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [printId, setPrintId] = useState<number | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Stats
  const totalAmount = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const unpaidCount = invoices.filter((i) => i.status === "sent").length;
  const unpaidAmount = invoices
    .filter((i) => i.status === "sent")
    .reduce((s, i) => s + (i.total - i.amount_paid), 0);

  // Counts per status
  const counts: Record<string, number> = {
    "": invoices.length,
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    cancelled: invoices.filter((i) => i.status === "cancelled").length,
  };

  // Search filter
  const filtered = search.trim()
    ? invoices.filter(
        (i) =>
          i.number.toLowerCase().includes(search.toLowerCase()) ||
          i.client_name.toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      toast.show("Facture supprimee", "success");
    } catch (e) {
      toast.show(String(e), "error");
    }
    setDeleteTarget(null);
  }

  return (
    <>
      <Topbar
        title="Factures"
        subtitle={`${invoices.length} factures au total`}
        actions={
          <>
            <button className="btn-secondary btn-sm">⬇ Exporter</button>
            <button
              className="btn-primary"
              onClick={() => onNavigate("invoice-form", { mode: "direct-sale" })}
            >
              Vente directe
            </button>
            <button
              className="btn-primary"
              onClick={() => onNavigate("invoice-form")}
            >
              + Nouvelle facture
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-2.5 mb-[18px]">
          <StatCard label="Total" value={fmt(totalAmount)} sub="FCFA" />
          <StatCard
            label="Encaisse"
            value={fmt(totalPaid)}
            sub="FCFA"
            color="green"
          />
          <StatCard
            label="Impayes"
            value={fmt(unpaidAmount)}
            sub="FCFA"
            color="red"
          />
          <StatCard
            label="En retard"
            value={String(unpaidCount)}
            sub="factures"
            color="amber"
          />
        </div>

        {/* Filters + Search */}
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          {[
            { value: "", label: "Toutes" },
            { value: "draft", label: "Brouillon" },
            { value: "sent", label: "Envoyees" },
            { value: "paid", label: "Payees" },
            { value: "cancelled", label: "Annulees" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
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
                <Th>N° Facture</Th>
                <Th>Client</Th>
                <Th>Emission</Th>
                <Th>Echeance</Th>
                <Th align="right">Montant TTC</Th>
                <Th align="right">Paye</Th>
                <Th>Statut</Th>
                <th className="px-3.5 py-[9px] w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-[60px] gap-2.5">
                      <Receipt size={40} className="text-stone-300" />
                      <div className="text-[13px] text-stone-400">
                        {loading ? "Chargement..." : "Aucune facture"}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group transition-colors"
                    onClick={() =>
                      onNavigate("invoice-form", {
                        invoiceId: inv.id,
                        mode: inv.status === "draft" ? undefined : "view",
                      })
                    }
                  >
                    <td className="px-3.5 py-[11px] font-mono text-[12px] text-amber-700 font-medium">
                      {inv.number}
                    </td>
                    <td className="px-3.5 py-[11px]">
                      <div className="text-[13px] font-medium text-stone-800">
                        {inv.client_name}
                      </div>
                    </td>
                    <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                      {formatDate(inv.issue_date)}
                    </td>
                    <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-3.5 py-[11px] text-right font-mono text-[13px] font-semibold text-stone-900">
                      {fmt(inv.total)}
                    </td>
                    <td
                      className={`px-3.5 py-[11px] text-right font-mono text-[13px] font-semibold ${
                        inv.amount_paid >= inv.total && inv.amount_paid > 0
                          ? "text-green-600"
                          : inv.amount_paid > 0
                            ? "text-amber-600"
                            : "text-stone-400"
                      }`}
                    >
                      {fmt(inv.amount_paid || 0)}
                    </td>
                    <td className="px-3.5 py-[11px]">
                      {inv.status === "sent" && inv.amount_paid > 0 ? (
                        <span className="badge bg-amber-50 text-amber-600 border border-amber-500">
                          Partiellement payee
                        </span>
                      ) : (
                        <span
                          className={`badge ${STATUS_STYLES[inv.status]}`}
                        >
                          {STATUS_LABELS[inv.status]}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3.5 py-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <HoverBtn
                          label={<Pencil size={13} />}
                          title="Modifier"
                          onClick={() =>
                            onNavigate("invoice-form", { invoiceId: inv.id })
                          }
                        />
                        <HoverBtn label={<Download size={13} />} title="PDF" onClick={() => setPrintId(inv.id)} />
                        {inv.status === "sent" && (
                          <HoverBtn
                            label={<Coins size={14} />}
                            title="Paiement"
                            onClick={() =>
                              onNavigate("invoice-form", {
                                invoiceId: inv.id,
                                mode: "view",
                              })
                            }
                          />
                        )}
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
                {filtered.length} facture{filtered.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <ConfirmModal
          open={!!deleteTarget}
          title="Supprimer la facture"
          message={
            deleteTarget
              ? `Supprimer definitivement la facture ${deleteTarget.number} ?`
              : ""
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>

      {printId !== null && (
        <PrintDocument type="invoice" id={printId} onClose={() => setPrintId(null)} />
      )}
    </>
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

export default Invoices;
