import type { StoreSettings } from "@prisma/client";
import { Heart, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";
import { getCart, type Cart } from "@/lib/cart";
import { db } from "@/lib/db";
import { CATEGORY_FIELDS, localize } from "@/lib/localize";
import { getSettings } from "@/lib/settings";
import { CartButton, CartDrawer } from "./cart-drawer";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";

export type ShellData = {
  settings: StoreSettings;
  user: Awaited<ReturnType<typeof getUser>>;
  cart: Cart;
  categories: { name: string; slug: string }[];
  locale: string;
  announcement: string;
};

/**
 * Données de l'en-tête et du pied de page, chargées en une fois par la mise en page.
 * Header et Footer restent synchrones (voir CLAUDE.md, « Erreurs d'hydratation »).
 */
export async function loadShell(): Promise<ShellData> {
  const [settings, user, cart, rawCategories, locale] = await Promise.all([
    getSettings(),
    getUser(),
    getCart(),
    db.category.findMany({ orderBy: { position: "asc" }, include: { translations: true } }),
    getLocale(),
  ]);
  const categories = rawCategories.map((c) => localize(c, locale, CATEGORY_FIELDS)).map(({ name, slug }) => ({ name, slug }));
  const announcement = (locale === "en" && settings.announcementEn) || (locale === "mg" && settings.announcementMg) || settings.announcement;
  return { settings, user, cart, categories, locale, announcement };
}

export function Header({ settings, user, cart, categories, locale, announcement }: ShellData) {
  // useTranslations (synchrone) : ce composant ne doit pas devenir asynchrone, voir CLAUDE.md.
  const t = useTranslations("nav");
  const links = [
    { href: "/products", label: t("all") },
    ...categories.map((c) => ({ href: `/products?category=${c.slug}`, label: c.name })),
    { href: "/products?sale=1", label: t("sale"), accent: true },
  ];
  const iconLink = "grid size-10 place-items-center rounded-md transition-colors hover:bg-muted";

  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t("skip")}
      </a>
      {(announcement || user?.role === "ADMIN") && (
        <div className="bg-highlight text-highlight-foreground">
          <div className="container-page flex min-h-8 items-center justify-center gap-4 py-1.5 text-[0.8125rem] font-medium">
            <p className="text-center">{announcement}</p>
            {user?.role === "ADMIN" && (
              <Link href="/admin" className="ml-auto hidden shrink-0 underline underline-offset-4 sm:block">
                {t("admin")}
              </Link>
            )}
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container-page flex h-16 items-center gap-2 md:gap-6">
          <MobileNav links={links} storeName={settings.storeName} signedIn={!!user} />
          <Link href="/" aria-label={t("home", { name: settings.storeName })} className="shrink-0">
            <Logo name={settings.storeName} />
          </Link>
          {/* On vient chercher un objet : la recherche occupe le centre de l'en-tête. */}
          <form action={`/${locale}/products`} role="search" className="relative mx-auto hidden w-full max-w-xl md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
            <LanguageSwitcher compact className="mr-1 hidden sm:block" />
            <Link href={user ? "/account" : "/login"} className={iconLink} aria-label={user ? t("account") : t("signIn")}>
              <User className="size-5" strokeWidth={1.75} aria-hidden />
            </Link>
            <Link href="/account/wishlist" className={`${iconLink} hidden sm:grid`} aria-label={t("wishlist")}>
              <Heart className="size-5" strokeWidth={1.75} aria-hidden />
            </Link>
            <CartButton count={cart.count} label={t("cartCount", { count: cart.count })} />
          </div>
        </div>
        <nav aria-label={t("categories")} className="hidden border-t lg:block">
          <ul className="container-page flex h-11 items-center gap-7 text-sm font-medium">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={`py-2 underline-offset-[6px] hover:underline ${"accent" in l ? "text-brand" : ""}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <CartDrawer
        currency={settings.currency}
        subtotalCents={cart.subtotalCents}
        freeShippingThresholdCents={settings.freeShippingThresholdCents}
        lines={cart.lines.map((l) => ({
          id: l.product.id,
          name: l.product.name,
          slug: l.product.slug,
          image: l.image,
          priceCents: l.product.priceCents,
          quantity: l.quantity,
          stock: l.product.stock,
        }))}
      />
    </>
  );
}
