# RCap — Veille RSS collaborative

> Preuve de concept — outil open source de veille multi-sources, multi-utilisateurs, déployable librement.  
> Licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

---

## Pourquoi RCap

**RCap**, c'est trois idées superposées : *récap* de l'actualité, *cap vers les RSS* et l'app de RC 😉

La veille informationnelle est un problème quotidien dans beaucoup d'organisations : trop de sources, trop d'articles, pas assez de temps. Les outils SaaS existants sont souvent trop complexes à configurer pour des non-techniciens, trop chers pour de petites équipes, ou trop opaques sur ce qu'ils font des données.

RCap part d'un constat simple : **un agrégateur RSS avec des comptes, des équipes et un filtre par mots-clés devrait suffire à couvrir 75/80 % des besoins de veille**.

L'objectif est de permettre à n'importe quelle organisation de :
- **Organiser ses sources** en espaces thématiques
- **Filtrer les articles** par mots-clés, par source, par période
- **Partager des veilles** entre collègues dans une équipe
- **Garder la mémoire** de ce qui a été lu
- **Exporter** vers ses propres outils (CSV, JSON, Markdown, OPML, BibTeX…)

RCap est une **preuve de concept**. Il est conçu pour être compris, forké, adapté — pas pour être utilisé tel quel comme un produit fini. Le code est volontairement simple. Tout tient dans **deux fichiers et une base de données**.

---

## Méthode de développement

RCap a été construit en binôme **humain + IA** (Claude, Anthropic), sur une série de sessions de travail.

### Comment ça s'est passé

Tout commence par une **instruction structurée et finement détaillée** : contexte du projet, contraintes techniques, conventions de code, règles à ne jamais enfreindre. Ce socle posé, la démarche devient itérative : une fonctionnalité à la fois, formulée en langage naturel, testée en production réelle avant de passer à la suivante.

Chaque échange suit un schéma instruction / questions / réponses / vérification : l'humain exprime un besoin, l'IA questionne, propose une implémentation, explique ses choix, identifie les effets de bord. L'humain répond, questionne, teste, valide ou recadre.

### Ce que ça change

- **Vitesse** : une fonctionnalité complète (front + back + SQL) en 20–30 minutes
- **Itération** : les corrections sont immédiates, sans friction de déploiement
- **Documentation** : les décisions sont tracées dans la conversation — ce README en est directement issu

### Un lieu d'apprentissage

Le co-développement humain + IA ne devait pas déboucher sur des parties de "boîte noire" inexplicables.
À chaque étape, les choix techniques sont explicités : pourquoi cette structure de données, pourquoi ce compromis. La compréhension est centrale — aucun bloc de code n'est intégré sans être lu et compris. C'est aussi un mode d'apprentissage concret : on part d'un besoin, on obtient une solution fonctionnelle, et on comprend chaque brique avant d'en poser une autre.

### Limites et vigilances

- Le code produit doit être **relu et compris** avant déploiement — l'IA peut introduire des régressions subtiles
- La **sécurité** (RLS, politiques Supabase) nécessite une attention particulière : l'IA propose, l'humain valide
- Ce mode favorise l'accumulation rapide de fonctionnalités — il faut résister à en ajouter trop

---

## Ce que fait RCap

### Tableau de bord

```
Tableau de bord
├── Mes espaces (veilles personnelles)
│   ├── X articles non lus
│   ├── Compteur d'articles (7 derniers jours)
│   └── Nombre de flux RSS
└── Espaces d'équipe
    └── (même structure, partagée avec les membres)
```

### Dans un espace

- Liste d'articles avec source, rubrique, date
- Filtres : source / période / non lus / mots-clés / tri
- Prévisualisation latérale au clic (description + lien)
- Export : CSV, JSON, Markdown, OPML, BibTeX, Favoris HTML, XML/RSS

### Recherche globale

- Un champ de recherche qui interroge tous les espaces simultanément
- Résultats groupés par espace, mot cherché surligné

### Équipes

- Créer une équipe, inviter des membres
- Un espace peut être personnel ou partagé avec une équipe
- Chaque membre voit les mêmes articles, avec ses propres articles lus
- Notification à l'ajout dans une équipe

### Administration (réservé aux admins)

- Vue d'ensemble : utilisateurs, espaces, équipes, articles
- Gestion des utilisateurs (droits admin, suppression)
- Maintenance : nettoyage des anciens articles par période, avec estimation du nombre d'articles concernés avant confirmation


Compte de démonstration, utilisateur ou administrateur, sur demande.

---

## Architecture

RCap repose sur **trois composants**, tous gratuits dans leurs limites de base.

### Vue d'ensemble

```
Navigateur
  └── index.html  (application complète, fichier unique)
        └── communique avec Supabase via HTTPS

Supabase
  ├── Authentification (email / mot de passe, magic link)
  └── Base de données PostgreSQL (7 tables)

GitHub Actions  →  scripts/fetch.js  →  Supabase
  (cron 3×/jour)    (collecteur RSS)     (insertion articles)

GitHub Pages
  └── héberge index.html (aucun serveur, aucun coût)
```

### Modèle de données

```
profiles          ← utilisateurs (nom affiché, droits admin)
teams             ← équipes
team_members      ← liaison utilisateur ↔ équipe
watchlists        ← espaces de veille (personnel ou équipe, fréquence)
feeds             ← flux RSS par espace (url, nom, mots-clés)
articles          ← articles collectés (titre, url, résumé, date,
                     rubrique, lu par[])
team_invitations  ← invitations en attente
```

### Collecte des articles

```
Au démarrage de fetch.js :
1. Lire tous les espaces et leur fréquence de scan
2. Ne traiter que les flux dont c'est le créneau
   - haute   → 8h, 14h, 20h
   - normale → 8h seulement
   - basse   → lundi 8h seulement
3. Pour chaque flux :
   a. Télécharger le flux RSS ou Atom
   b. Extraire les articles (sans dépendance externe)
   c. Filtrer par mots-clés si définis
   d. Insérer les nouveaux articles (contrainte anti-doublon)
```

---

## Démo

Une instance de démonstration est disponible à : **https://bertrandformet.github.io/rcap/**

Comptes de test (lecture et exploration libres) :

| Email | Mot de passe |
|-------|-------------|
| `demo1@rcap.dev` | `rcap-demo` |
| `demo2@rcap.dev` | `rcap-demo` |

---

## Déployer RCap

### Prérequis

- Un compte [GitHub](https://github.com) (gratuit)
- Un compte [Supabase](https://supabase.com) (gratuit, limite généreuse)

### 1. Créer le projet Supabase

Créer un nouveau projet, puis exécuter ce SQL dans l'éditeur SQL :

```sql
-- Profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text,
  is_admin boolean default false,
  avatar_index integer default 0,
  created_at timestamptz default now()
);

-- Teams
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Team members
create table public.team_members (
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  primary key (team_id, user_id)
);

-- Watchlists
create table public.watchlists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete cascade,
  scope text default 'personal',
  team_id uuid references public.teams(id) on delete set null,
  frequency text default 'normale',
  created_at timestamptz default now()
);

-- Feeds
create table public.feeds (
  id uuid default gen_random_uuid() primary key,
  watchlist_id uuid references public.watchlists(id) on delete cascade,
  url text not null,
  label text,
  keywords text[]
);

-- Articles
create table public.articles (
  id uuid default gen_random_uuid() primary key,
  watchlist_id uuid references public.watchlists(id) on delete cascade,
  feed_id uuid references public.feeds(id) on delete set null,
  title text,
  url text,
  description text,
  published_at timestamptz,
  rubrique text,
  read_by uuid[] default '{}',
  constraint articles_url_unique unique (url)
);

create index articles_published_at_idx on public.articles (published_at desc);
create index articles_read_by_idx on public.articles using gin(read_by);

-- Team invitations
create table public.team_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);
```

Activer l'authentification email dans **Authentication → Providers → Email**.

Activer Row Level Security sur chaque table (voir `docs/rls.sql`).

### 2. Configurer le repo

Forker le repo, puis dans `index.html` remplacer les deux constantes en haut du script :

```javascript
const SUPABASE_URL  = 'https://VOTRE-PROJET.supabase.co';
const SUPABASE_ANON = 'VOTRE_CLE_ANON';
```

Dans les **Secrets GitHub** du repo (`Settings → Secrets → Actions`) :

| Secret | Valeur |
|--------|--------|
| `SUPABASE_URL` | `https://VOTRE-PROJET.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` (Supabase → Settings → API) |

### 3. Activer GitHub Pages

`Settings → Pages → Source : Deploy from branch → main → / (root)`

L'application est disponible à `https://VOTRE-USERNAME.github.io/rcap/`

### 4. Premier compte admin

Créer un compte via l'interface, puis l'élever en admin :

```sql
update public.profiles set is_admin = true where email = 'votre@email.com';
```

---

## Structure du repo

```
rcap/
├── index.html                    # Application complète
├── scripts/
│   └── fetch.js                  # Collecteur RSS (Node.js, sans dépendance)
├── .github/
│   └── workflows/
│       └── fetch-articles.yml    # Planification GitHub Actions
├── docs/
│   └── rls.sql                   # Politiques de sécurité Supabase
└── README.md
```

---

## Licence

**Creative Commons Attribution 4.0 — CC BY 4.0**

Vous pouvez librement utiliser, modifier et redistribuer RCap, y compris à des fins commerciales, à condition de mentionner l'origine du projet.

→ [Texte complet de la licence](https://creativecommons.org/licenses/by/4.0/)

*Auteur : Bertrand Formet*
