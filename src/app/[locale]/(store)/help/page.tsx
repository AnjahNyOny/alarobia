import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { zoneName } from "@/lib/shipping";

export const metadata: Metadata = { title: "Livraison, retours et aide", description: "Délais et frais de livraison, conditions de retour et réponses aux questions fréquentes." };

export default async function HelpPage() {
  const [s, zones, locale, t] = await Promise.all([getSettings(), db.shippingZone.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }), getLocale(), getTranslations("delivery")]);
  const faq = [
    ["Puis-je commander sans créer de compte ?", "Oui. Une adresse e-mail suffit pour recevoir la confirmation. Créer un compte permet en plus de suivre vos commandes et d'enregistrer votre adresse."],
    ["Comment utiliser un code promo ?", "Saisissez-le dans le panier, avant de passer la commande. La réduction s'affiche immédiatement dans le récapitulatif. Un seul code par commande."],
    ["Un article est épuisé, reviendra-t-il ?", "La plupart du temps, oui. Ajoutez-le à vos favoris pour le retrouver facilement lors de votre prochaine visite."],
    ["Quels moyens de paiement acceptez-vous ?", "La carte bancaire et le paiement à la livraison."],
    ["Comment vous contacter ?", `Écrivez-nous à ${s.contactEmail}. Nous répondons sous 24 h, du lundi au samedi.`],
  ];
  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-3xl">
        <h1 className="display text-5xl">Livraison, retours et aide</h1>

        <section id="livraison" className="mt-12 scroll-mt-24">
          <h2 className="display text-3xl">Livraison</h2>
          <div className="relative mt-5 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Zone</th>
                  <th scope="col" className="px-4 py-3 font-medium">Délai</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Tarif</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <th scope="row" className="px-4 py-3 font-medium">{zoneName(zone, locale)}</th>
                    <td className="px-4 py-3">{zone.minDays === zone.maxDays ? t("delaySingle", { days: zone.maxDays }) : t("delayRange", { min: zone.minDays, max: zone.maxDays })}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{zone.priceCents === 0 ? t("free") : formatPrice(zone.priceCents, s.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {s.freeShippingThresholdCents > 0 && <>La livraison est offerte dès {formatPrice(s.freeShippingThresholdCents, s.currency, locale)} d'achat, quelle que soit la zone. </>}
            Nous ne livrons pas le dimanche. Le livreur vous appelle avant de passer : indiquez un numéro où vous êtes joignable et, si possible, un repère près de chez vous.
          </p>
        </section>

        <section id="retours" className="mt-14 scroll-mt-24">
          <h2 className="display text-3xl">Retours et remboursements</h2>
          <ol className="mt-5 grid gap-4 leading-relaxed text-muted-foreground">
            <li><strong className="font-medium text-foreground">1. Prévenez-nous sous 30 jours.</strong> Écrivez à {s.contactEmail} en indiquant votre numéro de commande.</li>
            <li><strong className="font-medium text-foreground">2. Renvoyez l'article.</strong> Non utilisé, dans son emballage d'origine, avec l'étiquette de retour que nous vous envoyons.</li>
            <li><strong className="font-medium text-foreground">3. Vous êtes remboursé.</strong> Sous 5 jours ouvrés après réception, sur le moyen de paiement utilisé.</li>
          </ol>
        </section>

        <section id="questions" className="mt-14 scroll-mt-24">
          <h2 className="display text-3xl">Questions fréquentes</h2>
          <div className="mt-5 border-t">
            {faq.map(([q, a]) => (
              <details key={q} className="group border-b">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
