# Guide utilisateur — Répartition Matériel Solidays

Cette application sert à **répartir le matériel** (talkies, câbles, etc.) entre les différents **points de distribution** du festival, puis à vérifier que chaque sac est complet le jour J.

---

## Vocabulaire

| Terme | Définition |
|-------|------------|
| **Catégorie** | Famille de matériel, avec une couleur (ex : Radio, Câblage). |
| **Matériel** (type) | Un modèle d'équipement (ex : Talkie-walkie), rattaché à une catégorie. |
| **Unité** | Un exemplaire physique d'un matériel (ex : Talkie #1). Chaque unité a un nom propre. |
| **Point** | Un lieu de distribution (ex : Scène principale). On lui assigne des unités. |
| **Réserve** | Les unités non encore assignées, disponibles. |
| **Indispensable** | Élément qui doit toujours figurer dans le sac (ex : câble d'alim), vérifié dans le Bag Checker. |

> Un **type** « Talkie-walkie » en quantité 5 = 5 **unités** distinctes que vous assignez individuellement.

---

## Les 4 onglets

L'application s'organise en quatre onglets, en haut de page :

- **Points** — vue d'ensemble des points de distribution et de leur état.
- **Réserve** — ce qu'il reste de disponible, par catégorie.
- **Bag Checker** — la check-list de préparation des sacs.
- **Administration** — création du matériel, des catégories et des indispensables.

---

## Mise en route (première utilisation)

### 1. Créer les catégories
**Administration → Réserve → Catégories**
1. Saisir un nom (ex : « Radio »).
2. Choisir une couleur.
3. Cliquer **Ajouter**.

### 2. Créer le matériel
**Administration → Réserve → Matériel**
1. Saisir le nom du matériel (ex : « Talkie-walkie »).
2. Choisir sa catégorie.
3. Indiquer la **quantité** = nombre d'unités à créer (ex : 5 → crée 5 talkies).
4. Cliquer **Ajouter**.

Les unités sont nommées automatiquement (« Talkie-walkie #1 », #2…). Vous pouvez les renommer :
- Cliquer sur le matériel pour déplier ses **unités**.
- Modifier le nom de chaque unité, ajouter ou supprimer des unités.
- La case **En inventaire** : décochez-la pour mettre temporairement une unité hors service (HS, en réparation). Elle sort alors de la réserve.

### 3. Créer les points de distribution
**Onglet Points → + Ajouter un point**
1. Donner un nom (ex : « Scène principale »).
2. Description optionnelle (ex : « côté jardin »).
3. **Créer**.

> Astuce : les cartes de points peuvent être réorganisées par glisser-déposer. Le bouton **≣ Liste / Grille** bascule l'affichage.

---

## Assigner du matériel à un point

1. Onglet **Points**, cliquer sur la carte d'un point.
2. Dans **Assigner une unité**, choisir une unité disponible dans la liste, puis **Assigner**.
   *(La liste ne propose que des unités encore en réserve.)*
3. L'unité apparaît dans **Matériel assigné**.

Pour chaque unité assignée, deux cases :
- **Config** — cochez-la quand l'unité est configurée/prête.
- *(Dans le sac)* — se coche depuis le **Bag Checker** (voir plus bas).

Pour **retirer** une unité d'un point, utilisez la croix en face de l'unité dans la liste assignée ; elle retourne en réserve.

### Modifier ou supprimer un point
Dans le détail d'un point, bouton **✎ Modifier** : renommer, changer la description, ou **Supprimer ce point** (les unités assignées repartent en réserve).

---

## Comprendre les couleurs d'un point

Chaque carte de point a une couleur qui résume son avancement :

| Couleur | Signification |
|---------|---------------|
| ⚪ **Gris** | Aucune configuration / rien d'assigné |
| 🟡 **Jaune** | Configuration partielle (certaines unités seulement) |
| 🔵 **Bleu** | Tout est configuré, mais pas encore mis dans le sac |
| 🟢 **Vert** | Tout configuré **et** dans le sac → prêt |
| 🔴 **Rouge** | Dans le sac, mais la config n'est pas complète ⚠️ |

Le **rouge** est un signal d'alerte : du matériel est parti dans le sac alors qu'il n'est pas entièrement configuré.

---

## La Réserve

L'onglet **Réserve** montre, par catégorie, combien d'unités restent disponibles par rapport au total :

> Réserve : **3** / 5

Le filtre en haut permet de n'afficher qu'une catégorie. Une unité repasse en réserve dès qu'elle est retirée d'un point ou mise hors inventaire.

---

## Le Bag Checker (préparation des sacs)

C'est l'outil de contrôle final, point par point.

### Définir les indispensables (une fois)
**Administration → Bag Checker → Indispensables**
- Ajoutez les éléments qui doivent figurer dans chaque sac (ex : « Câble d'alimentation »).
- Vous pouvez restreindre un indispensable à certaines catégories / matériels : il n'apparaîtra alors que pour les points concernés.

### Préparer un sac
**Onglet Bag Checker**
1. Sélectionner un point.
2. Deux listes s'affichent :
   - **Matériel assigné** — chaque unité, avec son badge **Config OK / Config NOK**.
   - **Indispensables** — la liste applicable à ce point.
3. Cochez le ✓ « Dans le sac » au fur et à mesure que vous remplissez le sac.

Cocher « Dans le sac » met à jour automatiquement la couleur du point dans l'onglet Points. Objectif : **tout vert**.

---

## Bouton ↺ Inventaire

**Administration → Réserve → Matériel → ↺ Inventaire** réinitialise l'état d'inventaire (utile pour repartir d'une base propre). À utiliser avec prudence.

---

## Questions fréquentes

**Mes données sont-elles sauvegardées ?**
Oui, automatiquement à chaque action, sur le serveur. Pas besoin d'enregistrer manuellement.

**Une unité peut-elle être sur deux points ?**
Non. Une unité est soit en réserve, soit assignée à **un seul** point.

**Pourquoi mon unité n'apparaît pas dans la liste d'assignation ?**
Elle est déjà assignée ailleurs, ou hors inventaire (case « En inventaire » décochée).

**Comment connecter une autre application à ces données ?**
Une API en lecture seule existe — voir [API.md](API.md).
