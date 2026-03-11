import { useState } from "react";
import { useLicense } from "../hooks/useLicense";
import { Copy, Check, ChevronRight } from "lucide-react";

interface Props {
  onActivated: () => void;
}

type SelectedPlan = "monthly" | "annual" | null;

function LicenseGate({ onActivated }: Props) {
  const { status, loading, error, activate } = useLicense();
  const [licenseKey, setLicenseKey] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>(null);
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const deviceId = status?.device_id ?? "...";

  const planLabels: Record<string, string> = {
    monthly: "Mensuel",
    annual: "Annuel",
  };

  async function handleCopyDeviceId() {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopiedDevice(true);
      setTimeout(() => setCopiedDevice(false), 2000);
    } catch { /* ignore */ }
  }

  function getWhatsAppMessage() {
    const planName = selectedPlan ? planLabels[selectedPlan] : "";
    return `Bonjour, je souhaite un abonnement ${planName} pour Kola Invoice. Mon Device ID : ${deviceId}`;
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(getWhatsAppMessage());
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch { /* ignore */ }
  }

  function formatKeyInput(raw: string): string {
    // Remove everything that's not alphanumeric
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Build formatted key: KOLA-XXXXX-XXXXX-XXXXX-XXXXX
    if (clean.length <= 4) return clean;

    const prefix = clean.slice(0, 4); // KOLA
    const rest = clean.slice(4);

    // Split rest into chunks of 5
    const chunks: string[] = [prefix];
    for (let i = 0; i < rest.length; i += 5) {
      chunks.push(rest.slice(i, i + 5));
    }
    return chunks.join("-");
  }

  function handleKeyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatKeyInput(e.target.value);
    // Limit total length: KOLA-XXXXX-XXXXX-XXXXX-XXXXX = 29 chars
    setLicenseKey(formatted.slice(0, 29));
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    try {
      const result = await activate(licenseKey.trim());
      if (result.state === "active" || result.state === "trial") {
        onActivated();
      }
    } catch {
      // error is set in the store
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="text-[48px] mb-2">🌰</div>
        <div className="font-serif text-[26px] text-white tracking-wide">
          Kola Invoice
        </div>
        <div className="font-mono text-[10px] text-amber-400 mt-1 tracking-[0.15em]">
          FACTURATION PROFESSIONNELLE
        </div>
      </div>

      {/* Main card */}
      <div className="bg-stone-800 rounded-lg w-full max-w-lg overflow-hidden">
        <div className="px-8 py-6">
          {/* Title */}
          <h1 className="font-serif text-[20px] text-white text-center mb-1">
            {status?.state === "expired" && status?.trial_days_remaining === null
              ? "Votre licence a expire"
              : "Periode d'essai terminee"}
          </h1>
          <p className="text-[13px] text-stone-400 text-center mb-6">
            Activez une licence pour continuer a utiliser Kola Invoice.
          </p>

          {/* Device ID */}
          <div className="mb-6">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 mb-1.5 block">
              Votre Device ID
            </label>
            <div className="flex items-center gap-2 bg-stone-900 rounded px-3 py-2.5">
              <code className="flex-1 font-mono text-[13px] text-amber-400 select-all break-all">
                {deviceId}
              </code>
              <button
                type="button"
                onClick={handleCopyDeviceId}
                className="shrink-0 text-stone-400 hover:text-white transition-colors cursor-pointer"
                title="Copier le Device ID"
              >
                {copiedDevice ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Plan options */}
          <div className="mb-5">
            <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-500 mb-2 block">
              Choisir un abonnement
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Monthly */}
              <button
                type="button"
                onClick={() => setSelectedPlan("monthly")}
                className={`relative rounded border-2 p-4 text-left transition-all cursor-pointer ${
                  selectedPlan === "monthly"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-stone-600 hover:border-stone-500 bg-stone-900/50"
                }`}
              >
                <div className="text-[14px] font-semibold text-white">Mensuel</div>
                <div className="text-[13px] text-amber-400 font-mono mt-1">
                  5 000 FCFA/mois
                </div>
              </button>

              {/* Annual */}
              <button
                type="button"
                onClick={() => setSelectedPlan("annual")}
                className={`relative rounded border-2 p-4 text-left transition-all cursor-pointer ${
                  selectedPlan === "annual"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-stone-600 hover:border-stone-500 bg-stone-900/50"
                }`}
              >
                <div className="text-[14px] font-semibold text-white">Annuel</div>
                <div className="text-[13px] text-amber-400 font-mono mt-1">
                  45 000 FCFA/an
                </div>
                <span className="absolute -top-2 right-2 bg-green-600 text-white text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full uppercase">
                  -15 000 FCFA
                </span>
              </button>
            </div>
          </div>

          {/* WhatsApp message (shown when plan selected) */}
          {selectedPlan && (
            <div className="bg-stone-900 rounded p-4 mb-6">
              <p className="text-[12px] text-stone-300 mb-2.5">
                Envoyez ce message par WhatsApp :
              </p>
              <div className="bg-stone-800 border border-stone-700 rounded p-3 mb-3">
                <p className="text-[12px] text-stone-300 leading-relaxed">
                  {getWhatsAppMessage()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex items-center gap-2 text-[12px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {copiedMessage ? (
                  <>
                    <Check size={14} className="text-green-400" />
                    <span className="text-green-400">Copie !</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copier le message</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-stone-700" />
            <span className="text-[11px] text-stone-500">Vous avez deja une cle ?</span>
            <div className="flex-1 h-px bg-stone-700" />
          </div>

          {/* License key input */}
          <form onSubmit={handleActivate}>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={handleKeyChange}
                placeholder="KOLA-XXXXX-XXXXX-XXXXX-XXXXX"
                className="flex-1 bg-stone-900 border border-stone-600 rounded px-3 py-2.5 text-[13px] font-mono text-white placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !licenseKey.trim()}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 font-semibold text-[13px] px-5 py-2.5 rounded cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-stone-900/30 border-t-stone-900 rounded-full animate-spin" />
                ) : (
                  <>
                    Activer
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-3 text-red-400 text-[12px] bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default LicenseGate;
