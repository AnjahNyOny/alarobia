import { test } from "@playwright/test";
import { accountCashOnDelivery, guestMobileMoney, LOCALES } from "./parcours";

// Parcours complets sur téléphone (Pixel 7 ramené à 390 px de large), dans chaque langue (étapes et contrôles dans
// `parcours.ts`) : recherche, rayons et catalogue par le menu, puis le vendeur sur son propre téléphone.
// A : client sans compte qui paie par Mobile Money, puis le vendeur. B : client avec compte, paiement à la livraison.

test.use({ viewport: { width: 390, height: 844 } });

for (const locale of LOCALES) {
  test(`A, ${locale}, téléphone : client sans compte, Mobile Money, puis le vendeur`, async ({ browser, page }) => {
    test.setTimeout(150_000);
    await guestMobileMoney({ browser, page, locale, device: "mobile" });
  });

  test(`B, ${locale}, téléphone : client avec compte, favori, paiement à la livraison, expédition`, async ({ browser, page }) => {
    test.setTimeout(120_000);
    await accountCashOnDelivery({ browser, page, locale, device: "mobile" });
  });
}
