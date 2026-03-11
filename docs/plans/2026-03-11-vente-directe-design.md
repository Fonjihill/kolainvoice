# Vente Directe — Design

## Concept

Une vente directe reutilise le formulaire de facture existant, pre-configure pour une vente au comptoir. En un clic "Encaisser", le systeme cree la facture, enregistre le paiement, et passe le statut a "payee" — tout en une seule operation atomique.

## Client anonyme

- Un client systeme **"Client anonyme"** cree automatiquement au premier lancement (via migration SQL)
- Marque avec un flag `is_system = 1` pour le distinguer (non modifiable, non archivable)
- Pre-selectionne par defaut en mode vente directe, mais l'utilisateur peut choisir un autre client

## Interface

- **Bouton "Vente directe"** sur le Dashboard (acces rapide) et sur la page Factures (a cote de "Nouvelle facture")
- Ouvre le meme `InvoiceForm` avec un parametre `mode: "direct-sale"`
- Pre-remplissage : client anonyme, date du jour, pas d'echeance
- Le bouton "Enregistrer" est remplace par **"Encaisser"** + selecteur de mode de paiement
- Apres encaissement → redirige vers le mode lecture avec option PDF/recu

## Backend (une seule operation)

- Nouveau command Rust `create_direct_sale` qui dans une transaction :
  1. Cree la facture (statut "paid" directement)
  2. Cree le paiement (recu REC-YYYY-NNNN)
  3. Met a jour `amount_paid = total`
- Pas de passage par draft → sent → paid

## Numerotation

- Meme sequence FAC-YYYY-NNNN que les factures normales
- Le recu suit la sequence REC-YYYY-NNNN existante

## Ce qui ne change pas

- Le formulaire de facture classique reste identique
- Le systeme de paiements partiel reste identique
- Les stats/filtres continuent de fonctionner (la vente directe apparait comme "Payee")
