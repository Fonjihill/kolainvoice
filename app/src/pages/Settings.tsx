import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { useToast } from "../hooks/useToast";
import { Topbar } from "../App";
import type { SaveSettingsPayload } from "../api/settings";
import { getDataCounts, type DataCounts } from "../api/settings";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Building2,
  Receipt,
  BarChart3,
  Printer,
  HardDrive,
  RefreshCw,
  Globe,
  type LucideIcon,
} from "lucide-react";

const TABS: { key: string; icon: LucideIcon; label: string }[] = [
  { key: "entreprise", icon: Building2, label: "Entreprise" },
  { key: "factures", icon: Receipt, label: "Factures" },
  { key: "tva", icon: BarChart3, label: "TVA" },
  { key: "impression", icon: Printer, label: "Impression" },
  { key: "sauvegarde", icon: HardDrive, label: "Sauvegarde" },
  { key: "mises-a-jour", icon: RefreshCw, label: "Mises a jour" },
  { key: "langue", icon: Globe, label: "Langue" },
];

function Settings() {
  const { settings, loading, error, fetch, save } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState<SaveSettingsPayload | null>(null);
  const [tab, setTab] = useState("entreprise");
  const [counts, setCounts] = useState<DataCounts | null>(null);

  useEffect(() => {
    fetch();
    getDataCounts().then(setCounts).catch(() => {});
  }, [fetch]);

  useEffect(() => {
    if (settings && !form) {
      const { id: _, ...rest } = settings;
      setForm(rest);
    }
  }, [settings, form]);

  function update<K extends keyof SaveSettingsPayload>(
    key: K,
    value: SaveSettingsPayload[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form) return;
    await save(form);
    toast.show("Parametres sauvegardes");
  }

  if (!form) {
    return (
      <>
        <Topbar title="Parametres" subtitle="Configuration de Kola Invoice" />
        <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
          <div className="text-sm text-stone-400">Chargement...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Parametres"
        subtitle="Configuration de Kola Invoice"
        actions={
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            Enregistrer
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        {error && (
          <div className="bg-red-50 border border-red-500 border-l-[3px] text-red-700 text-sm p-3 mb-4">
            {error}
          </div>
        )}

        <div className="grid items-start gap-4" style={{ gridTemplateColumns: "190px 1fr" }}>
          {/* Left nav */}
          <div className="bg-white border border-stone-200 py-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full text-left px-3.5 py-[9px] text-[13px] cursor-pointer border-l-[3px] transition-all ${
                  tab === t.key
                    ? "bg-amber-100 text-amber-700 border-l-amber-500 font-semibold"
                    : "text-stone-600 border-transparent hover:bg-stone-100"
                }`}
              >
                <span className="inline-flex items-center gap-2"><t.icon size={15} /> {t.label}</span>
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="bg-white border border-stone-200 p-[22px]">
            {tab === "entreprise" && (
              <EntreprisePanel form={form} update={update} />
            )}
            {tab === "factures" && (
              <FacturesPanel form={form} update={update} />
            )}
            {tab === "tva" && <TVAPanel form={form} update={update} />}
            {tab === "impression" && <ImpressionPanel form={form} update={update} />}
            {tab === "sauvegarde" && <SauvegardePanel form={form} update={update} counts={counts} />}
            {tab === "mises-a-jour" && <MisesAJourPanel form={form} update={update} />}
            {tab === "langue" && <LanguePanel form={form} update={update} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Panels ──────────────────────────────────────

type PanelProps = {
  form: SaveSettingsPayload;
  update: <K extends keyof SaveSettingsPayload>(
    key: K,
    value: SaveSettingsPayload[K],
  ) => void;
};

function EntreprisePanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">Informations de l'entreprise</div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Nom / Raison sociale
          </label>
          <input
            className="form-input"
            value={form.company_name}
            onChange={(e) => update("company_name", e.target.value)}
          />
        </div>
        <FI label="NIU" value={form.company_niu} onChange={(v) => update("company_niu", v)} mono />
        <FI label="Telephone" value={form.company_phone} onChange={(v) => update("company_phone", v)} />
        <FI label="Email" value={form.company_email} onChange={(v) => update("company_email", v)} />
        <FI label="RCCM" value={form.company_rccm} onChange={(v) => update("company_rccm", v)} />
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Adresse
          </label>
          <textarea
            className="form-input"
            rows={2}
            value={form.company_address}
            onChange={(e) => update("company_address", e.target.value)}
          />
        </div>
      </div>

      <div className="section-title">Logo et tampon</div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <UploadBox
          label="Logo"
          hint="PNG, JPG — max 2 Mo"
          path={form.logo_path}
          onPick={async () => {
            const file = await open({
              title: "Choisir un logo",
              filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
              multiple: false,
            });
            if (file) {
              const newPath = await invoke<string>("copy_image_to_app_data", {
                sourcePath: file,
                targetName: "logo",
              });
              update("logo_path", newPath);
            }
          }}
          onClear={() => update("logo_path", null)}
        />
        <UploadBox
          label="Tampon / Signature"
          hint="PNG fond transparent"
          path={form.stamp_path}
          onPick={async () => {
            const file = await open({
              title: "Choisir un tampon",
              filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
              multiple: false,
            });
            if (file) {
              const newPath = await invoke<string>("copy_image_to_app_data", {
                sourcePath: file,
                targetName: "stamp",
              });
              update("stamp_path", newPath);
            }
          }}
          onClear={() => update("stamp_path", null)}
        />
      </div>

      <div className="section-title">Coordonnees bancaires</div>
      <div className="grid grid-cols-3 gap-3.5">
        <FI label="Banque" value={form.bank_name} onChange={(v) => update("bank_name", v)} />
        <FI label="Numero de compte" value={form.bank_account} onChange={(v) => update("bank_account", v)} mono />
        <FI label="SWIFT / IBAN" value={form.bank_swift} onChange={(v) => update("bank_swift", v)} mono />
      </div>
    </>
  );
}

function FacturesPanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">Numerotation</div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Prefixe factures
          </label>
          <input
            className="form-input font-mono"
            value={form.invoice_prefix}
            onChange={(e) => update("invoice_prefix", e.target.value)}
          />
          <span className="text-[11px] text-stone-400">
            Genere : {form.invoice_prefix}-{new Date().getFullYear()}-0001
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Prefixe devis
          </label>
          <input
            className="form-input font-mono"
            value={form.quote_prefix}
            onChange={(e) => update("quote_prefix", e.target.value)}
          />
          <span className="text-[11px] text-stone-400">
            Genere : {form.quote_prefix}-{new Date().getFullYear()}-0001
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Prochain n° facture
          </label>
          <input
            className="form-input font-mono"
            type="number"
            min={1}
            value={form.next_invoice_number}
            onChange={(e) => update("next_invoice_number", parseInt(e.target.value) || 1)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Prochain n° devis
          </label>
          <input
            className="form-input font-mono"
            type="number"
            min={1}
            value={form.next_quote_number}
            onChange={(e) => update("next_quote_number", parseInt(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="section-title">Echeances par defaut</div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Delai paiement (jours)
          </label>
          <input
            className="form-input font-mono"
            type="number"
            min={1}
            value={form.payment_days}
            onChange={(e) => update("payment_days", parseInt(e.target.value) || 30)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Validite devis (jours)
          </label>
          <input
            className="form-input font-mono"
            type="number"
            min={1}
            value={form.quote_validity_days}
            onChange={(e) => update("quote_validity_days", parseInt(e.target.value) || 30)}
          />
        </div>
      </div>

      <div className="section-title">Mentions legales par defaut</div>
      <textarea
        className="form-input"
        rows={4}
        value={form.default_mentions}
        onChange={(e) => update("default_mentions", e.target.value)}
        placeholder="Paiement par virement ou Mobile Money sous 30 jours..."
      />
    </>
  );
}

function TVAPanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">TVA</div>
      <div className="flex items-center gap-2.5 py-3 border-b border-stone-100 mb-4">
        <ToggleSwitch
          on={form.tva_enabled}
          onToggle={() => update("tva_enabled", !form.tva_enabled)}
        />
        <div>
          <div className="text-[13px] font-semibold">TVA activee par defaut</div>
          <div className="text-[12px] text-stone-500">
            Applicable aux nouvelles factures et devis
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 mb-4">
        <FI
          label="Taux TVA (%)"
          value={String(form.tva_rate)}
          onChange={(v) => update("tva_rate", parseFloat(v) || 0)}
          mono
        />
      </div>
      <div className="bg-blue-50 border border-blue-600 p-3 text-[12px] text-blue-600">
        Conformement a la DGI Cameroun, le taux de TVA applicable est de 19,25%.
      </div>
    </>
  );
}

function ImpressionPanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">Format et imprimante</div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Format papier
          </label>
          <select
            className="form-input"
            value={form.paper_format}
            onChange={(e) => update("paper_format", e.target.value)}
          >
            <option value="A4">A4 (210 x 297 mm)</option>
            <option value="Letter">Letter</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Copies par defaut
          </label>
          <input
            className="form-input font-mono"
            type="number"
            min={1}
            value={form.default_copies}
            onChange={(e) => update("default_copies", parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
      <div className="section-title">Options PDF</div>
      {[
        { key: "pdf_include_logo" as const, label: "Inclure le logo", desc: "Dans le PDF genere" },
        { key: "pdf_include_stamp" as const, label: "Inclure le tampon", desc: "Signature numerique" },
        { key: "pdf_watermark_draft" as const, label: "Filigrane BROUILLON", desc: "Sur les factures en brouillon" },
      ].map((opt) => (
        <div key={opt.key} className="flex items-center gap-2.5 py-3 border-b border-stone-100">
          <ToggleSwitch
            on={form[opt.key]}
            onToggle={() => update(opt.key, !form[opt.key])}
          />
          <div>
            <div className="text-[13px] font-semibold">{opt.label}</div>
            <div className="text-[12px] text-stone-500">{opt.desc}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function SauvegardePanel({ form, update, counts }: PanelProps & { counts: DataCounts | null }) {
  return (
    <>
      <div className="section-title">Gestion des donnees</div>
      <div className="bg-green-50 border border-green-600 p-3.5 mb-[18px]">
        <div className="text-[12px] font-bold text-green-600 mb-0.5">
          Donnees en memoire
        </div>
        <div className="text-[13px] text-stone-700">
          {counts
            ? `${counts.invoices} facture${counts.invoices > 1 ? "s" : ""} · ${counts.quotes} devis · ${counts.clients} client${counts.clients > 1 ? "s" : ""} · ${counts.catalogue} produit${counts.catalogue > 1 ? "s" : ""}`
            : "Chargement..."}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div>
          <div className="text-[13px] font-semibold mb-1.5">Exporter</div>
          <div className="text-[12px] text-stone-500 mb-3">
            Copie complete des donnees
          </div>
          <button className="btn-primary flex items-center gap-1.5"><HardDrive size={14} /> Exporter .db</button>
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-1.5">Restaurer</div>
          <div className="text-[12px] text-stone-500 mb-3">
            Importe un fichier .db precedent
          </div>
          <button className="btn-danger">⚠ Restaurer</button>
        </div>
      </div>
      <div className="section-title">Options</div>
      <div className="flex items-center gap-2.5 py-3 border-b border-stone-100">
        <ToggleSwitch
          on={form.auto_backup_alert}
          onToggle={() => update("auto_backup_alert", !form.auto_backup_alert)}
        />
        <div>
          <div className="text-[13px] font-semibold">Rappel hebdomadaire</div>
          <div className="text-[12px] text-stone-500">Notification chaque lundi au demarrage</div>
        </div>
      </div>
    </>
  );
}

function MisesAJourPanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">Mises a jour</div>
      <div className="flex justify-between items-center bg-amber-100 border border-amber-400 p-3.5 mb-5">
        <div>
          <div className="text-[13px] font-bold text-amber-700">Version 1.1.0 disponible</div>
          <div className="text-[12px] text-stone-600 mt-0.5">PDF ameliore · Correction numerotation</div>
        </div>
        <button className="btn-primary">Installer</button>
      </div>
      <div className="mb-4">
        <div className="text-[10px] font-bold tracking-wider uppercase text-stone-400">Version actuelle</div>
        <div className="font-mono text-[22px] font-semibold mt-1">1.0.0</div>
      </div>
      {[
        { key: "update_auto_check" as const, label: "Verifier automatiquement", desc: "Au demarrage si internet disponible" },
        { key: "update_notify" as const, label: "Bandeau de notification", desc: "Non bloquant, jamais force" },
      ].map((opt) => (
        <div key={opt.key} className="flex items-center gap-2.5 py-3 border-b border-stone-100">
          <ToggleSwitch
            on={form[opt.key]}
            onToggle={() => update(opt.key, !form[opt.key])}
          />
          <div>
            <div className="text-[13px] font-semibold">{opt.label}</div>
            <div className="text-[12px] text-stone-500">{opt.desc}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function LanguePanel({ form, update }: PanelProps) {
  return (
    <>
      <div className="section-title">Langue et region</div>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Langue
          </label>
          <select
            className="form-input"
            value={form.language}
            onChange={(e) => update("language", e.target.value as "fr" | "en")}
          >
            <option value="fr">Francais</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Devise
          </label>
          <input className="form-input font-mono" value="FCFA" readOnly />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Format date
          </label>
          <select
            className="form-input"
            value={form.date_format}
            onChange={(e) => update("date_format", e.target.value)}
          >
            <option value="DD/MM/YYYY">JJ/MM/AAAA</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
            Separateur milliers
          </label>
          <select
            className="form-input"
            value={form.thousand_separator}
            onChange={(e) => update("thousand_separator", e.target.value)}
          >
            <option value="space">Espace (1 250 000)</option>
            <option value="dot">Point (1.250.000)</option>
          </select>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-600 p-3 mt-4 text-[12px] text-blue-600">
        La devise FCFA est fixee — conforme a la reglementation BEAC/CEMAC.
      </div>
    </>
  );
}

// ─── Shared UI ───────────────────────────────────

function FI({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
        {label}
      </label>
      <input
        className={`form-input ${mono ? "font-mono" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function UploadBox({
  label,
  hint,
  path,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  path: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
        {label}
      </label>
      {path ? (
        <div className="border-2 border-solid border-amber-400 p-3 text-center bg-amber-50 relative">
          <img
            src={convertFileSrc(path)}
            alt={label}
            className="max-h-[80px] mx-auto object-contain"
          />
          <div className="text-[11px] text-stone-500 mt-1.5 truncate">{path.split("/").pop()}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[11px] leading-none flex items-center justify-center cursor-pointer hover:bg-red-600"
            title="Supprimer"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-stone-300 p-[18px] text-center cursor-pointer bg-stone-50 hover:border-amber-400 hover:bg-amber-50 transition-colors"
          onClick={onPick}
        >
          <div className="text-[22px]">{label === "Logo" ? "🖼" : "🔏"}</div>
          <div className="text-[12px] text-stone-400 mt-1">Cliquer pour choisir</div>
          <div className="text-[11px] text-stone-400">{hint}</div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={`w-[38px] h-[21px] rounded-full cursor-pointer relative shrink-0 transition-colors duration-200 ${
        on ? "bg-amber-500" : "bg-stone-300"
      }`}
    >
      <div
        className={`w-[15px] h-[15px] bg-white rounded-full absolute top-[3px] transition-[left] duration-200 pointer-events-none ${
          on ? "left-5" : "left-[3px]"
        }`}
      />
    </div>
  );
}

export default Settings;
