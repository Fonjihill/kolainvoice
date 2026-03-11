import { useEffect, useState } from "react";
import { useCatalogue } from "../hooks/useCatalogue";
import { Topbar } from "../App";
import SlidePanel from "../components/ui/SlidePanel";
import { ConfirmModal } from "../components/ui/Modal";
import { useToast } from "../hooks/useToast";
import type { Category } from "../api/catalogue";
import { Pencil } from "lucide-react";

const COLORS = [
  "#D97706", "#2563EB", "#16A34A", "#7C3AED", "#DC2626",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#6366F1",
];

function Categories() {
  const store = useCatalogue();
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    store.fetchCategories();
    store.setActiveOnly(false);
  }, []);

  return (
    <>
      <Topbar
        title="Categories"
        subtitle="Organiser le catalogue"
        actions={
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            + Nouvelle categorie
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {store.error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-sm p-3 mb-3.5">
            {store.error}
          </div>
        )}

        {/* Card grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {store.categories.map((cat) => {
            const count = store.items.filter(
              (i) => i.category_id === cat.id,
            ).length;
            const catItems = store.items.filter(
              (i) => i.category_id === cat.id,
            );
            return (
              <div
                key={cat.id}
                onClick={() => setEditCat(cat)}
                className="bg-white border border-stone-200 p-4 cursor-pointer transition-shadow hover:shadow-md"
                style={{ borderLeft: `4px solid ${cat.color}` }}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <div
                    className="text-[14px] font-bold"
                    style={{ color: cat.color }}
                  >
                    {cat.name}
                  </div>
                  <span
                    className="font-mono text-[12px] font-semibold px-2 py-[2px]"
                    style={{
                      background: `${cat.color}18`,
                      color: cat.color,
                    }}
                  >
                    {count} produit{count > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-[12px] text-stone-500">
                  {cat.description || "Aucune description"}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {catItems.slice(0, 3).map((c) => (
                    <span
                      key={c.id}
                      className="text-[11px] px-2 py-[2px] bg-stone-100 text-stone-600"
                    >
                      {c.name.length > 20
                        ? c.name.substring(0, 20) + "\u2026"
                        : c.name}
                    </span>
                  ))}
                  {catItems.length > 3 && (
                    <span className="text-[11px] text-stone-400">
                      +{catItems.length - 3} autres
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* New card */}
          <div
            onClick={() => setShowNew(true)}
            className="flex flex-col items-center justify-center min-h-[100px] border-2 border-dashed border-stone-300 cursor-pointer gap-1.5 hover:border-amber-400 transition-colors"
          >
            <span className="text-[22px] opacity-30">+</span>
            <span className="text-[12px] text-stone-400">
              Nouvelle categorie
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-stone-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200">
                <th className="text-left px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Categorie
                </th>
                <th className="text-left px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Description
                </th>
                <th className="text-center px-3.5 py-[9px] text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500">
                  Produits
                </th>
                <th className="px-3.5 py-[9px] w-12"></th>
              </tr>
            </thead>
            <tbody>
              {store.categories.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-[60px] gap-2.5">
                      <div className="text-4xl opacity-25">🏷</div>
                      <div className="text-[13px] text-stone-400">
                        Aucune categorie
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                store.categories.map((cat) => {
                  const count = store.items.filter(
                    (i) => i.category_id === cat.id,
                  ).length;
                  return (
                    <tr
                      key={cat.id}
                      onClick={() => setEditCat(cat)}
                      className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer group transition-colors"
                    >
                      <td className="px-3.5 py-[11px]">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: cat.color }}
                          />
                          <div className="text-[13px] font-semibold text-stone-800">
                            {cat.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-[11px] text-[12px] text-stone-500">
                        {cat.description || "\u2014"}
                      </td>
                      <td className="px-3.5 py-[11px] text-center font-mono text-[13px] font-semibold">
                        {count}
                      </td>
                      <td
                        className="px-3.5 py-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="bg-transparent border-none cursor-pointer px-1.5 py-1 text-[12px] text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                            onClick={() => setEditCat(cat)}
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editCat && (
        <CategoryModal
          category={editCat}
          itemCount={
            store.items.filter((i) => i.category_id === editCat.id).length
          }
          onClose={() => {
            setEditCat(null);
            store.fetchCategories();
            store.fetch();
          }}
        />
      )}

      {/* New modal */}
      {showNew && (
        <CategoryModal
          category={null}
          itemCount={0}
          nextColor={COLORS[store.categories.length % COLORS.length]}
          onClose={() => {
            setShowNew(false);
            store.fetchCategories();
          }}
        />
      )}
    </>
  );
}

// ─── Category Modal ─────────────────────────────────────
function CategoryModal({
  category,
  itemCount,
  nextColor,
  onClose,
}: {
  category: Category | null;
  itemCount: number;
  nextColor?: string;
  onClose: () => void;
}) {
  const store = useCatalogue();
  const toast = useToast();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? "");
  const [desc, setDesc] = useState(category?.description ?? "");
  const [color, setColor] = useState(
    category?.color ?? nextColor ?? COLORS[0],
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.show("Le nom est obligatoire.", "error");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await store.editCategory(category!.id, {
          name: name.trim(),
          description: desc,
          color,
        });
        toast.show("Categorie modifiee");
      } else {
        await store.addCategory({
          name: name.trim(),
          description: desc,
          color,
        });
        toast.show("Categorie creee");
      }
      onClose();
    } catch (e) {
      toast.show(String(e), "error");
    }
    setSaving(false);
  }

  async function handleDelete() {
    try {
      await store.removeCategory(category!.id);
      toast.show("Categorie supprimee");
      onClose();
    } catch (e) {
      toast.show(String(e), "error");
    }
    setConfirmDelete(false);
  }

  return (
    <>
      <SlidePanel
        open
        onClose={onClose}
        title={isEdit ? "Modifier la categorie" : "Nouvelle categorie"}
        small
        footer={
          <>
            {isEdit && (
              <button
                className="btn-danger btn-sm"
                onClick={() => setConfirmDelete(true)}
              >
                Supprimer
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
              Nom de la categorie
            </label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Developpement"
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
              placeholder="Description courte..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Couleur
            </label>
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map((col) => (
                <div
                  key={col}
                  onClick={() => setColor(col)}
                  className="w-7 h-7 cursor-pointer transition-all"
                  style={{
                    background: col,
                    border:
                      col === color
                        ? "3px solid #1c1917"
                        : "3px solid transparent",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </SlidePanel>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer la categorie"
        message={`Supprimer "${category?.name}" ? Les ${itemCount} produit(s) associes resteront mais sans categorie.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default Categories;
