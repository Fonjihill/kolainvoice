# Onboarding Premiere Utilisation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a full-screen onboarding form on first launch (when company_name is empty) so the user can enter essential company info before reaching the Dashboard.

**Architecture:** Add an `OnboardingPage` component. In `App.tsx`, fetch settings on mount — if `company_name` is empty, render OnboardingPage instead of the sidebar+main layout. After save, switch to normal layout.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4

---

### Task 1: Create OnboardingPage component

**Files:**
- Create: `app/src/pages/Onboarding.tsx`

**Implementation:**

Create `app/src/pages/Onboarding.tsx` — a full-screen centered form with:

- Background: `bg-stone-50 min-h-screen flex items-center justify-center`
- Card: white box, max-w-lg, centered, with padding
- Header: Kola Invoice logo (emoji 🌰 + text), title "Bienvenue sur Kola Invoice", subtitle "Configurez votre entreprise pour commencer"
- Form fields:
  - Nom de l'entreprise (text input, required)
  - Adresse (textarea)
  - Telephone (text input)
  - Email (text input)
  - NIU (text input)
  - Logo (file upload using the existing `copy_image_to_app_data` command pattern from Settings.tsx)
- Button "Commencer" at bottom — calls `saveSettings` with the filled fields + all other settings defaults
- On success: calls `onComplete()` callback

Props:
```typescript
interface OnboardingPageProps {
  onComplete: () => void;
}
```

Logic:
1. Fetch current settings with `getSettings()` on mount (to get defaults for all other fields)
2. User fills in the 6 fields
3. On submit: merge user input into the full settings object, call `saveSettings()`
4. On success: call `onComplete()`

Use the same styling patterns as the rest of the app: `form-input` class, `font-sans text-[13px]`, `btn-primary`, etc.

For the logo upload, look at how Settings.tsx handles it (uses `open` from `@tauri-apps/plugin-dialog` and `copy_image_to_app_data` command). Replicate that pattern.

**Verify:**
Run: `cd app && npx tsc --noEmit`

---

### Task 2: Integrate OnboardingPage in App.tsx

**Files:**
- Modify: `app/src/App.tsx`

**Implementation:**

1. Import OnboardingPage and getSettings:
```typescript
import OnboardingPage from "./pages/Onboarding";
import { getSettings } from "./api/settings";
import { useEffect } from "react";  // already imported as useState
```

2. Add state in the App component:
```typescript
const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null); // null = loading
```

3. Add useEffect to check settings on mount:
```typescript
useEffect(() => {
  getSettings()
    .then((s) => setNeedsOnboarding(!s.company_name))
    .catch(() => setNeedsOnboarding(true));
}, []);
```

4. Add early returns before the main layout:
```typescript
// Loading state
if (needsOnboarding === null) {
  return (
    <div className="flex h-screen items-center justify-center bg-stone-50">
      <div className="text-stone-400 text-sm">Chargement...</div>
    </div>
  );
}

// Onboarding
if (needsOnboarding) {
  return (
    <>
      <Toaster />
      <OnboardingPage onComplete={() => setNeedsOnboarding(false)} />
    </>
  );
}
```

Place these before the existing `return <div className="flex h-screen ...">` block.

**Verify:**
Run: `cd app && npx tsc --noEmit`

---

### Task 3: Final verification

**Step 1: TypeScript check**
Run: `cd app && npx tsc --noEmit`

**Step 2: Rust check**
Run: `cd app/src-tauri && cargo check`

**Step 3: Manual test**
To test onboarding, temporarily clear company_name in the database, or delete the database file to trigger a fresh migration. The onboarding should appear. Fill in the form, click "Commencer", and verify it saves and redirects to the Dashboard.
