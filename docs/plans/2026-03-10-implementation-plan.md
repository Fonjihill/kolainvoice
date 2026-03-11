# Kola Invoice — Plan d'implémentation complet

## Vue d'ensemble des phases

| Phase | Objectif | Risque neutralisé | Dépend de |
|-------|----------|-------------------|-----------|
| 0 | Squelette Tauri + React | Setup, IPC basique | — |
| 1 | Database + Migrations | Migrations SQLite | Phase 0 |
| 2 | Paramètres (end-to-end) | Sérialisation IPC complète | Phase 1 |
| 3 | Clients | CRUD pattern validé | Phase 2 |
| 4 | Catalogue | Réutilisation du pattern | Phase 3 |
| 5 | Factures | Calculs montants, logique métier | Phase 4 |
| 6 | Devis + conversion | Conversion devis→facture | Phase 5 |
| 7 | Dashboard | Requêtes d'agrégation | Phase 6 |
| 8 | PDF (typst) | Rendu document pro | Phase 5 |
| 9 | Sauvegarde / Restauration | Copie fichier .db | Phase 1 |
| 10 | Auto-update | Build signé + GitHub Releases | Phase 0 |
| 11 | Polish (i18n, impression, auto-save) | Finitions UX | Phase 5+ |

---

## Phase 0 — Squelette

### Étape 0.1 : Installer Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
xcode-select --install  # si pas déjà fait
```

### Étape 0.2 : Créer le projet Tauri
```bash
cd app/
npm create tauri-app@latest . -- --template react-ts
```
- Configurer Vite + React + TypeScript

### Étape 0.3 : Installer Tailwind CSS
```bash
npm install -D tailwindcss @tailwindcss/vite
```
- Configurer les tokens du design system (stone + amber)

### Étape 0.4 : Installer Zustand
```bash
npm install zustand
```

### Étape 0.5 : Structurer les dossiers Rust
- Créer commands/, database/, models/, pdf/ dans src-tauri/src/
- Créer une commande `ping` de test

### Étape 0.6 : Structurer les dossiers React
- Créer api/, pages/, components/, hooks/, i18n/ dans src/
- Créer le composant Sidebar (layout shell)
- Appeler `invoke('ping')` depuis React

### Étape 0.7 : Valider
- `cargo tauri dev` ouvre la fenêtre
- Le ping IPC fonctionne
- Tailwind rend les classes correctement

---

## Phase 1 — Database + Migrations

### Étape 1.1 : Configurer rusqlite dans Cargo.toml
### Étape 1.2 : Créer le module database/mod.rs (init connexion)
### Étape 1.3 : Créer le système de migrations (database/migrations.rs)
### Étape 1.4 : Écrire 001_init.sql (toutes les tables V1)
### Étape 1.5 : Implémenter le backup automatique avant migration
### Étape 1.6 : Brancher la DB sur l'AppState Tauri
### Étape 1.7 : Valider — l'app démarre, les tables existent

---

## Phase 2 — Paramètres (premier aller-retour complet)

### Étape 2.1 : Créer models/settings.rs (struct Settings + DTOs)
### Étape 2.2 : Créer database/settings.rs (get + save)
### Étape 2.3 : Créer commands/settings.rs (get_settings, save_settings)
### Étape 2.4 : Créer src/api/settings.ts (invoke wrapper)
### Étape 2.5 : Créer src/hooks/useSettings.ts
### Étape 2.6 : Créer src/pages/Settings.tsx (formulaire)
### Étape 2.7 : Valider — saisir des infos, recharger, les retrouver

---

## Phase 3 — Clients

### Étape 3.1 : models/client.rs
### Étape 3.2 : database/clients.rs (CRUD + search + archive)
### Étape 3.3 : commands/clients.rs
### Étape 3.4 : src/api/clients.ts
### Étape 3.5 : src/hooks/useClients.ts
### Étape 3.6 : src/pages/Clients.tsx (liste + fiche + formulaire)
### Étape 3.7 : Valider — créer, modifier, archiver, rechercher

---

## Phase 4 — Catalogue

### Même pattern que Phase 3 pour les produits/services

---

## Phase 5 — Factures (le cœur)

### Étape 5.1 : models/invoice.rs (Invoice, InvoiceLine, DTOs)
### Étape 5.2 : database/invoices.rs (CRUD + lignes + paiements)
### Étape 5.3 : Implémenter la numérotation atomique (FAC-YYYY-NNNN)
### Étape 5.4 : Implémenter les calculs côté Rust (arrondi FCFA)
### Étape 5.5 : commands/invoices.rs
### Étape 5.6 : src/api/invoices.ts
### Étape 5.7 : src/hooks/useInvoices.ts
### Étape 5.8 : src/pages/Invoices.tsx (liste + filtres + pagination)
### Étape 5.9 : src/pages/InvoiceForm.tsx (création + édition + lignes)
### Étape 5.10 : Gestion des statuts et transitions
### Étape 5.11 : Enregistrement des paiements
### Étape 5.12 : Valider — cycle complet brouillon → envoyée → payée

---

## Phase 6 — Devis + conversion

### Étape 6.1 : models/quote.rs
### Étape 6.2 : database/quotes.rs
### Étape 6.3 : Implémenter convert_quote_to_invoice (copie atomique)
### Étape 6.4 : commands/quotes.rs
### Étape 6.5 : src/api/quotes.ts + src/hooks/useQuotes.ts
### Étape 6.6 : src/pages/Quotes.tsx (liste + formulaire inline)
### Étape 6.7 : Vérification automatique des devis expirés
### Étape 6.8 : Valider — cycle devis → accepté → facture créée

---

## Phase 7 — Dashboard

### Étape 7.1 : database/stats.rs (requêtes d'agrégation)
### Étape 7.2 : commands/dashboard.rs (get_dashboard_stats)
### Étape 7.3 : src/pages/Dashboard.tsx (stats + alertes + récents)
### Étape 7.4 : Valider — chiffres cohérents avec les données

---

## Phase 8 — PDF (typst)

### Étape 8.1 : Ajouter typst comme dépendance Cargo
### Étape 8.2 : Créer les templates (facture + devis) en typst markup
### Étape 8.3 : Implémenter pdf/invoice_pdf.rs (inject données → compile PDF)
### Étape 8.4 : Implémenter pdf/quote_pdf.rs
### Étape 8.5 : Gérer logo + tampon (images embarquées)
### Étape 8.6 : Gérer la langue (fr/en) dans les templates
### Étape 8.7 : Valider — PDF conforme à la maquette, accents OK, pagination OK

---

## Phase 9 — Sauvegarde / Restauration

### Étape 9.1 : commands/backup.rs (export_database, import_database)
### Étape 9.2 : UI dans Settings (boutons export/import + file dialog)
### Étape 9.3 : Valider — exporter, effacer, restaurer, données intactes

---

## Phase 10 — Auto-update

### Étape 10.1 : Configurer tauri-plugin-updater dans tauri.conf.json
### Étape 10.2 : Créer .github/workflows/release.yml
### Étape 10.3 : Générer les clés de signature Tauri
### Étape 10.4 : Composant UpdateBanner.tsx
### Étape 10.5 : Valider — tag → build → release → notification dans l'app

---

## Phase 11 — Polish

### Étape 11.1 : i18n (fr.json + en.json) sur tous les écrans
### Étape 11.2 : Auto-save brouillons (debounce 30s)
### Étape 11.3 : Impression via API native Tauri
### Étape 11.4 : Assistant première utilisation (onboarding 3 étapes)
### Étape 11.5 : Gestion imprimantes (get_printers)
### Étape 11.6 : Tests finaux + cleanup
