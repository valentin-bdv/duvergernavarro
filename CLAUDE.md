# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Site vitrine statique de Duverger Navarro (plombier chauffagiste à Luglon, Landes), hébergé sur **GitHub Pages** (`.nojekyll` présent). HTML/CSS/JS vanilla : pas de build, pas de dépendances npm, pas de tests ni de linter. Tout le contenu et les commentaires du code sont en français.

## Développement

Servir le dossier en local (nécessaire pour Leaflet et les chemins relatifs) :

```sh
python3 -m http.server 8000   # puis http://localhost:8000
```

Il n'y a rien à compiler : les fichiers sont publiés tels quels.

## Architecture

- `index.html` — page unique (hero, carrousel des services `.svc`, entreprise + carte `#map`, références/logos, formulaire de devis `#devis-form`). Les illustrations des services sont des **SVG inline animés** ; leurs `id` (`<linearGradient>`, `<clipPath>`, `<pattern>`…) partagent l'espace de noms du document, donc tout nouvel `id` doit être unique dans la page.
- `mentions-legales.html` — réutilise `assets/style.css` et `assets/main.js`. Son header porte déjà la classe `scrolled`, que `main.js` détecte pour le garder opaque ; le JS doit donc tolérer l'absence des éléments propres à l'accueil (d'où les `?.` et les gardes `if (svc)`, `if (mapEl)`).
- `assets/main.js` — une seule IIFE découpée en blocs commentés : statut ouvert/fermé (heure de Paris), header au scroll, scrollspy de la nav, menu mobile, `.reveal` au scroll, carrousel des services, carte Leaflet, formulaire.
- `assets/style.css` — design tokens dans `:root` (palette encre/crème/cuivre, polices Fraunces + Inter via Google Fonts). Breakpoints : 980px, 700px, 560px ; `prefers-reduced-motion` est respecté (CSS et carrousel JS).
- `assets/landes.js` — contour GeoJSON simplifié du département, exposé en `window.LANDES_GEOJSON` ; doit être chargé avant `main.js`. Leaflet 1.9.4 vient de cdnjs ; si Leaflet ne charge pas, `main.js` retombe sur un iframe OpenStreetMap.

### Points non évidents

- **Formulaire de devis** : pas de backend (site statique). L'envoi construit un lien `mailto:` vers l'adresse de l'entreprise puis affiche l'état `.sent` (avec « copier l'adresse » et « modifier ma demande »).
- **Carrousel des services** : boucle infinie où chaque slide est positionnée selon son écart à une position flottante (`pos` → `target`, lissage exponentiel). L'autodéfilement est suspendu tant que l'ensemble `reasons` (`reduce`, `offscreen`, `hidden`, `drag`, `manual`, `intro`) n'est pas vide ; une interaction manuelle le coupe 45 s. Une animation d'entrée fait arriver la première slide depuis la droite quand la carte devient visible.
- **Données dupliquées à garder synchronisées** quand l'entreprise change ses infos :
  - horaires : objet `HOURS` dans `main.js`, lignes `.hours-row[data-days]` dans `index.html`, et `openingHoursSpecification` du JSON-LD ;
  - téléphone / e-mail / adresse / SIREN : JSON-LD, multiples liens `tel:`/`mailto:` dans `index.html`, `mentions-legales.html`, et la constante `MAIL` de `main.js` ;
  - coordonnées `44.082, -0.717` : JSON-LD et marqueur Leaflet.
