import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { weekdayName } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

// Une semaine quelconque commençant un lundi : seuls les noms des jours servent.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 16 + i));

export default async function AboutPage() {
  const [{ storeName }, locale, t] = await Promise.all([getSettings(), getLocale(), getTranslations("about")]);
  const points = [
    [t("p1"), t("p1text")],
    [t("p2"), t("p2text")],
    [t("p3"), t("p3text")],
  ];
  return (
    <div className="container-page pt-10 md:pt-16">
      <h1 className="display max-w-[16ch] text-[3.25rem] sm:text-7xl">{t("title")}</h1>

      {/* La semaine en malgache : le mercredi, qui donne son nom à la boutique, porte l'étiquette de la marque. */}
      <ol aria-label={t("week")} lang="mg" className="mt-10 grid border-y sm:grid-cols-7">
        {WEEK.map((day) => {
          const brandDay = day.getDay() === 3;
          return (
            <li key={day.getDay()} className={cn("flex items-center justify-between gap-2 border-b px-3 py-2.5 last:border-b-0 sm:block sm:border-b-0 sm:border-l sm:py-4 sm:first:border-l-0", brandDay ? "bg-primary text-primary-foreground" : day.getDay() === 0 && "text-muted-foreground")}>
              <span className="display-sm text-xl lg:text-2xl">{weekdayName(day, "mg")}</span>
              {locale !== "mg" && (
                <span lang={locale} className={cn("text-sm capitalize sm:mt-1 sm:block", brandDay ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {weekdayName(day, locale)}
                </span>
              )}
              {brandDay && <LogoMark className="hidden h-5 sm:mt-3 sm:block" />}
            </li>
          );
        })}
      </ol>

      <p className="mt-10 max-w-[60ch] text-xl leading-relaxed">{t("lead", { name: storeName })}</p>

      <ul className="mt-12 grid gap-8 border-t pt-10 md:grid-cols-3 md:gap-10">
        {points.map(([title, text]) => (
          <li key={title}>
            <h2 className="display text-3xl">{title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <Link href="/products" className={`${buttonVariants({ size: "xl" })} mt-12`}>
        {t("cta")}
      </Link>
    </div>
  );
}
