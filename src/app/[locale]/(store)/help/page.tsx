import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { pageAlternates, siteBase } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { zoneName } from "@/lib/shipping";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("help")]);
  return { title: t("title"), description: t("metaDescription"), alternates: pageAlternates(siteBase(), locale, "/help") };
}

export default async function HelpPage() {
  const [s, zones, locale, td, t] = await Promise.all([
    getSettings(),
    db.shippingZone.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    getLocale(),
    getTranslations("delivery"),
    getTranslations("help"),
  ]);
  const email = s.contactEmail;
  const returns = [
    [t("r1"), t("r1text", { email })],
    [t("r2"), t("r2text")],
    [t("r3"), t("r3text")],
  ];
  const faq = [
    [t("q1"), t("a1")],
    [t("q2"), t("a2")],
    [t("q3"), t("a3")],
    [t("q4"), t("a4")],
    [t("q5"), t("a5", { email })],
  ];
  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-3xl">
        <h1 className="display text-5xl md:text-6xl">{t("title")}</h1>

        <section id="livraison" aria-labelledby="livraison-titre" className="mt-12 scroll-mt-24">
          <h2 id="livraison-titre" className="display text-3xl">
            {t("delivery")}
          </h2>
          <div className="relative mt-5 overflow-x-auto border-y-2 border-foreground">
            <table className="w-full min-w-[420px] text-left">
              <thead className="text-sm text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2.5 pr-4 font-normal">
                    {t("zone")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-normal">
                    {t("delay")}
                  </th>
                  <th scope="col" className="py-2.5 pl-4 text-right font-normal">
                    {t("cost")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <th scope="row" className="display-sm py-3 pr-4 text-xl">
                      {zoneName(zone, locale)}
                    </th>
                    <td className="px-4 py-3">{zone.minDays === zone.maxDays ? td("delaySingle", { days: zone.maxDays }) : td("delayRange", { min: zone.minDays, max: zone.maxDays })}</td>
                    <td className="py-3 pl-4 text-right font-medium whitespace-nowrap tabular-nums">{zone.priceCents === 0 ? td("free") : formatPrice(zone.priceCents, s.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {s.freeShippingThresholdCents > 0 && <>{t("freeFrom", { amount: formatPrice(s.freeShippingThresholdCents, s.currency, locale) })} </>}
            {t("deliveryNote")}
          </p>
        </section>

        <section id="retours" aria-labelledby="retours-titre" className="mt-14 scroll-mt-24">
          <h2 id="retours-titre" className="display text-3xl">
            {t("returns")}
          </h2>
          {/* Numérotation justifiée : les trois étapes se suivent. */}
          <ol className="mt-5 grid gap-5">
            {returns.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="display w-6 shrink-0 text-4xl text-brand tabular-nums" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="display-sm text-xl">{title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="questions" aria-labelledby="questions-titre" className="mt-14 scroll-mt-24">
          <h2 id="questions-titre" className="display text-3xl">
            {t("faq")}
          </h2>
          <dl className="mt-5 border-t">
            {faq.map(([q, a]) => (
              <div key={q} className="border-b py-5">
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
