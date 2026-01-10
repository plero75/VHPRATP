# 📘 CAHIER DES CHARGES
## Dashboard Mobilité – Joinville / Vincennes / Hippodrome

---

## 1. Objectif du dispositif

Créer **un écran unique d'information voyageurs**, en temps réel, lisible à distance, couvrant l'ensemble des transports et services autour de :
- **Joinville-le-Pont** (RER A, bus)
- **Hippodrome de Vincennes** (bus)
- **École du Breuil** (bus)

### Sans compromis :
- ✅ **Pas de scroll** – toutes les infos visibles d'un coup
- ✅ **Pas d'onglets** – aucune disparition d'information
- ✅ **Aucune ligne ne disparaît** – même en situation perturbée
- ✅ **Temps restant + heure affichés ensemble** – lisibilité maximale
- ✅ **Hiérarchie claire et constante** – ARRÊT → LIGNE → DIRECTION → PASSAGES
- ✅ **Lisible de loin** – sur mur, TV, régie, événement

### Contextes d'usage :
- Écran public (mur, télévision)
- Régie / exploitation
- Événement (hippodrome, forte affluence)
- Jour / nuit / dernier service

---

## 2. Architecture logique de l'information

### Hiérarchie stricte

```
┌─ ARRÊT (bloc autonome)
│  ├─ LIGNE (badge couleur + libellé)
│  │  ├─ DIRECTION (texte explicite)
│  │  │  └─ PASSAGES (jusqu'à 3)
│  │  │     ├─ Temps restant (dominant, prioritaire)
│  │  │     ├─ Heure exacte (toujours visible)
│  │  │     └─ Statut explicite (jamais vide)
│  │  ├─ DIRECTION 2
│  │  │  └─ PASSAGES...
│  │  └─ DIRECTION N
│  │     └─ PASSAGES...
│  ├─ LIGNE 2
│  ├─ LIGNE N
├─ ARRÊT 2
└─ ARRÊT N
```

### Règle fondamentale

**JAMAIS l'inverse.**

Ne pas grouper par ligne d'abord, puis par arrêt. L'arrêt est l'unité de lecture.

---

## 3. Arrêts et lignes desservis

### Arrets

| Arrêt | Caractéristique | Lignes |
|------|---|---|
| **Joinville - RER** | Transport de masse | RER A |
| **Joinville - Bus** | Transports locaux | 77, 101, 106, 108, 110, 112, 281, N33 |
| **École du Breuil** | Périphérique | 201 |

### Lignes

| Ligne | Type | Couleur IDFM | Monitoring |
|-------|------|---|---|
| RER A | RER | `#E41E26` (rouge) | `STIF:StopArea:SP:43135:` |
| 77 | Bus | `#0071bc` (bleu) | `STIF:StopPoint:Q:22452:` |
| 101 | Bus | `#f0a500` (orange) | `STIF:StopPoint:Q:21252:` |
| 106 | Bus | `#e4002b` (rouge) | `STIF:StopPoint:Q:27560:` |
| 108 | Bus | `#d10073` (violet) | `STIF:StopPoint:Q:28032:` |
| 110 | Bus | `#642580` (prune) | `STIF:StopPoint:Q:28032:` |
| 112 | Bus | `#ff5a00` (orange) | `STIF:StopPoint:Q:28065:`, `Q:39406:` |
| 201 | Bus | `#6E491E` (marron) | `STIF:StopPoint:Q:39406:`, `Q:22452:` |
| 281 | Bus | `#d9a300` (jaune) | `STIF:StopPoint:Q:28033:` |
| N33 | Bus | `#ff5a00` (orange) | `STIF:StopPoint:Q:39406:` |

### Direction

Pour chaque ligne :
- **Toutes les directions sont listées explicitement**
- Aucune direction n'est implicite ou devinée
- Une direction existe même sans passage actif
- Libellé complet de la destination (ex: "Pont de Levallois", "Saint-Germain-des-Prés")

### Passages

Pour chaque direction :
- **Jusqu'à 3 prochains passages maximum** (affichés)
- **Format standardisé :**
  - Temps restant (dominant, grand, prioritaire)
  - Heure exacte (secondaire, visible)
  - Statut explicite (jamais un vide)

---

## 4. États normalisés

Chaque ligne / direction / passage est toujours dans un **état explicite** :

| État | Affichage | Couleur | Condition |
|------|-----------|--------|----------|
| **Temps réel** | `7 min` + heure | Blanc | Données PRIM actualisées |
| **Horaire théorique** | `14:32` | Gris/Muted | Données horaires, pas temps réel |
| **Retardé** | `+8 min` ou `RETARD` | 🟡 Orange | Status `delayed` |
| **Imminent** | `1 min` (pulse) | 🟢 Vert | Temps restant < 2 min |
| **Service interrompu** | `SERVICE INTERROMPU` | 🔴 Rouge | Status `cancelled` |
| **Service terminé** | `—` ou `SERVICE TERMINÉ` | 🔘 Gris | Pas de données retournées |
| **Information indisponible** | `—` | 🔘 Gris | Erreur API, données manquantes |

### Principe fondamental

**Un état remplace l'information, il ne la supprime jamais.**

Exemple :
- "Temps réel disponible" : `7 min → 14:35 [OK]`
- "Pas de passage" : `— → — [N/A]`
- "Service interrompu" : `— → — [ANNULÉ]`

---

## 5. Structure physique de l'écran

### Dimensions
- **1080px × 1920px** (portrait, HD)
- Adaptation possible pour 4K

### Layout en 4 zones

```
┌──────────────────────────────────────┐  ZONE A (60px)
│  BANDEAU GLOBAL                      │
│  Logo | Titre | Heure | Dern. maj   │
├──────────────────────────────────────┤
│                                      │
│  ZONE B – CŒUR TRANSPORT (dynamique)│  
│  ├─ Arrêt 1                         │  Flex: 1 (remplit l'espace)
│  ├─ Arrêt 2                         │  Scrollable si > hauteur
│  ├─ Arrêt 3                         │
│  └─ Arrêt N                         │
│                                      │
├──────────────────────────────────────┤
│  ZONE C – VUE EXHAUSTIVE (180px)     │
│  📍 Tous les Bus – Vue Complète   │  Grid 3 colonnes
│  ● 77 → Pass 1 • Pass 2            │  Compact, dense, non prioritaire
│  ● 101 → Pass 1 • Pass 2           │  Sert de vérification
│                                      │
├──────────────────────────────────────┤
│  ZONE D – CONTEXTE (120px)           │
│  🚲 Vélib' | 🌤️ Météo           │  2 colonnes
│  « Modules contextuels »             │
└──────────────────────────────────────┘
```

### Zone A – Bandeau global

**Contenu :**
- Logo / Initiales (VH)
- Titre principal : "Dashboard Mobilité"
- Sous-titre : "Joinville-le-Pont • Vincennes • École du Breuil"
- Horloge grande, lisible, en temps réel
- Timestamp "Maj XX:XX"

**Visuels :**
- Dégradé bleu foné (bleu RATP)
- Bordure inférieure jaune/or (#f5a623)
- Ombre dissée
- Hauteur fixe : 60px

### Zone B – Cœur Transport

**Logique :**
- Contenu principal, prioritaire
- **Groupe par arrêt** (pas par ligne)
- Dans chaque arrêt : toutes les lignes desservant
- Dans chaque ligne : toutes les directions
- Dans chaque direction : jusqu'à 3 passages

**Visuels :**
- Fond sombre (#132447)
- Stop-block avec bordure gauche couleur (accent #f5a623)
- Line-item avec bordure couleur (couleur IDFM de la ligne)
- Direction explicite, bien séparée
- Passage dans boîtes distinctes (temps + heure + statut)
- Scrollable en cas de dépassement
- Animations discrètes (pulse sur imminent)

### Zone C – Vue exhaustive

**Contenu :**
- Titre : "📋 Tous les Bus - Joinville (Vue Complète)"
- **Grid 3 colonnes** de bus items
- Chaque item : ligne + 2 prochaines destinations
- Non prioritaire, lecture passive, pour vérification

**Visuels :**
- Fond panel sombre
- Bordure haut : #1e3a5f
- Scrollable en cas de besoin
- Hauteur : max 180px

### Zone D – Contexte

**Modules :**
1. **Vélib'** (2 stations : Vincennes + École du Breuil)
   - Afficher : nombre vélos disponibles
   - Ou : "—" si indisponible
2. **Météo** (Joinville)
   - Emoji + description ("Ensoleillé", "Nuageux", "Pluie")
   - Température

**Visuels :**
- Grid 2 colonnes
- Hauteur fixe : 120px
- Modules avec bordure gauche accent
- Police petite mais lisible

---

## 6. Règles visuelles clés

### Typographie

| Élément | Police | Taille | Poids | Couleur |
|---------|--------|--------|-------|----------|
| Titre Zone A | System | 20px | 700 | Blanc |
| Horloge | Courier | 32px | 700 | #f5a623 |
| Titre arrêt | System | 16px | 700 | #f5a623 |
| Ligne/Badge | System | 13px | 700 | Blanc |
| Direction | System | 12px | 400 | #cbd5e1 |
| Temps passage | System | 14px | 700 | Blanc |
| Heure passage | System | 11px | 400 | #cbd5e1 |
| Statut | System | 9px | 600 | — |
| Module label | System | 11px | 700 | #f5a623 |

### Couleurs de statut

| Statut | Couleur | Code |
|--------|---------|------|
| OK / Normal | Vert | `#22c55e` |
| Retard | Orange | `#eab308` |
| Interrompu | Rouge | `#ef4444` |
| Terminé / N/A | Gris | `#64748b` |
| Imminent | Vert (pulse) | `#22c55e` |

### Espacements

- **Padding** : 16px (blocs), 12px (sections), 10px (items)
- **Gap** : 16px (blocs), 10px (lignes), 8px (passages)
- **Bordure** : 3-5px (gauche, accent)
- **Radius** : 12px (bloc), 8px (section), 6px (item)

### Interactions et animations

- **Aucune animation aggressive**
- **Pulse discret** sur "imminent" (1s, opacity 1 → 0.6 → 1)
- **Interface stable et calme** – adaptée au contexte public
- **Pas de hover** (pas d'interactivité utilisateur attendue)
- **Pas de modal, popup, ou menu**

---

## 7. Sources et API

### Temps réel transport

**Fournisseur :** Île-de-France Mobilités (IDFM)

**API :** PRIM ("Plateforme de Reg" de l'Île-de-France Mobilités)

**Endpoints :**
- `stop-monitoring` : Arrivées / départs temps réel
- `situation-exchange` : Trafic et perturbations
- `general-message` : Informations générales

**Paramètres :**
- `MonitoringRef` : Identifiant arrêt (ex: `STIF:StopArea:SP:43135:`)
- `LineRef` : Identifiant ligne (ex: `STIF:Line::C01742:`)

**Proxy :** `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=` (Cloudflare Workers)

### Météo

**Fournisseur :** Open-Meteo (API gratuite, pas d'authentification)

**Endpoint :** `https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.45&current_weather=true`

**Données :** Température, code météo (ensoleillé, nuageux, pluie, etc.)

### Vélib'

**Fournisseur :** Opendata Paris

**Endpoint :** `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records`

**Stations :**
- Vincennes : `stationcode=12163`
- École du Breuil : `stationcode=12128`

**Données :** Vélos mécaniques, vélos électriques disponibles

---

## 8. Principe d'absence de données

### Jamais de vide

**Si données indisponibles :**
- N'afficher PAS un blanc
- N'afficher PAS un "en attente..."
- **Afficher un statut explicite** : `— [N/A]` ou `SERVICE TERMINÉ`

**Si API en erreur :**
- Garder les données précédentes visibles
- Afficher un badge "Dern. maj XX min" en gris

**Si pas de passage sur une ligne :**
- **Afficher quand même la ligne** (ne pas la cacher)
- Afficher : `— [SERVICE INDISPONIBLE]` ou `— [N/A]`

---

## 9. Rafraîchissement et temps réel

- **Horloge** : mise à jour toutes les 1 secondes
- **Données transport** : actualisation toutes les 60 secondes
- **Météo** : actualisation toutes les 10 minutes
- **Vélib'** : actualisation toutes les 2 minutes
- **Timestamp** : "Maj HH:MM" visible en haut à droite

---

## 10. Cas d'usage en situation perturbée

### Exemple 1 : Pas de passage en fin de service

**Affichage :**
```
REPUS 77 → CHATELET
  — [SERVICE TERMINÉ]
```

**Pas de :** "Aucun résultat", "Chargement...", vide blanc.

### Exemple 2 : Retard connu

**Affichage :**
```
REPUS 101 → PONT DE LEVALLOIS
  +8 min → 14:47 [RETARD]
  15 min → 14:54 [OK]
```

### Exemple 3 : Service interrompu

**Affichage :**
```
REPUS 108 → LA COURNEUVE
  — [ANNULÉ]
```

### Exemple 4 : API en timeout

**Affichage :** Données précédentes visibles + timestamp gris

---

## 11. Checklist de conformité

- [ ] 1080x1920px portrait
- [ ] 4 zones distinctes (A, B, C, D)
- [ ] Hiérarchie ARRÊT → LIGNE → DIRECTION → PASSAGES
- [ ] Toutes les lignes affichées, même sans passage
- [ ] Aucune animation agressive
- [ ] Temps + heure affichés ensemble pour chaque passage
- [ ] Statut explicite, jamais un blanc
- [ ] Badge couleur IDFM pour chaque ligne
- [ ] Horloge en temps réel
- [ ] Actualisations : 60s (transport), 10m (météo), 2m (Vélib')
- [ ] Pas de localStorage, sessionStorage, cookies
- [ ] Pas de requêtes XHR bloquantes
- [ ] Accessible sans défilement principal sur tout écran 1920px
- [ ] Design lisible de loin (TV, mur, régie)
- [ ] Responsive à 4K si possible

---

## 12. Évolutions futures (roadmap)

1. **Ajout d'arrêts supplémentaires** (Château de Vincennes, gares secondaires)
2. **Carte minimaliste** (Sytadin) pour trafic routier
3. **Alertes sonores** (optionnel) sur retard/service interrompu
4. **Thème nuit** (optionnel, dark mode complet)
5. **Export screenshot** pour archives / logs
6. **Configuration dynamique** (ajout/suppression lignes sans code)
7. **Intégration calendrier** (événements à l'Hippodrome)
8. **Multi-écrans** (synchronisation entre plusieurs dashboards)

---

## 13. Notes techniques

### Stack
- **HTML5** (structure sémantique)
- **CSS3** (Grid, Flexbox, variables, media queries)
- **JavaScript Vanilla** (Fetch API, async/await)
- **Pas de dépendances externes** (une seule exception : proxy RATP)

### Browser compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance
- Chargement < 2s
- Rafraîchissement sans flicker
- Pas de memory leaks (setInterval géré)
- Bande passante : ~50KB par actualisation

---

**Version :** 1.0  
**Date :** Janvier 2026  
**Auteur :** Équipe SETF / VH Prod