# Licensing System Design

> Validated 2026-03-11

## Model
- **Subscription**: mensuel (5 000 FCFA) + annuel (45 000 FCFA)
- **Plan unique**: tout inclus, seul le cycle change
- **Essai gratuit**: 14 jours à la première installation

## Activation
- **Clé de licence**: `KOLA-XXXX-XXXX-XXXX-XXXX`
- **Ancrage**: Device ID (hash matériel unique, immuable, invisible pour l'utilisateur)
- **Sécurité**: Cryptographie asymétrique Ed25519
  - Clé privée: dans Kola Desktop Admin uniquement
  - Clé publique: embarquée dans Kola Invoice
- **100% offline**: aucune connexion internet requise pour valider

## Device ID
- Hash SHA-256 de: hardware UUID (macOS) / machine GUID (Windows) + hostname
- Généré automatiquement à la première installation
- Affiché dans l'écran de licence pour que l'utilisateur le communique
- Non modifiable par l'utilisateur

## Contenu de la clé (encodé + signé)
- Device ID
- Type: mensuel / annuel / trial
- Date d'expiration
- Signature Ed25519

## Flux utilisateur
1. Installe l'app → essai 14 jours automatique
2. Écran de licence affiche le Device ID
3. Paie par MoMo (MTN/Orange) ou virement manuel
4. Communique son Device ID par WhatsApp/SMS
5. Admin génère la clé via Kola Desktop Admin → envoie par SMS/WhatsApp
6. Utilisateur entre la clé → app vérifie signature + Device ID + expiration
7. À l'expiration → blocage total → repaie → nouvelle clé

## Expiration
- **Blocage total**: écran "Renouvelez votre licence" bloque tout accès
- L'utilisateur ne peut rien voir ni faire tant que la licence n'est pas renouvelée

## Renouvellement
- Nouvelle clé à chaque renouvellement (même mécanisme que l'activation)
- Admin retrouve le Device ID dans l'historique

## Paiement
- Mobile Money: MTN MoMo, Orange Money
- Paiement manuel: virement bancaire

## Machines
- 1 clé = 1 machine
- 2 machines = 2 clés séparées

## Kola Desktop Admin (repo séparé)
- App Tauri desktop (même stack)
- Repo séparé (clé privée ne doit jamais être dans le repo client)
- Fonctionnalités:
  - Générer des clés de licence
  - Historique des licences (client, Device ID, dates, statut)
  - Rechercher par Device ID pour renouvellement
  - Dashboard: licences actives, expirées, revenus
