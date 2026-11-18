import { test } from "@playwright/test";
import { accountCashOnDelivery, guestMobileMoney, LOCALES } from "./parcours";

// Parcours complets sur ordinateur, dans chaque langue (étapes et contrôles dans `parcours.ts`).
// A : client sans compte qui paie par Mobile Money, puis le vendeur. B : client avec compte, paiement à la livraison.

for (const locale of LOCALES) {
  test(`A, ${locale} : client sans compte, Mobile Money, puis le vendeur`, async ({ browser, page }) => {
    test.setTimeout(150_000);
    await guestMobileMoney({ browser, page, locale, device: "ordinateur" });
  });

  test(`B, ${locale} : client avec compte, favori, paiement à la livraison, expédition`, async ({ browser, page }) => {
    test.setTimeout(120_000);
    await accountCashOnDelivery({ browser, page, locale, device: "ordinateur" });
  });
}
