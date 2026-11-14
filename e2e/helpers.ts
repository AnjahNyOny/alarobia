import { expect, type Page } from "@playwright/test";

/** Échoue le test si la page émet une erreur JavaScript, une erreur console ou une réponse 5xx. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()} : ${String(e).slice(0, 300)}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()} : ${m.text().slice(0, 300)}`));
  page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return () => expect(errors, "aucune erreur navigateur ou serveur").toEqual([]);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export const ADMIN = { email: "admin@seve.example", password: "admin1234" };
