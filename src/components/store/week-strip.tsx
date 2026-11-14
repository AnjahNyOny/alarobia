import { useLocale, useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo";
import { formatDate, weekdayName } from "@/lib/format";
import { sameDay, weekFrom } from "@/lib/shipping";
import { cn } from "@/lib/utils";

/**
 * Frise des sept prochains jours, nommés en malgache : elle montre quel jour arrive une commande
 * passée maintenant. Le mercredi (Alarobia) porte l'étiquette de la marque.
 */
export function WeekStrip({ today, delivery }: { today: Date; delivery: Date }) {
  const t = useTranslations("home.week");
  const locale = useLocale();
  const days = weekFrom(today);
  return (
    <section aria-labelledby="frise-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="frise-titre" className="display text-3xl md:text-4xl">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground">
          <strong className="font-semibold text-foreground">{t("text", { date: formatDate(delivery, locale, "weekday") })}</strong> {t("note")}
        </p>
      </div>
      {/* Sur petit écran, la frise défile dans son cadre : les noms des jours restent entiers. */}
      <div className="mt-5 overflow-x-auto pb-1">
        <ol className="grid min-w-[660px] grid-cols-7 border-y">
          {days.map((day) => {
            const isToday = sameDay(day, today);
            const isDelivery = sameDay(day, delivery);
            const isSunday = day.getDay() === 0;
            const isBrandDay = day.getDay() === 3;
            return (
              <li
                key={day.toISOString()}
                className={cn("relative flex flex-col justify-between border-l px-3 py-3 first:border-l-0", isDelivery && "bg-primary text-primary-foreground", isToday && !isDelivery && "bg-highlight text-highlight-foreground", isSunday && !isDelivery && !isToday && "text-muted-foreground")}
              >
                <div>
                  <p lang="mg" className="display-sm flex items-center gap-1.5 text-lg">
                    {weekdayName(day, "mg")}
                    {isBrandDay && <LogoMark className="h-4" />}
                  </p>
                  {locale !== "mg" && <p className={cn("text-xs capitalize", isDelivery ? "text-primary-foreground/75" : "opacity-75")}>{weekdayName(day, locale)}</p>}
                </div>
                {/* Le libellé passe sous le chiffre : en malgache il est trop long pour tenir à côté. */}
                <div className="mt-3">
                  <span className="display block text-3xl tabular-nums">{day.getDate()}</span>
                  <span className="mt-1 block min-h-8 text-xs leading-tight font-semibold">{isDelivery ? t("delivered") : isToday ? t("today") : isSunday ? t("noDelivery") : ""}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
