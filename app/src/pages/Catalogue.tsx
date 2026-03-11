import { useEffect, useState } from "react";
import { useCatalogue } from "../hooks/useCatalogue";
import { formatFCFA } from "../lib/format";
import { Topbar } from "../App";
import SlidePanel from "../components/ui/SlidePanel";
import { useToast } from "../hooks/useToast";
import type { CatalogueItem, SaveCataloguePayload } from "../api/catalogue";
import { Search, Pencil } from "lucide-react";

function Catalogue({
  onNavigate: _,
}: {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const store = useCatalogue();
  const [filter, setFilter] = useState<string>("all");
  const [searchValue, setSearchValue] = useState("");
  const [editItem, setEditItem] = useState<CatalogueItem | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    store.setActiveOnly(false); // load all to allow filtering
    store.fetchCategories();
  }, []);

  // Filter items
  let filtered = store.items;
  if (filter === "actif") filtered = filtered.filter((i) => i.active);
  else if (filter === "inactif") filtered = filtered.filter((i) => !i.active);
  else if (filter !== "all") {
    const catId = parseInt(filter);
    filtered = filtered.filter((i) => i.category_id === catId);
  }
  if (searchValue.trim()) {
    const q = searchValue.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }

  const activeCount = store.items.filter((i) => i.active).length;
  const inactiveCount = store.items.filter((i) => !i.active).length;

  return (
    <>
      <Topbar
        title="Catalogue"
        subtitle={`${store.items.length} produits et services`}
        actions={
          <>
            <div className="flex items-center gap-[7px] bg-white border border-stone-200 px-[11px] py-[5px]">
              <Search size={14} className="text-stone-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Rechercher..."
                className="font-sans text-[13px] border-none outline-none bg-transparent text-stone-900 w-[180px] placeholder:text-stone-400"
              />
            </div>
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              + Nouveau produit
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          <FilterPill
            label={`Tous (${store.items.length})`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterPill
            label={`Actifs (${activeCount})`}
            active={filter === "actif"}
            onClick={() => setFilter("actif")}
          />
          <FilterPill
            label={`Inactifs (${inactiveCount})`}
            active={filter === "inactif"}
            onClick={() => setFilter("inactif")}
          />
          {store.categories.map((cat) => {
            const count = store.items.filter(
              (i) => i.category_id === cat.id,
            ).length;
            return (
              <FilterPill
                key={cat.id}
                label={`${cat.name} (${count})`}
                active={filter === String(cat.id)}
                onClick={() => setFilter(String(cat.id))}
              />
            );
          })}
        </div>

        {store.error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-sm p-3 mb-3.5">
            {store.error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-stone-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200">
                <th className="text-left px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Designation
                </th>
                <th className="text-left px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Categorie
                </th>
                <th className="text-left px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Unite
                </th>
                <th className="text-right px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Prix unitaire
                </th>
                <th className="text-center px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  TVA
                </th>
                <th className="text-center px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Statut
                </th>
                <th className="px-3.5 py-[9px] w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-[60px] gap-2.5">
                      <div className="text-4xl opacity-25">📦</div>
                      <div className="text-[13px] text-stone-400">
                        Aucun produit
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setEditItem(item)}
                    className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer group transition-colors ${
                      !item.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-3.5 py-[11px]">
                      <div className="font-medium text-[13px] text-stone-800">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-[12px] text-stone-500">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-[11px]">
                      {item.category_name ? (
                        <span className="text-[11px] font-semibold text-stone-600 border-l-[3px] border-amber-500 pl-1.5">
                          {item.category_name}
                        </span>
                      ) : (
                        <span className="text-[12px] text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                      {item.unit || "—"}
                    </td>
                    <td className="px-3.5 py-[11px] text-right font-mono text-[13px] font-semibold text-stone-900">
                      {formatFCFA(item.unit_price)}
                    </td>
                    <td className="px-3.5 py-[11px] text-center">
                      <span
                        className={`badge ${
                          item.tva_applicable
                            ? "bg-blue-50 text-blue-600 border border-blue-600"
                            : "bg-stone-100 text-stone-500 border border-stone-300"
                        }`}
                      >
                        {item.tva_applicable ? "19,25%" : "Exonere"}
                      </span>
                    </td>
                    <td className="px-3.5 py-[11px] text-center">
                      <span
                        className={`badge ${
                          item.active
                            ? "bg-green-50 text-green-600 border border-green-600"
                            : "bg-stone-100 text-stone-400 border border-stone-300"
                        }`}
                      >
                        {item.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-3.5 py-[11px]">
                      <div className="flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="bg-transparent border-none cursor-pointer px-1.5 py-1 text-[12px] text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditItem(item);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editItem && (
        <CatalogueModal
          item={editItem}
          onClose={() => {
            setEditItem(null);
            store.fetch();
          }}
        />
      )}

      {/* New item modal */}
      {showNew && (
        <CatalogueModal
          item={null}
          onClose={() => {
            setShowNew(false);
            store.fetch();
          }}
        />
      )}
    </>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-sans text-[12px] font-medium px-3 py-[5px] cursor-pointer border transition-all ${
        active
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-500 border-stone-200 hover:bg-stone-100"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Catalogue Item Modal ────────────────────────
function CatalogueModal({
  item,
  onClose,
}: {
  item: CatalogueItem | null;
  onClose: () => void;
}) {
  const store = useCatalogue();
  const toast = useToast();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [desc, setDesc] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(
    item?.category_id ?? null,
  );
  const [unit, setUnit] = useState(item?.unit ?? "jour/homme");
  const [price, setPrice] = useState(String(item?.unit_price ?? 0));
  const [tva, setTva] = useState(item?.tva_applicable ?? true);
  const [active, setActive] = useState(item?.active ?? true);
  const [itemType] = useState<"product" | "service">(
    item?.item_type ?? "service",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    store.fetchCategories();
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      toast.show("La designation est obligatoire.", "error");
      return;
    }
    setSaving(true);
    const payload: SaveCataloguePayload = {
      item_type: itemType,
      category_id: categoryId,
      name: name.trim(),
      description: desc,
      unit_price: parseInt(price) || 0,
      unit,
      tva_applicable: tva,
    };
    try {
      if (isEdit) {
        await store.update(item!.id, payload);
        toast.show("Produit modifie");
      } else {
        await store.create(payload);
        toast.show("Produit cree");
      }
      onClose();
    } catch (e) {
      toast.show(String(e), "error");
    }
    setSaving(false);
  }

  const UNITS = [
    "jour/homme",
    "jour",
    "heure",
    "forfait",
    "mois",
    "unite",
    "km",
    "lot",
  ];

  return (
    <SlidePanel
      open
      onClose={onClose}
      title={isEdit ? item!.name : "Nouveau produit / service"}
      subtitle={isEdit ? item!.category_name ?? "" : ""}
      footer={
        <>
          {isEdit && (
            <button
              className="btn-danger btn-sm"
              onClick={async () => {
                await store.toggle(item!.id);
                toast.show(
                  item!.active ? "Produit desactive" : "Produit reactive",
                );
                onClose();
              }}
            >
              {item!.active ? "Desactiver" : "Reactiver"}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div className="section-title mb-4">Informations</div>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Designation
          </label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Developpement backend Java"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Description
          </label>
          <textarea
            className="form-input"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Categorie
            </label>
            <select
              className="form-input"
              value={categoryId ?? ""}
              onChange={(e) =>
                setCategoryId(e.target.value ? +e.target.value : null)
              }
            >
              <option value="">-- Aucune --</option>
              {store.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Unite
            </label>
            <select
              className="form-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Prix unitaire (FCFA)
            </label>
            <input
              className="form-input font-mono"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              TVA (%)
            </label>
            <select
              className="form-input"
              value={tva ? "19.25" : "0"}
              onChange={(e) => setTva(e.target.value !== "0")}
            >
              <option value="0">0% — Exonere</option>
              <option value="19.25">19,25% — Standard Cameroun</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Statut
          </label>
          <select
            className="form-input"
            value={active ? "1" : "0"}
            onChange={(e) => setActive(e.target.value === "1")}
          >
            <option value="1">Actif — visible dans le catalogue</option>
            <option value="0">Inactif — masque du catalogue</option>
          </select>
        </div>
      </div>
    </SlidePanel>
  );
}

export default Catalogue;
