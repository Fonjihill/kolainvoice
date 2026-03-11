import { useEffect, useState } from "react";
import { useQuotes } from "../hooks/useQuotes";
import { useToast } from "../hooks/useToast";
import { getAllClients, type Client } from "../api/clients";
import { getCatalogue } from "../api/catalogue";
import {
  formatPriceInput,
  parsePriceInput,
} from "../lib/format";
import { Topbar } from "../App";
import type {
  QuoteLinePayload,
  CreateQuotePayload,
  UpdateQuotePayload,
  QuoteDetail,
} from "../api/quotes";
import type { NavigateFn } from "../App";

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

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Component ────────────────────────────────────
function QuoteForm({
  quoteId,
  onBack,
}: {
  quoteId?: number;
  mode?: string;
  onBack: () => void;
  onNavigate: NavigateFn;
}) {
  const store = useQuotes();
  const toast = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [catalogueItems, setCatalogueItems] = useState<
    { id: number; name: string; unit_price: number; unit: string; tva_applicable: boolean }[]
  >([]);

  const [clientId, setClientId] = useState<number | null>(null);
  const [object, setObject] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [validityDate, setValidityDate] = useState(addDaysISO(30));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!quoteId);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);

  const isEditing = !!quoteId;
  const isReadOnly = isEditing && quote !== null && quote.status !== "draft";

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  useEffect(() => {
    getAllClients(false).then(setClients).catch(() => {});
    getCatalogue(true).then(setCatalogueItems).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quoteId) return;
    setLoading(true);
    store
      .getById(quoteId)
      .then((q) => {
        setQuote(q);
        setClientId(q.client_id);
        setObject(q.object);
        setIssueDate(q.issue_date.split("T")[0]);
        setValidityDate(q.validity_date?.split("T")[0] ?? "");
        setNotes(q.notes);
        setLines(
          q.lines.map((l) => ({
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
  }, [quoteId]);

  // ── Calculations ──
  const subtotalHT = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tvaAmount = lines.reduce(
    (s, l) => s + Math.round(lineTotal(l) * l.tva_rate / 100),
    0,
  );
  const totalTTC = subtotalHT + tvaAmount;

  // ── Line helpers ──
  function updateLine(key: string, field: keyof LineRow, value: unknown) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => {
      return prev.filter((l) => l.key !== key);
    });
  }

  function addFromCatalogue(itemId: number) {
    const item = catalogueItems.find((c) => c.id === itemId);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        catalogue_id: item.id,
        description: item.name,
        quantity: 1,
        unit: item.unit,
        unit_price: item.unit_price,
        priceDisplay: formatPriceInput(item.unit_price),
        discount: 0,
        tva_rate: item.tva_applicable ? 19.25 : 0,
        sort_order: prev.length,
      },
    ]);
  }

  // ── Save ──
  async function handleSave() {
    if (!clientId) {
      setError("Veuillez selectionner un client.");
      return;
    }
    setSaving(true);
    setError(null);

    const linePayloads: QuoteLinePayload[] = lines
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
      if (isEditing && quote) {
        const payload: UpdateQuotePayload = {
          client_id: clientId,
          object,
          issue_date: issueDate,
          validity_date: validityDate || null,
          notes,
          lines: linePayloads,
        };
        await store.update(quote.id, payload);
        toast.show("Devis modifie");
      } else {
        const payload: CreateQuotePayload = {
          client_id: clientId,
          object,
          issue_date: issueDate,
          validity_date: validityDate || null,
          notes,
          lines: linePayloads,
        };
        await store.create(payload);
        toast.show("Devis cree");
      }
      onBack();
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <>
        <Topbar title="Devis" subtitle="Chargement..." />
        <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
          <div className="text-sm text-stone-400">Chargement...</div>
        </div>
      </>
    );
  }

  // ── Create / Edit form ──
  return (
    <>
      <Topbar
        title={isReadOnly ? "Consulter le devis" : isEditing ? "Modifier le devis" : "Nouveau devis"}
        subtitle={isEditing && quote ? quote.number : "Brouillon"}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={onBack}>
              ← {isReadOnly ? "Retour" : "Annuler"}
            </button>
            {!isReadOnly && (
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                Enregistrer
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {isReadOnly && (
          <div className="bg-blue-50 border border-blue-200 px-3.5 py-2.5 mb-4 text-[12px] text-blue-700">
            Ce devis est verrouille et ne peut plus etre modifie.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-sm p-3 mb-4">
            {error}
          </div>
        )}

        <fieldset disabled={isReadOnly} className="contents">
        <div
          className="grid items-start gap-[18px]"
          style={{ gridTemplateColumns: "1fr 280px" }}
        >
          {/* Left column */}
          <div>
            {/* Info section */}
            <div className="mb-5">
              <div className="section-title">Informations</div>
              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                    Client
                  </label>
                  <select
                    className="form-input"
                    value={clientId ?? ""}
                    onChange={(e) =>
                      setClientId(e.target.value ? +e.target.value : null)
                    }
                  >
                    <option value="">-- Selectionner --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                    Numero
                  </label>
                  <input
                    className="form-input bg-stone-100 cursor-not-allowed"
                    value={isEditing && quote ? quote.number : "Auto"}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                    Objet du devis
                  </label>
                  <input
                    className="form-input"
                    value={object}
                    onChange={(e) => setObject(e.target.value)}
                    placeholder="Ex: Refonte site vitrine"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                    Date emission
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
                    Valide jusqu'au
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Lines table */}
            <div className="mb-5">
              <div className="section-title">Lignes</div>
              <div className="bg-white border border-stone-200 overflow-hidden">
                <table className="lines-table w-full border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200">
                      <th className="text-left px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "33%" }}>Description</th>
                      <th className="text-center px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "7%" }}>Qte</th>
                      <th className="text-left px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "10%" }}>Unite</th>
                      <th className="text-right px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "15%" }}>Prix unit.</th>
                      <th className="text-center px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "9%" }}>Remise%</th>
                      <th className="text-center px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "8%" }}>TVA%</th>
                      <th className="text-right px-2.5 py-2 text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500" style={{ width: "13%" }}>Total HT</th>
                      <th className="px-2.5 py-2" style={{ width: "4%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} className="border-b border-stone-100">
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input text-[13px]"
                            value={l.description}
                            onChange={(e) => updateLine(l.key, "description", e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input font-mono text-center text-[13px]"
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.key, "quantity", parseFloat(e.target.value) || 1)}
                            style={{ width: "50px" }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input text-[13px]"
                            value={l.unit}
                            onChange={(e) => updateLine(l.key, "unit", e.target.value)}
                            placeholder="unite"
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input font-mono text-right text-[13px]"
                            value={l.priceDisplay}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = parsePriceInput(raw);
                              updateLine(l.key, "unit_price", val);
                              updateLine(l.key, "priceDisplay", raw);
                            }}
                            onBlur={() =>
                              updateLine(l.key, "priceDisplay", formatPriceInput(l.unit_price))
                            }
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input font-mono text-center text-[13px]"
                            type="number"
                            min={0}
                            max={100}
                            value={l.discount}
                            onChange={(e) => updateLine(l.key, "discount", parseFloat(e.target.value) || 0)}
                            style={{ width: "50px" }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            className="form-input font-mono text-center text-[13px]"
                            type="number"
                            value={l.tva_rate}
                            onChange={(e) => updateLine(l.key, "tva_rate", parseFloat(e.target.value) || 0)}
                            style={{ width: "50px" }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-[13px] font-semibold">
                          {fmt(lineTotal(l))}
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <button
                            onClick={() => removeLine(l.key)}
                            className="text-stone-400 hover:text-red-500 cursor-pointer bg-transparent border-none text-[12px]"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-2.5 py-2 border-t border-stone-200 bg-stone-50">
                  <button
                    onClick={() =>
                      setLines((prev) => [...prev, emptyLine(prev.length)])
                    }
                    className="btn-ghost btn-sm text-amber-700 text-[12px]"
                  >
                    + Ajouter ligne
                  </button>
                </div>
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
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-3.5 sticky top-0">
            <TotalsCard subtotal={subtotalHT} tva={tvaAmount} total={totalTTC} />

            {/* Catalogue shortcuts */}
            <div className="bg-white border border-stone-200 p-3.5 bg-stone-50">
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600 mb-2">
                Catalogue rapide
              </div>
              <div className="max-h-[180px] overflow-y-auto">
                {catalogueItems.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => addFromCatalogue(c.id)}
                    className="py-1.5 border-b border-stone-100 cursor-pointer text-[12px] text-stone-700 hover:text-amber-700 transition-colors"
                  >
                    + {c.name}{" "}
                    <span className="font-mono text-[11px] text-amber-700">
                      {fmt(c.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client info */}
            {selectedClient && (
              <div className="bg-white border border-stone-200 p-3.5">
                <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600 mb-2">
                  Client
                </div>
                <div className="text-[13px] font-semibold">{selectedClient.name}</div>
                {selectedClient.phone && (
                  <div className="text-[12px] text-stone-500">{selectedClient.phone}</div>
                )}
                {selectedClient.email && (
                  <div className="text-[12px] text-stone-500">{selectedClient.email}</div>
                )}
              </div>
            )}
          </div>
        </div>
        </fieldset>
      </div>
    </>
  );
}

function TotalsCard({
  subtotal,
  tva,
  total,
}: {
  subtotal: number;
  tva: number;
  total: number;
}) {
  return (
    <div className="bg-white border border-stone-200 p-4">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-amber-700 mb-2.5">
        Recapitulatif
      </div>
      <div className="flex justify-between text-[13px] text-stone-600 mb-1.5">
        <span>Sous-total HT</span>
        <span className="font-mono font-semibold">{fmt(subtotal)} FCFA</span>
      </div>
      <div className="flex justify-between text-[13px] text-stone-600 mb-1.5">
        <span>TVA</span>
        <span className="font-mono font-semibold">{fmt(tva)} FCFA</span>
      </div>
      <div className="border-t border-stone-200 pt-2 mt-1 flex justify-between">
        <span className="text-[13px] font-bold text-stone-900">Total TTC</span>
        <span className="font-mono text-[19px] font-bold text-amber-700">
          {fmt(total)} FCFA
        </span>
      </div>
    </div>
  );
}

export default QuoteForm;
