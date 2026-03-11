import { useEffect, useState } from "react";
import { useCatalogue } from "../hooks/useCatalogue";
import { getCatalogue, type SaveCataloguePayload } from "../api/catalogue";
import { formatPriceInput, parsePriceInput } from "../lib/format";
import { useToast } from "../hooks/useToast";

const EMPTY_FORM: SaveCataloguePayload = {
  item_type: "service",
  category_id: null,
  name: "",
  description: "",
  unit_price: 0,
  unit: "unité",
  tva_applicable: true,
};

const UNIT_OPTIONS = [
  "unité",
  "heure",
  "jour",
  "mois",
  "kg",
  "m",
  "m²",
  "forfait",
];

function CatalogueForm({
  itemId,
  itemType,
  onBack,
}: {
  itemId?: number;
  itemType?: string;
  onBack: () => void;
}) {
  const { categories, create, update, fetchCategories, addCategory } =
    useCatalogue();
  const toast = useToast();
  const [form, setForm] = useState<SaveCataloguePayload>({
    ...EMPTY_FORM,
    item_type: (itemType as "product" | "service") ?? "service",
  });
  const [priceDisplay, setPriceDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState(!!itemId);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const isEditing = !!itemId;

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!itemId) return;
    setLoadingItem(true);
    getCatalogue(false)
      .then((items) => {
        const item = items.find((i) => i.id === itemId);
        if (item) {
          setForm({
            item_type: item.item_type,
            category_id: item.category_id,
            name: item.name,
            description: item.description,
            unit_price: item.unit_price,
            unit: item.unit,
            tva_applicable: item.tva_applicable,
          });
          setPriceDisplay(formatPriceInput(item.unit_price));
        } else {
          setError("Élément introuvable");
        }
        setLoadingItem(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoadingItem(false);
      });
  }, [itemId]);

  function updateField<K extends keyof SaveCataloguePayload>(
    key: K,
    value: SaveCataloguePayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePriceChange(raw: string) {
    const value = parsePriceInput(raw);
    updateField("unit_price", value);
    setPriceDisplay(formatPriceInput(value));
  }

  async function handleAddCategory() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    try {
      const cat = await addCategory({ name: trimmed, description: "", color: "#D97706" });
      updateField("category_id", cat.id);
      setNewCatName("");
      setShowNewCat(false);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await update(itemId, form);
        toast.show("Élément modifié");
      } else {
        await create(form);
        toast.show(form.item_type === "service" ? "Service créé" : "Produit créé");
      }
      onBack();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  if (loadingItem) {
    return <div className="text-sm text-stone-400 p-4">Chargement...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
      >
        ← Retour au catalogue
      </button>

      {/* Type selector */}
      <section className="bg-white border border-stone-200 p-6">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-4">
          Type
        </h2>
        <div className="flex gap-3">
          {(["service", "product"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateField("item_type", t)}
              className={`px-5 py-2.5 text-sm border transition-colors ${
                form.item_type === t
                  ? t === "service"
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                    : "border-amber-500 bg-amber-50 text-amber-700 font-semibold"
                  : "border-stone-300 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {t === "service" ? "Service" : "Produit"}
            </button>
          ))}
        </div>
      </section>

      {/* Main info */}
      <section className="bg-white border border-stone-200 p-6">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-5">
          {isEditing ? "Modifier l'élément" : "Informations"}
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div className="col-span-2">
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Désignation *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              autoFocus
              className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 focus:border-amber-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Prix unitaire (FCFA) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={priceDisplay}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="0"
              className="w-full text-sm font-mono px-3 py-2.5 border border-stone-300 bg-white text-stone-900 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Unité
            </label>
            <select
              value={form.unit}
              onChange={(e) => updateField("unit", e.target.value)}
              className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 focus:border-amber-500 focus:outline-none transition-colors"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.tva_applicable}
                onChange={(e) =>
                  updateField("tva_applicable", e.target.checked)
                }
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-stone-700">
                TVA applicable sur cet élément
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Category */}
      <section className="bg-white border border-stone-200 p-6">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-4">
          Catégorie
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => updateField("category_id", null)}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              form.category_id === null
                ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold"
                : "border-stone-300 text-stone-500 hover:bg-stone-50"
            }`}
          >
            Aucune
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateField("category_id", cat.id)}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                form.category_id === cat.id
                  ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold"
                  : "border-stone-300 text-stone-500 hover:bg-stone-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {showNewCat ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              placeholder="Nom de la catégorie"
              autoFocus
              className="text-sm px-3 py-2 border border-stone-300 bg-white text-stone-900 focus:border-amber-500 focus:outline-none transition-colors flex-1 max-w-[240px]"
            />
            <button
              onClick={handleAddCategory}
              className="bg-amber-500 hover:bg-amber-600 text-stone-900 text-xs font-semibold px-3 py-2 transition-colors"
            >
              Ajouter
            </button>
            <button
              onClick={() => {
                setShowNewCat(false);
                setNewCatName("");
              }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewCat(true)}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            + Nouvelle catégorie
          </button>
        )}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-500 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200 disabled:text-stone-400 text-stone-900 text-sm font-semibold px-6 py-2.5 transition-colors"
        >
          {saving
            ? "Enregistrement..."
            : isEditing
              ? "Enregistrer"
              : form.item_type === "service"
                ? "Créer le service"
                : "Créer le produit"}
        </button>
        <button
          onClick={onBack}
          className="border border-stone-300 text-stone-600 text-sm px-5 py-2.5 hover:bg-stone-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export default CatalogueForm;
