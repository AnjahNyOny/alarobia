import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { HomeDemo } from "@/components/customizer/home-demo";
import { ProductCard } from "@/components/store/product-card";
import { WeekStrip } from "@/components/store/week-strip";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { cardInclude, wishedIds } from "@/lib/catalog";
import { customizerOptions } from "@/lib/customization";
import { DEMO_COLOR } from "@/lib/customizer/demo";
import { db } from "@/lib/db";
import { CATEGORY_FIELDS, localize, PRODUCT_FIELDS } from "@/lib/localize";
import { getSettings } from "@/lib/settings";
import { estimateDelivery, madagascarTime, zoneName } from "@/lib/shipping";

export default async function HomePage() {
  const [settings, user, locale, t] = await Promise.all([getSettings(), getUser(), getLocale(), getTranslations("home")]);
  const [categories, featured, latest, wished] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, include: { translations: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } } }),
    db.product.findMany({ where: { status: "ACTIVE", featured: true }, include: cardInclude, orderBy: { updatedAt: "desc" }, take: 8 }),
    db.product.findMany({ where: { status: "ACTIVE" }, include: cardInclude, orderBy: { createdAt: "desc" }, take: 4 }),
    wishedIds(user?.id),
  ]);
  // La frise prend pour exemple la première zone de livraison active ; sans zone, elle ne promet rien et disparaît.
  const zone = await db.shippingZone.findFirst({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });
  const today = madagascarTime();
  // La démonstration du héros a besoin d'une tasse personnalisable, en stock, qui accepte un texte et la couleur de sa photo. Sinon, les quatre photos.
  const mug = await db.product.findFirst({ where: { status: "ACTIVE", customTemplate: "mug", stock: { gt: 0 } }, include: { translations: true }, orderBy: { featured: "desc" } });
  const mugOptions = mug && customizerOptions(mug);
  const demo = mug && mugOptions && mugOptions.textMax > 0 && mugOptions.colors.includes(DEMO_COLOR) ? { options: mugOptions, slug: mug.slug, name: localize(mug, locale, PRODUCT_FIELDS).name } : null;
  const mosaic = featured.filter((p) => p.images[0]).slice(0, 4);
  const steps = [
    [t("steps.s1"), t("steps.s1text")],
    [t("steps.s2"), t("steps.s2text")],
    [t("steps.s3"), t("steps.s3text")],
  ];

  return (
    <>
      <section className="container-page grid items-center gap-8 pt-8 md:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div>
          <h1 className="display max-w-[14ch] text-[3.25rem] sm:text-7xl lg:text-[5.5rem]">{t("title")}</h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>
          <Link href="/products" className={`${buttonVariants({ size: "xl" })} mt-8`}>
            {t("cta")}
          </Link>
        </div>
        {/* L'audace de la page : on écrit son prénom, la tasse le porte. Sans tasse personnalisable au catalogue, quatre objets cliquables. */}
        {demo ? (
          <HomeDemo {...demo} />
        ) : (
        <ul className="grid grid-cols-2 gap-2 sm:gap-3">
          {mosaic.map((p, i) => {
            const product = localize(p, locale, PRODUCT_FIELDS);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-sm bg-stone">
                  <Image src={p.images[0].url} alt={product.name} fill priority={i < 2} sizes="(min-width: 1024px) 22vw, 50vw" className="object-cover" />
                </Link>
              </li>
            );
          })}
        </ul>
        )}
      </section>

      {zone && (
        <div className="container-page mt-14 md:mt-20">
          <WeekStrip today={today} delivery={estimateDelivery(today, zone)} zone={zoneName(zone, locale)} />
        </div>
      )}

      <section className="container-page mt-16 md:mt-24" aria-labelledby="rayons-titre">
        <h2 id="rayons-titre" className="display text-3xl md:text-4xl">
          {t("aisles.title")}
        </h2>
        <ul className="mt-5 grid border-t sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
          {categories.map((raw) => {
            const c = localize(raw, locale, CATEGORY_FIELDS);
            return (
              <li key={c.id} className="border-b">
                <Link href={`/products?category=${c.slug}`} className="group flex items-baseline justify-between gap-4 py-4">
                  <span className="display text-3xl underline-offset-[6px] group-hover:underline md:text-4xl">{c.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{t("aisles.count", { count: c._count.products })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-page mt-16 md:mt-24" aria-labelledby="nouveautes-titre">
        <div className="flex items-baseline justify-between gap-6">
          <h2 id="nouveautes-titre" className="display text-3xl md:text-4xl">
            {t("latest.title")}
          </h2>
          <Link href="/products?sort=newest" className="shrink-0 text-sm font-medium underline underline-offset-4">
            {t("latest.all")}
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-4">
          {latest.map((p) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} />
          ))}
        </div>
      </section>

      <section className="container-page mt-16 md:mt-24" aria-labelledby="selection-titre">
        <h2 id="selection-titre" className="display text-3xl md:text-4xl">
          {t("selection.title")}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} />
          ))}
        </div>
      </section>

      <section className="mt-16 bg-stone md:mt-24" aria-labelledby="etapes-titre">
        <div className="container-page py-12 md:py-16">
          <h2 id="etapes-titre" className="display text-3xl md:text-4xl">
            {t("steps.title")}
          </h2>
          {/* Numérotation justifiée : c'est une vraie séquence. */}
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {steps.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="display text-5xl text-brand tabular-nums" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="display-sm text-xl">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
