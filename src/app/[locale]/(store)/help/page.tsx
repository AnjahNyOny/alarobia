import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Livraison, retours et aide", description: "Délais et frais de livraison, conditions de retour et réponses aux questions fréquentes." };

export default async function HelpPage() {
  const s = await getSettings();
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
                  <th scope="col" className="px-4 py-3 font-medium">Mode</th>
                  <th scope="col" className="px-4 py-3 font-medium">Délai</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Tarif</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">Standard</th>
                  <td className="px-4 py-3">3 à 5 jours ouvrés</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatPrice(s.shippingStandardCents, s.currency)}
                    {s.freeShippingThresholdCents > 0 && <span className="block text-muted-foreground">offerte dès {formatPrice(s.freeShippingThresholdCents, s.currency)}</span>}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">Express</th>
                  <td className="px-4 py-3">24 à 48 h</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPrice(s.shippingExpressCents, s.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 leading-relaxed text-muted-foreground">Les commandes passées avant 13 h partent le jour même. Un numéro de suivi vous est communiqué dès l'expédition ; vous le retrouvez aussi dans votre espace client.</p>
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
