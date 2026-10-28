# Kart Rivals — site vitrine

Site français de présentation de l’application mobile, publié sur https://kartrivals.fr/ avec l’hébergement IONOS existant. HTML, CSS et JavaScript sans compilation ni base de données. Les écrans proviennent des captures fournies par le propriétaire.

## Contenu

- Identité Motorsport / Gaming : Oswald, Inter, fond #161920 et accent #DEFF00.
- Présentation, fonctionnement, quatre écrans interactifs, sept rangs, Time Attack, écuries, garage, aperçu des régions, partenariat et FAQ.
- Menu mobile, navigation au clavier, dialogues natifs et respect du mouvement réduit.
- Images WebP, polices locales sous licence OFL, métadonnées sociales, robots et sitemap.
- La carte des régions est un aperçu schématique, pas un annuaire géographique ni une source de données de l’application.

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
