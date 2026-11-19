/**
 * Base des tests navigateur, schéma `public`. Le serveur de test la reçoit par playwright.config.ts ; un test qui doit
 * y lire ou y écrire directement (une date fixée, par exemple) s'y connecte avec la même adresse.
 */
export const E2E_DATABASE_URL = "postgresql://mac@localhost:5432/alarobia_test";
