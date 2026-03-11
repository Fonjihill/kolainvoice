import { useEffect, useRef, useState } from "react";
import { useClients } from "../hooks/useClients";
import { useToast } from "../hooks/useToast";
import { Topbar } from "../App";
import SlidePanel from "../components/ui/SlidePanel";
import type { Client, SaveClientPayload } from "../api/clients";
import { Search } from "lucide-react";

function Clients({
  onNavigate: _,
}: {
  onNavigate: (page: string, params?: Record<string, unknown>) => void;
}) {
  const store = useClients();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [filter, setFilter] = useState<"all" | "actif">("all");
  const [searchValue, setSearchValue] = useState("");
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    store.fetch();
  }, [store.fetch]);

  function handleSearch(value: string) {
    setSearchValue(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      store.search(value);
    }, 300);
  }

  // Filter by active
  const clients =
    filter === "actif"
      ? store.clients.filter((c) => !c.archived)
      : store.clients;

  const activeCount = store.clients.filter((c) => !c.archived).length;

  return (
    <>
      {/* Topbar */}
      <Topbar
        title="Clients"
        subtitle={`${store.clients.length} clients`}
        actions={
          <>
            <div className="flex items-center gap-[7px] bg-white border border-stone-200 px-[11px] py-[5px]">
              <Search size={14} className="text-stone-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher..."
                className="font-sans text-[13px] border-none outline-none bg-transparent text-stone-900 w-[180px] placeholder:text-stone-400"
              />
            </div>
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              + Nouveau client
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          {[
            { value: "all" as const, label: `Tous (${store.clients.length})` },
            { value: "actif" as const, label: `Actifs (${activeCount})` },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`font-sans text-[12px] font-medium px-3 py-[5px] cursor-pointer border transition-all ${
                filter === tab.value
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-500 border-stone-200 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {store.error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-sm p-3 mb-3.5">
            {store.error}
          </div>
        )}

        {/* Client cards grid */}
        <div className="grid grid-cols-3 gap-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => setEditClient(client)}
            />
          ))}

          {/* "New client" dashed card */}
          <div
            onClick={() => setShowNew(true)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "#FBBF24")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "#D6D3D1")
            }
            className="bg-white border-2 border-dashed border-stone-300 cursor-pointer flex flex-col items-center justify-center min-h-[120px] gap-2 transition-colors"
          >
            <span className="text-2xl opacity-30">+</span>
            <span className="text-[12px] text-stone-400">Nouveau client</span>
          </div>
        </div>

        {clients.length === 0 && !store.loading && (
          <div className="flex flex-col items-center justify-center py-[60px] gap-2.5">
            <div className="text-4xl opacity-25">👥</div>
            <div className="text-[13px] text-stone-400">Aucun client</div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editClient && (
        <ClientModal
          client={editClient}
          onClose={() => {
            setEditClient(null);
            store.fetch();
          }}
        />
      )}

      {/* New client modal */}
      {showNew && (
        <ClientModal
          client={null}
          onClose={() => {
            setShowNew(false);
            store.fetch();
          }}
        />
      )}
    </>
  );
}

// ─── Client Card ─────────────────────────────────
function ClientCard({
  client,
  onClick,
}: {
  client: Client;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-stone-200 p-4 cursor-pointer transition-all duration-150 border-l-[3px] hover:border-amber-400 hover:border-l-amber-500 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)] ${
        client.archived
          ? "border-l-stone-300"
          : "border-l-amber-500"
      }`}
    >
      {/* Header: name + badge */}
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-bold text-stone-900">{client.name}</div>
        <span
          className={`badge ${
            client.archived
              ? "bg-stone-100 text-stone-500 border border-stone-300"
              : "bg-green-50 text-green-600 border border-green-600"
          }`}
        >
          {client.archived ? "Archive" : "Actif"}
        </span>
      </div>

      {/* Details */}
      <div className="text-[12px] text-stone-500 leading-[1.7]">
        {client.niu && (
          <>
            NIU : {client.niu}
            <br />
          </>
        )}
        {client.phone}
        <br />
        {client.email}
        <br />
        {client.address || "—"}
      </div>
    </div>
  );
}

// ─── Client Modal (create / edit) ────────────────
function ClientModal({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const store = useClients();
  const toast = useToast();
  const isEdit = !!client;

  const [name, setName] = useState(client?.name ?? "");
  const [niu, setNiu] = useState(client?.niu ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.show("Le nom est obligatoire.", "error");
      return;
    }
    setSaving(true);
    const payload: SaveClientPayload = {
      name: name.trim(),
      niu,
      phone,
      email,
      address,
      notes,
    };
    try {
      if (isEdit) {
        await store.update(client!.id, payload);
        toast.show("Client modifie");
      } else {
        await store.create(payload);
        toast.show("Client cree");
      }
      onClose();
    } catch (e) {
      toast.show(String(e), "error");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!client) return;
    await store.archive(client.id);
    toast.show(`Client « ${client.name} » archive`);
    onClose();
  }

  return (
    <SlidePanel
      open
      onClose={onClose}
      title={isEdit ? client!.name : "Nouveau client"}
      subtitle={isEdit ? "" : undefined}
      footer={
        <>
          {isEdit && (
            <button className="btn-danger btn-sm" onClick={handleArchive}>
              Archiver
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
      {/* Form */}
      <div className="mb-5">
        <div className="section-title">Informations</div>
        <div className="grid grid-cols-2 gap-3.5 mb-3">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Nom / Raison sociale
            </label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: SARL Techno Mboa"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              NIU
            </label>
            <input
              className="form-input font-mono"
              value={niu}
              onChange={(e) => setNiu(e.target.value)}
              placeholder="M0XXXXXXXX"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Telephone
            </label>
            <input
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Email
            </label>
            <input
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemple.cm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
              Adresse
            </label>
            <input
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rue, quartier, ville..."
            />
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Notes internes</div>
        <textarea
          className="form-input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes visibles uniquement par vous..."
        />
      </div>
    </SlidePanel>
  );
}

export default Clients;
