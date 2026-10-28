# Kart Rivals — site vitrine

Site français de présentation de l’application mobile, publié sur https://kartrivals.fr/ avec l’hébergement IONOS existant. HTML, CSS et JavaScript sans compilation ni base de données. Les écrans proviennent des captures fournies par le propriétaire.

## Contenu

- Identité Motorsport / Gaming : Oswald, Inter, fond #161920 et accent #DEFF00.
- Présentation, fonctionnement, quatre écrans interactifs, sept rangs, Time Attack, écuries, garage, annuaire et carte des circuits, partenariat et FAQ.
- Menu mobile, navigation au clavier, dialogues natifs et respect du mouvement réduit.
- Images WebP, polices locales sous licence OFL, métadonnées sociales, robots et sitemap.
- Carte géographique interactive et recherche parmi 354 circuits importés depuis le dépôt de l’application.

## À compléter

1. Dans `public/assets/config.js`, renseigner `appStoreUrl` (https://apps.apple.com/…) et `googlePlayUrl` (https://play.google.com/…). Tant que ces liens sont vides, les boutons affichent une information de disponibilité et le contact, sans redirection fictive.
2. Compléter les mentions légales de l’éditeur et du responsable de publication dans `public/index.html`, ainsi que la politique de confidentialité propre à l’application. La notice actuellement intégrée concerne le site vitrine uniquement.
3. Vérifier l’adresse de contact `contact@kartrivals.fr` dans IONOS. Le site utilise des liens mailto ; il n’envoie aucun message lui-même.

## Publication

Les changements du dossier `public/` envoyés sur `main` déclenchent le workflow **Publication IONOS**. Il se connecte au serveur par SFTP (port 22), vérifie son empreinte, puis publie vers le dossier défini par `IONOS_REMOTE_DIR` (`/public` pour le domaine actuel).

Secrets GitHub : `IONOS_SFTP_HOST`, `IONOS_SFTP_USER`, `IONOS_SFTP_PASSWORD`. Ne jamais les ajouter au code ou au README.

L’empreinte ED25519 par défaut a été comparée le 28/10/2026 à la documentation officielle IONOS. La variable facultative `IONOS_HOST_FINGERPRINT` permet une mise à jour après vérification auprès de l’hébergeur.

Le mode manuel `verifier` teste uniquement l’authentification et l’ouverture SFTP, sans écriture. Le mode `publier` transfère le site. Les fichiers remplacés sont d’abord copiés dans `/.kart-rivals-backups/<run-id>-<attempt>/`, hors du dossier du domaine. Aucun fichier distant n’est supprimé. Les anciennes sauvegardes peuvent être téléchargées et restaurées en SFTP. La publication se fait fichier par fichier ; ce n’est pas une transaction atomique de l’ensemble du site.

## Développement

Servir `public/` avec un serveur HTTP statique. Aucun paquet npm n’est nécessaire. La configuration `.openai/hosting.json` sert uniquement à l’aperçu de développement, pas à l’hébergement du site.

## Annuaire et carte des circuits

La section `#circuits` affiche 354 circuits provenant des données publiques du dépôt
`maelvanden/KART-RIVALS` (commit source dans `public/data/circuits.json`). Recherche
sans accents par nom, ville, code postal ou département ; filtres région/département
et indoor/outdoor ; carte Leaflet avec regroupement des points et fiches pratiques.
Les 14 positions approximatives connues sont signalées. Les liens d'itinéraire
utilisent l'adresse du lieu, pas une position GPS approximative.

Ce fichier est un **instantané des migrations**, pas une lecture en direct de Supabase.
Les ajouts, corrections ou masquages effectués uniquement dans la base de production
ne sont pas automatiquement repris. Aucune donnée de pilote, aucun secret ni aucune
clé Supabase ne sont utilisés ou publiés. Les identifiants web sont déterministes et
ne sont pas les UUID de la base de l'application.

Pour mettre à jour depuis un checkout de l'application :

```sh
python scripts/import-circuits.py /chemin/vers/KART-RIVALS
node tests/circuits.test.cjs
```

L'import rejoue uniquement les INSERT et UPDATE statiques des circuits en mémoire,
conserve les corrections de coordonnées et exporte une liste de champs publics.
Le test de nombre de circuits est à ajuster après vérification des nouveaux imports.
Inspecter le diff avant publication. Les fichiers de l'application ne sont pas modifiés.

Leaflet 1.9.4 et Leaflet.markercluster 1.5.3 sont hébergés localement dans
`public/assets/vendor`, avec leurs licences. Les contours géographiques des
96 départements métropolitains sont hébergés dans `public/data/departments.geojson`.
Source : IGN Admin Express 2018, simplification France GeoJSON, Licence ouverte
(voir `public/data/GEOGRAPHY-LICENSE.txt`). Ce fond administratif est une vraie
carte géographique avec zoom et coordonnées, sans détails routiers. Les itinéraires
ouvrent Google Maps. Aucun service de tuiles externe ni géolocalisation du visiteur.
Le chargement des données est différé à l'approche de l'annuaire. La recherche reste
utilisable si le fond géographique échoue ; l'interface signale cet état.
