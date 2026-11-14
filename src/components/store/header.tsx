import { Link } from "@/i18n/navigation";
import { Heart, Search, User } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import type { StoreSettings } from "@prisma/client";
import { getCart, type Cart } from "@/lib/cart";
import { getSettings } from "@/lib/settings";
import { CartButton, CartDrawer } from "./cart-drawer";
import { MobileNav } from "./mobile-nav";

export type ShellData = {
  settings: StoreSettings;
  user: Awaited<ReturnType<typeof getUser>>;
  cart: Cart;
  categories: { name: string; slug: string }[];
};

/**
 * Données de l'en-tête et du pied de page, chargées en une fois par la mise en page.
 * Header et Footer restent synchrones : des composants serveur asynchrones placés côte à côte
 * décalaient l'hydratation quand leurs données arrivaient après le démarrage de React
 * (identifiants useId différents, erreur #418 intermittente).
 */
export async function loadShell(): Promise<ShellData> {
  const [settings, user, cart, categories] = await Promise.all([
    getSettings(),
    getUser(),
    getCart(),
    db.category.findMany({ orderBy: { position: "asc" }, select: { name: true, slug: true } }),
  ]);
  return { settings, user, cart, categories };
}

export function Header({ settings, user, cart, categories }: ShellData) {
  const links = [
    { href: "/products", label: "Tout voir" },
    ...categories.map((c) => ({ href: `/products?category=${c.slug}`, label: c.name })),
    { href: "/products?sale=1", label: "Promotions" },
  ];
  const iconLink = "grid size-10 place-items-center rounded-lg transition-colors hover:bg-muted";

  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">
        Aller au contenu
      </a>
      {(settings.announcement || user?.role === "ADMIN") && (
        <div className="bg-primary text-primary-foreground">
          <div className="container-page flex min-h-9 items-center justify-center gap-4 py-1.5 text-[0.8125rem]">
            <p className="text-center">{settings.announcement}</p>
            {user?.role === "ADMIN" && (
              <Link href="/admin" className="ml-auto hidden shrink-0 underline underline-offset-4 sm:block">
                Administration
              </Link>
            )}
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-md">
        <div className="container-page flex h-16 items-center gap-2 lg:gap-8">
          <MobileNav links={links} storeName={settings.storeName} signedIn={!!user} />
          <Link href="/" className="display text-[1.75rem] leading-none" aria-label={`${settings.storeName}, accueil`}>
            {settings.storeName}
          </Link>
          <nav aria-label="Catégories" className="hidden items-center gap-6 text-sm lg:flex">
            {links.slice(1).map((l) => (
              <Link key={l.href} href={l.href} className="py-2 text-foreground/80 transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-0.5">
            <form action="/products" role="search" className="relative mr-2 hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                name="q"
                type="search"
                placeholder="Rechercher"
                aria-label="Rechercher un produit"
                className="h-10 w-44 rounded-lg border border-transparent bg-muted pr-3 pl-9 text-sm outline-none transition-[width,border-color,background-color] placeholder:text-muted-foreground focus:w-64 focus:border-input focus:bg-card"
              />
            </form>
            <Link href={user ? "/account" : "/login"} className={iconLink} aria-label={user ? "Mon compte" : "Se connecter"}>
              <User className="size-5" strokeWidth={1.6} aria-hidden />
            </Link>
            <Link href="/account/wishlist" className={`${iconLink} hidden sm:grid`} aria-label="Mes favoris">
              <Heart className="size-5" strokeWidth={1.6} aria-hidden />
            </Link>
            <CartButton count={cart.count} />
          </div>
        </div>
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
