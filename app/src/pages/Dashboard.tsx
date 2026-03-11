import { useEffect } from "react";
import { useInvoices } from "../hooks/useInvoices";
import { useQuotes } from "../hooks/useQuotes";
import { formatFCFA, formatDate } from "../lib/format";
import { Topbar } from "../App";
import type { InvoiceSummary } from "../api/invoices";
import type { QuoteSummary } from "../api/quotes";
import {
  Receipt,
  FileText,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

// ── Status labels ────────────────────────────────

const INV_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-stone-100 text-stone-500 border border-stone-300" },
  sent: { label: "Envoyee", cls: "bg-blue-50 text-blue-600 border border-blue-600" },
  paid: { label: "Payee", cls: "bg-green-50 text-green-600 border border-green-600" },
  cancelled: { label: "Annulee", cls: "bg-red-50 text-red-600 border border-red-600" },
};

const QUO_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-stone-100 text-stone-500 border border-stone-300" },
  sent: { label: "Envoye", cls: "bg-blue-50 text-blue-600 border border-blue-600" },
  accepted: { label: "Accepte", cls: "bg-green-50 text-green-600 border border-green-600" },
  refused: { label: "Refuse", cls: "bg-red-50 text-red-600 border border-red-600" },
  expired: { label: "Expire", cls: "bg-stone-100 text-stone-400 border border-stone-300" },
  cancelled: { label: "Annule", cls: "bg-red-50 text-red-600 border border-red-600" },
};

function Badge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const s = map[status] ?? { label: status, cls: "bg-stone-100 text-stone-500" };
  return (
    <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────

function isOverdue(inv: InvoiceSummary): boolean {
  if (inv.status !== "sent" || !inv.due_date) return false;
  return new Date(inv.due_date) < new Date();
}

// ── Component ───────────────────────────────────

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const invStore = useInvoices();
  const quoStore = useQuotes();

  useEffect(() => {
    invStore.fetch();
    quoStore.fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const invoices = invStore.invoices;
  const quotes = quoStore.quotes;

  // Stats
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const unpaidAmount = invoices
    .filter((i) => i.status === "sent")
    .reduce((s, i) => s + (i.total - i.amount_paid), 0);
  const overdueInvoices = invoices.filter(isOverdue);
  const overdueCount = overdueInvoices.length;

  // Recent invoices (5)
  const recentInvoices = invoices.slice(0, 5);

  // Recent quotes (all statuses)
  const recentQuotes = quotes.slice(0, 4);

  return (
    <>
      <Topbar
        title="Tableau de bord"
        subtitle={new Date().toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <>
            <button
              onClick={() => onNavigate("quote-form")}
              className="btn-secondary text-[13px]"
            >
              + Nouveau devis
            </button>
            <button
              onClick={() => onNavigate("invoice-form", { mode: "direct-sale" })}
              className="btn-primary text-[13px]"
            >
              Vente directe
            </button>
            <button
              onClick={() => onNavigate("invoice-form")}
              className="btn-primary text-[13px]"
            >
              + Nouvelle facture
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <StatCard
            label="Total facture"
            value={formatFCFA(totalInvoiced)}
            color="border-t-amber-500"
            icon={<Receipt size={14} className="text-amber-500" />}
          />
          <StatCard
            label="Encaisse"
            value={formatFCFA(totalPaid)}
            color="border-t-green-500"
            icon={<TrendingUp size={14} className="text-green-500" />}
          />
          <StatCard
            label="Impayes"
            value={formatFCFA(unpaidAmount)}
            color="border-t-red-500"
            icon={<Receipt size={14} className="text-red-500" />}
          />
          <StatCard
            label="En retard"
            value={String(overdueCount)}
            sub={`facture${overdueCount > 1 ? "s" : ""}`}
            color="border-t-orange-500"
            icon={<AlertTriangle size={14} className="text-orange-500" />}
          />
        </div>

        {/* ── Overdue alert ── */}
        {overdueInvoices.length > 0 && (
          <div className="bg-red-50 border border-red-200 px-4 py-3 mb-5">
            <div className="text-[12px] font-bold text-red-600 mb-1">
              {overdueInvoices.length} facture{overdueInvoices.length > 1 ? "s" : ""} en retard
            </div>
            <div className="text-[12px] text-stone-600">
              {overdueInvoices
                .slice(0, 3)
                .map((i) => `${i.number} (${i.client_name} — ${formatFCFA(i.total - i.amount_paid)})`)
                .join(" · ")}
              {overdueInvoices.length > 3 && ` · +${overdueInvoices.length - 3} autres`}
            </div>
          </div>
        )}

        {/* ── Two columns: quick actions + pending quotes ── */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Quick actions */}
          <div>
            <SectionTitle>Actions rapides</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction
                icon={<Receipt size={16} />}
                title="Nouvelle facture"
                sub="Brouillon"
                onClick={() => onNavigate("invoice-form")}
              />
              <QuickAction
                icon={<FileText size={16} />}
                title="Nouveau devis"
                sub="Avec validite"
                onClick={() => onNavigate("quote-form")}
              />
              <QuickAction
                icon={<Users size={16} />}
                title="Nouveau client"
                sub="Fiche complete"
                onClick={() => onNavigate("clients")}
              />
              <QuickAction
                icon={<Package size={16} />}
                title="Nouveau produit"
                sub="Au catalogue"
                onClick={() => onNavigate("catalogue")}
              />
            </div>
          </div>

          {/* Recent quotes */}
          <div>
            <SectionTitle>Devis recents</SectionTitle>
            {recentQuotes.length > 0 ? (
              <div className="bg-white border border-stone-200 overflow-hidden">
                <table className="w-full border-collapse">
                  <tbody>
                    {recentQuotes.map((q: QuoteSummary) => (
                      <tr
                        key={q.id}
                        className="border-b border-stone-100 last:border-b-0 cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => onNavigate("quotes")}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-amber-700">
                          {q.number}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-stone-700">
                          {q.client_name}
                        </td>
                        <td className="px-3 py-2.5 text-[13px] font-mono font-semibold text-right">
                          {formatFCFA(q.total)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge status={q.status} map={QUO_STATUS} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-stone-200 p-5 text-center text-[12px] text-stone-400">
                Aucun devis
              </div>
            )}
          </div>
        </div>

        {/* ── Recent invoices ── */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <SectionTitle>Factures recentes</SectionTitle>
            <button
              className="text-[12px] text-stone-500 hover:text-stone-700 flex items-center gap-1"
              onClick={() => onNavigate("invoices")}
            >
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div className="bg-white border border-stone-200 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200">
                  <th className="px-3.5 py-2 text-left text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    N° Facture
                  </th>
                  <th className="px-3.5 py-2 text-left text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    Client
                  </th>
                  <th className="px-3.5 py-2 text-right text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    Montant TTC
                  </th>
                  <th className="px-3.5 py-2 text-left text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    Statut
                  </th>
                  <th className="px-3.5 py-2 text-left text-[10px] font-bold tracking-wider uppercase text-stone-500">
                    Echeance
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length > 0 ? (
                  recentInvoices.map((inv: InvoiceSummary) => (
                    <tr
                      key={inv.id}
                      className="border-b border-stone-100 last:border-b-0 cursor-pointer hover:bg-stone-50 transition-colors"
                      onClick={() =>
                        onNavigate("invoice-form", { invoiceId: inv.id, mode: "view" })
                      }
                    >
                      <td className="px-3.5 py-2.5 text-[12px] font-mono font-medium text-amber-700">
                        {inv.number}
                      </td>
                      <td className="px-3.5 py-2.5 text-[13px] font-medium text-stone-800">
                        {inv.client_name}
                      </td>
                      <td className="px-3.5 py-2.5 text-[13px] font-mono font-semibold text-right">
                        {formatFCFA(inv.total)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Badge status={inv.status} map={INV_STATUS} />
                      </td>
                      <td
                        className={`px-3.5 py-2.5 text-[12px] ${
                          isOverdue(inv) ? "text-red-600 font-medium" : "text-stone-500"
                        }`}
                      >
                        {formatDate(inv.due_date)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-stone-400">
                      Aucune facture
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`bg-white border border-stone-200 border-t-[3px] ${color} px-4 py-3.5`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] font-bold tracking-wider uppercase text-stone-400">
          {label}
        </span>
      </div>
      <div className="font-mono text-[18px] font-semibold text-stone-900 leading-none">
        {value}
      </div>
      {sub && <div className="text-[11px] text-stone-400 mt-1">{sub}</div>}
    </div>
  );
}

function QuickAction({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-white border border-stone-200 px-3 py-3 flex items-center gap-2.5 cursor-pointer hover:border-amber-400 transition-colors"
      onClick={onClick}
    >
      <span className="text-stone-500">{icon}</span>
      <div>
        <div className="text-[12px] font-semibold text-stone-700">{title}</div>
        <div className="text-[11px] text-stone-400">{sub}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-wider uppercase text-stone-400 mb-2.5">
      {children}
    </div>
  );
}
