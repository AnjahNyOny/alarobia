/**
 * Base des tests navigateur, schéma `public`. Le serveur de test la reçoit par playwright.config.ts ; un test qui doit
 * y lire ou y écrire directement (une date fixée, par exemple) s'y connecte avec la même adresse.
 */
export const E2E_DATABASE_URL = "postgresql://mac@localhost:5432/alarobia_test";

/**
 * Dossier où le serveur de test écrit les e-mails, un fichier JSON par message (`MAIL_OUTBOX`, src/lib/mail/transport.ts),
 * relatif à la racine du dépôt. Vidé au démarrage du serveur (playwright.config.ts), relu par `readOutbox()` (helpers.ts).
 */
export const E2E_MAIL_OUTBOX = ".mail-outbox-e2e";
