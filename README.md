# 🚌 Dashboard Mobilité - VH

**Affichage temps réel complet et sans compromis pour Joinville-le-Pont, Vincennes et l'École du Breuil.**

👉 **[Voir le dashboard en direct](https://plero75.github.io/VHPRATP/)**

---

## 📄 Ce qu'il y a dans ce repo

### Fichiers clés

```
VHPRATP/
├── index.html                    ← Dashboard complet (tout-en-un, 19KB)
├── CAHIER_DES_CHARGES.md         ← Spécifications complètes + checklist
├── README.md                     ← Ce fichier
└── .github/
    └── workflows/                ← Automations optionnelles
```

### index.html : le cœur du système

**Une seule page HTML contenant :**
- 📐 **Structure** : 4 zones distinctes (bandeau, cœur transport, vue exhaustive, contexte)
- 🎨 **Design** : CSS 100% vanilla, variables de couleurs IDFM, responsive
- ⚡ **Logique** : JavaScript Vanilla, Fetch API, async/await, sans dépendances externes

**Sources de données :**
- 🚆 **Transports** : PRIM (Île-de-France Mobilités) via proxy Cloudflare Workers
- 🌤️ **Météo** : Open-Meteo API (gratuite)
- 🚲 **Vélib'** : Opendata Paris

---

## 🎯 Structure logique

### Hiérarchie d'affichage (stricte)

```
ARRÊT
  ↓ LIGNE (couleur IDFM, badge)
    ↓ DIRECTION (destination explicite)
      ↓ PASSAGES (jusqu'à 3 prochains)
        • Temps restant (dominant)
        • Heure exacte (lisible)
        • Statut (jamais un blanc)
```

**Jamais l'inverse.**

### Les 4 zones de l'écran

| Zone | Contenu | Hauteur | Rôle |
|------|---------|--------|------|
| **A** | Logo + Horloge + Maj | 60px | Repère temporel global |
| **B** | Arrêts → Lignes → Directions → Passages | Flexible | **Prioritaire**, cœur du système |
| **C** | Tous les bus (grille 3 col) | 180px | Vue exhaustive, vérification |
| **D** | Météo + Vélib' | 120px | Contexte pratique |

---

## 📊 Arrêts et lignes desservis

### Arrêts

- **Joinville - RER** : RER A
- **Joinville - Bus** : 77, 101, 106, 108, 110, 112, 281, N33
- **École du Breuil** : 201

### Lignes

| Ligne | Type | Couleur | Monitoring |
|-------|------|--------|----------|
| RER A | RER | `#E41E26` | `STIF:StopArea:SP:43135:` |
| 77 | Bus | `#0071bc` | `STIF:StopPoint:Q:22452:` |
| 101 | Bus | `#f0a500` | `STIF:StopPoint:Q:21252:` |
| ... | ... | ... | ... |

**[Voir la liste complète dans CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md#3-arrêts-et-lignes-desservis)**

---

## 🟢 États et statuts

Chaque passage est toujours dans un **état explicite** :

| État | Affichage | Couleur | Exemple |
|------|-----------|--------|----------|
| **OK** | `7 min → 14:35 [OK]` | Vert | Temps réel, à l'heure |
| **Imminent** | `1 min → 14:28 [IMMINENT]` | Vert pulsant | < 2 min |
| **Retard** | `+8 min → 14:45 [RETARD]` | Orange | Status `delayed` |
| **Annulé** | `— → — [ANNULÉ]` | Rouge | Status `cancelled` |
| **N/A** | `— → — [N/A]` | Gris | Données manquantes |

**Principe fondamental :** Un état remplace l'information, il ne la supprime jamais.

---

## 🔄 Actualisation et temps réel

- ⏰ **Horloge** : mise à jour 1x par seconde
- 🚆 **Transports** : actualisation 1x par 60s
- 🌤️ **Météo** : actualisation 1x par 10min
- 🚲 **Vélib'** : actualisation 1x par 2min
- 📍 **Timestamp** : "Maj HH:MM" visible en haut à droite

---

## 🔧 Technologie

### Stack

- **HTML5** : structure sémantique
- **CSS3** : Grid, Flexbox, variables CSS, media queries
- **JavaScript Vanilla** : Fetch API, async/await, pas de framework
- **APIs publiques** : PRIM, Open-Meteo, Opendata Paris

### Pas de dépendances externes

Tout fonctionne avec le navigateur standard. Aucun npm install, aucune dépendance.

### Proxy RATP

Utilise un proxy Cloudflare Workers pour contourner les restrictions CORS :
```
https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=<URL_IDFM>
```

---

## 🎨 Design et accessibilité

### Palette de couleurs

- **Fond** : `#0a1628` (bleu très foncé)
- **Accent** : `#f5a623` (jaune/or RATP)
- **Texte** : `#f1f5f9` (blanc/gris très clair)
- **Statuts** : vert, orange, rouge, gris (standards)

### Typographie

- **Police** : System fonts (-apple-system, BlinkMacSystemFont, Segoe UI, etc.)
- **Horloge** : Courier New (monospace, 32px, gras)
- **Titres** : 16-20px, gras, en majuscules
- **Corps** : 12-14px, normal

### Responsive

- **1080x1920px** : format portrait (standard)
- **Adapté pour TV** : lisible de loin, sans scroll
- **4K** : améliorations futures

### Aucune animation agressive

- Pulse discret sur "imminent"
- Interface stable et calme
- Adapté au contexte public (écran mur, régie, événement)

---

## 📱 Utilisation

### Déploiement

**La version en direct est sur GitHub Pages :**
```
https://plero75.github.io/VHPRATP/
```

### Développement local

```bash
# Cloner le repo
git clone https://github.com/plero75/VHPRATP.git
cd VHPRATP

# Ouvrir index.html dans un navigateur
open index.html  # macOS
# ou
start index.html  # Windows
```

### Affichage sur écran (régie, TV, mur)

1. Accéder à `https://plero75.github.io/VHPRATP/`
2. F11 pour full-screen (ou Cmd+Ctrl+F sur macOS)
3. Laisser tourner

---

## 📋 Cahier des charges complet

**Tous les détails de spécification, de design, d'API et d'états sont dans :**

👉 **[CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md)**

Cela inclut :
- Objectifs et contraintes non négociables
- Architecture logique complète
- Spécifications visuelles précises
- Tous les états et transitions
- Checklist de conformité
- Roadmap d'évolutions futures

---

## 🐛 Dépannage

### "Aucun passage" ou "Service indisponible"

**Normal si :**
- Hors heures de service
- Service réellement interrompu (vérifier RATP app)
- API PRIM non disponible (bug serveur IDFM)

**Vérifier :**
- F12 → Console (erreurs Fetch?)
- Ouvrir la Network → vérifier les réponses API
- Timestamp "Maj" en haut à droite (< 2 min = frais)

### Horloge ne se met pas à jour

Vérifier les permissions JavaScript du navigateur (F12 → Console).

### Données anciennes (timestamp > 5 min)

L'API PRIM est peut-être indisponible. Actualiser la page (F5).

---

## 📞 Contact / Contribution

- **Auteur** : Équipe SETF / VH Prod
- **Issues** : GitHub Issues
- **Amélioration** : Pull Requests bienvenues

---

## 📄 Licence

Non spécifiée (Copyright © 2026 SETF). Utilisation interne.

---

## 🎯 Checklist de lancement

- ✅ Dashboard visible
- ✅ Horloge en temps réel
- ✅ Transports s'affichent
- ✅ Statuts explicites
- ✅ Pas de scroll principal
- ✅ Météo + Vélib' chargent
- ✅ Full-screen OK
- ✅ Responsive OK
- ✅ Performance OK (< 50KB/min)

---

**Dernier mise à jour :** Janvier 2026  
**Version :** 1.0  
**Statut :** Opérationnel ✅