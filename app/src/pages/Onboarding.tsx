import { useEffect, useState } from "react";
import { getSettings, saveSettings, type Settings, type SaveSettingsPayload } from "../api/settings";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

type Stage = "splash" | "form" | "loading";

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<Stage>("splash");
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Form state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyNiu, setCompanyNiu] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Loading stage
  const [loadingStep, setLoadingStep] = useState(0);
  const LOADING_STEPS = [
    "Sauvegarde des parametres...",
    "Configuration de l'entreprise...",
    "Preparation du tableau de bord...",
  ];

  // Splash animation
  useEffect(() => {
    const t1 = setTimeout(() => setFadeIn(true), 100);
    const t2 = setTimeout(() => setFadeOut(true), 2200);
    const t3 = setTimeout(() => {
      setStage("form");
      setFadeIn(false);
      setFadeOut(false);
      setTimeout(() => setFadeIn(true), 50);
    }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Load settings
  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setCompanyName(s.company_name);
        setCompanyAddress(s.company_address);
        setCompanyPhone(s.company_phone);
        setCompanyEmail(s.company_email);
        setCompanyNiu(s.company_niu);
        setLogoPath(s.logo_path);
      })
      .catch(() => {});
  }, []);

  async function handlePickLogo() {
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
      setLogoPath(newPath);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!companyName.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    if (!settings) return;

    // Transition to loading stage
    setFadeOut(true);
    await new Promise((r) => setTimeout(r, 400));
    setStage("loading");
    setFadeIn(false);
    setFadeOut(false);
    setTimeout(() => setFadeIn(true), 50);

    // Animate loading steps
    setLoadingStep(0);
    await new Promise((r) => setTimeout(r, 600));

    // Save
    const { id: _, ...rest } = settings;
    const payload: SaveSettingsPayload = {
      ...rest,
      company_name: companyName.trim(),
      company_address: companyAddress,
      company_phone: companyPhone,
      company_email: companyEmail,
      company_niu: companyNiu,
      logo_path: logoPath,
    };

    try {
      await saveSettings(payload);
    } catch {
      setStage("form");
      setFadeIn(true);
      setFadeOut(false);
      setError("Erreur lors de la sauvegarde. Veuillez reessayer.");
      return;
    }

    setLoadingStep(1);
    await new Promise((r) => setTimeout(r, 500));
    setLoadingStep(2);
    await new Promise((r) => setTimeout(r, 600));

    // Final fade out then complete
    setFadeOut(true);
    await new Promise((r) => setTimeout(r, 500));
    onComplete();
  }

  // ── Splash ──
  if (stage === "splash") {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div
          className={`text-center transition-all duration-700 ${
            fadeOut ? "opacity-0 scale-95" : fadeIn ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div
            className={`text-[64px] mb-4 transition-all duration-1000 delay-200 ${
              fadeIn && !fadeOut ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            🌰
          </div>
          <div
            className={`font-serif text-[32px] text-white tracking-wide transition-all duration-700 delay-500 ${
              fadeIn && !fadeOut ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            Kola Invoice
          </div>
          <div
            className={`font-mono text-[12px] text-amber-400 mt-2 tracking-[0.15em] transition-all duration-700 delay-700 ${
              fadeIn && !fadeOut ? "opacity-100" : "opacity-0"
            }`}
          >
            FACTURATION PROFESSIONNELLE
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div
          className={`text-center transition-all duration-500 ${
            fadeOut ? "opacity-0 scale-95" : fadeIn ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="text-[48px] mb-5">🌰</div>
          <div className="font-serif text-[22px] text-stone-800 mb-6">
            Preparation en cours...
          </div>

          {/* Progress bar */}
          <div className="w-[280px] mx-auto mb-5">
            <div className="h-1 bg-stone-200 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500 ease-out"
                style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current step */}
          <div className="text-[13px] text-stone-500 h-5">
            {LOADING_STEPS[loadingStep]}
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center py-8">
      <div
        className={`bg-white border border-stone-200 w-full max-w-lg transition-all duration-500 ${
          fadeOut ? "opacity-0 translate-y-4" : fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="bg-stone-900 px-8 py-6 text-center">
          <div className="text-[36px] mb-1">🌰</div>
          <div className="font-serif text-[22px] text-white">Kola Invoice</div>
          <div className="font-mono text-[10px] text-amber-400 mt-1 tracking-[0.12em]">
            CONFIGURATION INITIALE
          </div>
        </div>

        <div className="px-8 py-6">
          <h1 className="text-[17px] font-semibold text-stone-800">
            Bienvenue !
          </h1>
          <p className="text-[13px] text-stone-500 mt-1 mb-5">
            Renseignez les informations de votre entreprise. Elles apparaitront sur vos factures et devis.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Nom */}
            <Field label="Nom de l'entreprise *">
              <input
                className="form-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Bomunto SARL"
                autoFocus
              />
            </Field>

            {/* 2 colonnes: Tel + Email */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telephone">
                <input
                  className="form-input"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+237 6XX XXX XXX"
                />
              </Field>
              <Field label="Email">
                <input
                  className="form-input"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="contact@entreprise.cm"
                />
              </Field>
            </div>

            {/* NIU */}
            <Field label="NIU (Numero d'Identification Unique)">
              <input
                className="form-input font-mono"
                value={companyNiu}
                onChange={(e) => setCompanyNiu(e.target.value)}
                placeholder="Numero fiscal"
              />
            </Field>

            {/* Adresse */}
            <Field label="Adresse">
              <textarea
                className="form-input"
                rows={2}
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Douala, Cameroun"
              />
            </Field>

            {/* Logo */}
            <Field label="Logo (optionnel)">
              {logoPath ? (
                <div className="border-2 border-solid border-amber-400 p-3 text-center bg-amber-50 relative">
                  <img
                    src={convertFileSrc(logoPath)}
                    alt="Logo"
                    className="max-h-[60px] mx-auto object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoPath(null)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[11px] leading-none flex items-center justify-center cursor-pointer hover:bg-red-600"
                    title="Supprimer"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-stone-300 p-3 text-center cursor-pointer bg-stone-50 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  onClick={handlePickLogo}
                >
                  <div className="text-[12px] text-stone-400">
                    Cliquer pour choisir un logo (PNG, JPG)
                  </div>
                </div>
              )}
            </Field>

            {error && (
              <div className="text-red-600 text-[12px] bg-red-50 border border-red-200 px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-[14px] mt-2"
              disabled={!settings}
            >
              Commencer
            </button>

            <p className="text-[11px] text-stone-400 text-center">
              Vous pourrez modifier ces informations dans les Parametres.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold tracking-[0.08em] uppercase text-stone-600">
        {label}
      </label>
      {children}
    </div>
  );
}

export default Onboarding;
