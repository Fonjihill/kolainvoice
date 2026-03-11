# Phase 0 — Squelette du projet Kola Invoice

## Objectif
Avoir une fenêtre Tauri 2 qui s'ouvre avec un frontend React fonctionnel, prouvant que la glue IPC marche entre React et Rust.

## Critère de succès
- `cargo tauri dev` lance l'application
- La fenêtre affiche le layout de base (sidebar + zone principale)
- Un bouton "ping" appelle une commande Rust via IPC et affiche la réponse
- Le projet est structuré selon l'architecture définie dans la spec technique

## Stack validée
| Couche | Technologie | Version |
|--------|-------------|---------|
| Desktop | Tauri | 2.x |
| Backend | Rust | stable (1.77+) |
| Frontend | React + TypeScript | 18.x |
| Bundler | Vite | 5.x |
| Style | Tailwind CSS | 3.x |
| State | Zustand | 5.x |
| DB | SQLite (rusqlite) | 0.31+ |
| PDF | typst (lib) | latest |
| Update | tauri-plugin-updater | 2.x |

## Prérequis machine
- macOS : Xcode Command Line Tools
- Node.js 20 (déjà installé)
- Rust via rustup (à installer)

## Structure créée
```
app/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Entry point Tauri + commande ping
│   │   ├── commands/
│   │   │   └── mod.rs
│   │   ├── database/
│   │   │   └── mod.rs
│   │   ├── models/
│   │   │   └── mod.rs
│   │   └── pdf/
│   │       └── mod.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── api/
│   │   └── ping.ts           # Premier appel IPC
│   ├── pages/
│   ├── components/
│   │   └── layout/
│   │       └── Sidebar.tsx
│   ├── hooks/
│   ├── i18n/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── index.html
```

## Ce qui n'est PAS dans Phase 0
- Pas de SQLite
- Pas de vrais écrans (juste le layout shell)
- Pas d'i18n
- Pas de PDF
- Pas d'auto-update
