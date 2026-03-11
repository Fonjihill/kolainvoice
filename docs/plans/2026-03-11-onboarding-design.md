# Onboarding Premiere Utilisation — Design

## Concept

Un ecran plein qui s'affiche au lieu du Dashboard quand `company_name` est vide. L'utilisateur remplit ses infos entreprise essentielles, clique "Commencer", et arrive sur le Dashboard. L'ecran ne reapparait plus jamais.

## Detection

- Au chargement de l'app, on fetch les settings
- Si `company_name === ""` → afficher l'ecran Onboarding
- Si `company_name` non vide → afficher le Dashboard normalement

## Interface

- Ecran plein, centre, sans sidebar (pas de navigation visible)
- Titre : "Bienvenue sur Kola Invoice"
- Sous-titre : "Configurez votre entreprise pour commencer"
- Formulaire avec 6 champs :
  - Nom de l'entreprise (text, requis)
  - Adresse (textarea, requis)
  - Telephone (text, requis)
  - Email (text, requis)
  - NIU (text, requis)
  - Logo (upload image, optionnel)
- Bouton "Commencer" — sauvegarde les settings et redirige vers le Dashboard
- Validation : `company_name` ne peut pas etre vide (les autres encourages mais pas bloquants)

## Flow technique

1. `App.tsx` : ajouter un state `needsOnboarding`
2. Au mount, fetch settings → si `company_name === ""` → `needsOnboarding = true`
3. Si `needsOnboarding` → render `<OnboardingPage>` sans sidebar
4. `OnboardingPage` appelle `save_settings` avec les champs remplis
5. Apres save → `needsOnboarding = false` → affiche le layout normal avec Dashboard

## Ce qui ne change pas

- La page Settings reste complete (tous les 42 champs)
- L'onboarding ne touche que 6 champs, le reste garde les defaults
- Aucune migration necessaire — on utilise les champs existants
