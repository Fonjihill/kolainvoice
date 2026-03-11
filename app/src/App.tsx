import { useEffect, useState } from "react";
import Toaster from "./components/ui/Toaster";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Package,
  Tag,
  Settings,
  type LucideIcon,
} from "lucide-react";

// --- Pages (lazy-loaded later, stubs for now) ---
import SettingsPage from "./pages/Settings";
import ClientsPage from "./pages/Clients";
import CataloguePage from "./pages/Catalogue";
import InvoicesPage from "./pages/Invoices";
import InvoiceFormPage from "./pages/InvoiceForm";
import CategoriesPage from "./pages/Categories";
import QuotesPage from "./pages/Quotes";
import QuoteFormPage from "./pages/QuoteForm";
import DashboardPage from "./pages/Dashboard";
import OnboardingPage from "./pages/Onboarding";
import LicenseGatePage from "./pages/LicenseGate";
import { getSettings } from "./api/settings";
import { getLicenseStatus } from "./api/license";
import { useLicense } from "./hooks/useLicense";

// ─── Types ───────────────────────────────────────
export type Screen =
  | "dashboard"
  | "quotes"
  | "quote-form"
  | "invoices"
  | "invoice-form"
  | "clients"
  | "catalogue"
  | "categories"
  | "settings";

export type NavigateFn = (screen: string, params?: Record<string, unknown>) => void;

// ─── Sidebar config ──────────────────────────────
interface NavSection {
  label: string;
  items: { screen: Screen; icon: LucideIcon; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Principal",
    items: [{ screen: "dashboard", icon: LayoutDashboard, label: "Tableau de bord" }],
  },
  {
    label: "Ventes",
    items: [
      { screen: "quotes", icon: FileText, label: "Devis" },
      { screen: "invoices", icon: Receipt, label: "Factures" },
    ],
  },
  {
    label: "Referentiels",
    items: [
      { screen: "clients", icon: Users, label: "Clients" },
      { screen: "catalogue", icon: Package, label: "Catalogue" },
      { screen: "categories", icon: Tag, label: "Categories" },
    ],
  },
];

/** Map sub-screens to their parent for sidebar highlighting */
function sidebarTarget(screen: Screen): string {
  const map: Record<string, string> = {
    "invoice-form": "invoices",
    "quote-form": "quotes",
  };
  return map[screen] ?? screen;
}

// ─── App ─────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [licenseState, setLicenseState] = useState<"loading" | "trial" | "active" | "expired">("loading");
  const [trialDays, setTrialDays] = useState<number>(0);
  const [showLicenseGate, setShowLicenseGate] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setNeedsOnboarding(!s.company_name))
      .catch(() => setNeedsOnboarding(true));
  }, []);

  useEffect(() => {
    if (needsOnboarding === false) {
      getLicenseStatus()
        .then((s) => {
          setLicenseState(s.state as "trial" | "active" | "expired");
          if (s.trial_days_remaining) setTrialDays(s.trial_days_remaining);
          // Pre-load license store
          useLicense.getState().fetch();
        })
        .catch(() => setLicenseState("expired"));
    }
  }, [needsOnboarding]);

  function navigate(target: string, p?: Record<string, unknown>) {
    setScreen(target as Screen);
    setParams(p ?? {});
  }

  const active = sidebarTarget(screen);

  if (needsOnboarding === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-stone-400 text-sm">Chargement...</div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <>
        <Toaster />
        <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
      </>
    );
  }

  if (licenseState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="text-stone-400 text-sm">Chargement...</div>
      </div>
    );
  }

  if (licenseState === "expired" || showLicenseGate) {
    return (
      <>
        <Toaster />
        <LicenseGatePage
          onActivated={() => {
            setLicenseState("active");
            setShowLicenseGate(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Trial banner */}
      {licenseState === "trial" && (
        <div className="bg-amber-500/10 text-amber-600 text-xs py-1 px-4 flex items-center justify-between shrink-0">
          <span>
            Essai gratuit : {trialDays} jour{trialDays > 1 ? "s" : ""} restant{trialDays > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowLicenseGate(true)}
            className="text-amber-600 hover:text-amber-700 font-semibold cursor-pointer flex items-center gap-0.5"
          >
            Acheter une licence
            <span className="text-[10px]">&rarr;</span>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
      <Toaster />

      {/* ── Sidebar ── */}
      <aside className="w-[210px] bg-stone-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b border-stone-700">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🌰</span>
            <div>
              <div className="font-serif text-lg text-white leading-none">
                Kola Invoice
              </div>
              <div className="font-mono text-[10px] text-amber-400 mt-[3px] tracking-[0.1em]">
                v1.0.0
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-stone-600 px-4 pt-3.5 pb-1">
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.screen}
                  onClick={() => navigate(item.screen)}
                  className={`w-full flex items-center gap-[9px] px-4 py-[9px] text-[13px] cursor-pointer border-l-[3px] text-left select-none transition-all duration-100 ${
                    active === item.screen
                      ? "bg-amber-500/10 border-l-amber-500 text-amber-400 font-semibold"
                      : "border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-200"
                  }`}
                >
                  <item.icon
                    size={16}
                    className={`shrink-0 ${
                      active === item.screen ? "opacity-100" : "opacity-70"
                    }`}
                  />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-stone-700 py-1.5 pb-2">
          <button
            onClick={() => navigate("settings")}
            className={`w-full flex items-center gap-[9px] px-4 py-[9px] text-[13px] cursor-pointer border-l-[3px] text-left select-none transition-all duration-100 ${
              active === "settings"
                ? "bg-amber-500/10 border-l-amber-500 text-amber-400 font-semibold"
                : "border-transparent text-stone-400 hover:bg-white/5 hover:text-stone-200"
            }`}
          >
            <Settings
              size={16}
              className={`shrink-0 ${
                active === "settings" ? "opacity-100" : "opacity-70"
              }`}
            />
            Parametres
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScreenContent screen={screen} params={params} onNavigate={navigate} />
      </div>
      </div>
    </div>
  );
}

// ─── Screen router ───────────────────────────────
function ScreenContent({
  screen,
  params,
  onNavigate,
}: {
  screen: Screen;
  params: Record<string, unknown>;
  onNavigate: NavigateFn;
}) {
  switch (screen) {
    case "settings":
      return <SettingsPage />;
    case "clients":
      return <ClientsPage onNavigate={onNavigate} />;
    case "catalogue":
      return <CataloguePage onNavigate={onNavigate} />;
    case "invoices":
      return <InvoicesPage onNavigate={onNavigate} />;
    case "invoice-form":
      return (
        <InvoiceFormPage
          invoiceId={params.invoiceId as number | undefined}
          mode={params.mode as string | undefined}
          onBack={() => onNavigate("invoices")}
          onNavigate={onNavigate}
        />
      );
    case "quotes":
      return <QuotesPage onNavigate={onNavigate} />;
    case "quote-form":
      return (
        <QuoteFormPage
          quoteId={params.quoteId as number | undefined}
          mode={params.mode as string | undefined}
          onBack={() => onNavigate("quotes")}
          onNavigate={onNavigate}
        />
      );
    case "categories":
      return <CategoriesPage />;
    case "dashboard":
      return <DashboardPage onNavigate={onNavigate} />;
    default:
      return <PlaceholderScreen screen={screen} onNavigate={onNavigate} />;
  }
}


// ─── Placeholder screen ──────────────────────────
function PlaceholderScreen({
  screen,
  onNavigate: _,
}: {
  screen: Screen;
  onNavigate: NavigateFn;
}) {
  const titles: Record<string, string> = {
    quotes: "Devis",
    categories: "Categories",
    "quote-form": "Nouveau devis",
  };
  return (
    <>
      <Topbar title={titles[screen] ?? screen} />
      <div className="flex-1 overflow-y-auto p-5 px-6 bg-stone-50">
        <div className="bg-white border border-stone-200 p-6 text-center text-stone-400 text-sm">
          Page &laquo;{titles[screen] ?? screen}&raquo; — a venir
        </div>
      </div>
    </>
  );
}

// ─── Shared Topbar component ─────────────────────
export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="bg-white border-b border-stone-200 px-6 h-[54px] flex items-center justify-between shrink-0">
      <div>
        <h1 className="font-serif text-[19px] text-stone-900">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-stone-400 mt-px">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </header>
  );
}

export default App;
