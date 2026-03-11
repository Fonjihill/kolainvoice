import { useEffect, useState } from "react";
import { getClientById, type SaveClientPayload } from "../api/clients";
import { useClients } from "../hooks/useClients";
import { useToast } from "../hooks/useToast";
import { useUnsavedGuard } from "../hooks/useUnsavedGuard";
import { ConfirmModal } from "../components/ui/Modal";

const EMPTY_FORM: SaveClientPayload = {
  name: "",
  niu: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function ClientForm({
  clientId,
  onBack,
}: {
  clientId?: number;
  onBack: () => void;
}) {
  const { create, update } = useClients();
  const toast = useToast();
  const { markDirty, markClean, isDirty } = useUnsavedGuard();
  const [form, setForm] = useState<SaveClientPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingClient, setLoadingClient] = useState(!!clientId);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const isEditing = !!clientId;

  useEffect(() => {
    if (!clientId) return;
    setLoadingClient(true);
    getClientById(clientId)
      .then((client) => {
        setForm({
          name: client.name,
          niu: client.niu,
          phone: client.phone,
          email: client.email,
          address: client.address,
          notes: client.notes,
        });
        setLoadingClient(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoadingClient(false);
      });
  }, [clientId]);

  function updateField<K extends keyof SaveClientPayload>(
    key: K,
    value: SaveClientPayload[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }

  function handleBack() {
    if (isDirty()) {
      setShowLeaveModal(true);
    } else {
      onBack();
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await update(clientId, form);
        toast.show("Client modifié");
      } else {
        await create(form);
        toast.show("Client créé");
      }
      markClean();
      onBack();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  if (loadingClient) {
    return (
      <div className="text-sm text-stone-400 p-4">
        Chargement du client...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ConfirmModal
        open={showLeaveModal}
        title="Modifications non sauvegardées"
        message="Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?"
        confirmLabel="Quitter"
        danger
        onConfirm={() => {
          markClean();
          onBack();
        }}
        onCancel={() => setShowLeaveModal(false)}
      />

      <button
        onClick={handleBack}
        className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
      >
        ← Retour à la liste
      </button>

      <section className="bg-white border border-stone-200 p-6">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-5">
          {isEditing ? "Modifier le client" : "Nouveau client"}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field
            label="Nom *"
            value={form.name}
            onChange={(v) => updateField("name", v)}
            span={2}
            autoFocus
          />
          <Field
            label="Téléphone"
            value={form.phone}
            onChange={(v) => updateField("phone", v)}
          />
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => updateField("email", v)}
            type="email"
          />
          <Field
            label="NIU (Numéro d'identification unique)"
            value={form.niu}
            onChange={(v) => updateField("niu", v)}
            span={2}
          />
        </div>
      </section>

      <section className="bg-white border border-stone-200 p-6">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-5">
          Adresse & Notes
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Adresse complète
            </label>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
              Notes internes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              placeholder="Notes visibles uniquement par vous..."
              className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>
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
              ? "Enregistrer les modifications"
              : "Créer le client"}
        </button>
        <button
          onClick={handleBack}
          className="border border-stone-300 text-stone-600 text-sm px-5 py-2.5 hover:bg-stone-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  span,
  autoFocus,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: number;
  autoFocus?: boolean;
  type?: string;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-[11px] font-bold tracking-widest uppercase text-stone-500 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none transition-colors"
      />
    </div>
  );
}

export default ClientForm;
