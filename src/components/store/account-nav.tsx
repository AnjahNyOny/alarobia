"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/account", label: "Commandes" },
  { href: "/account/wishlist", label: "Favoris" },
  { href: "/account/profile", label: "Profil et adresse" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace client" className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map((l) => {
        const active = l.href === "/account" ? pathname === "/account" || pathname.startsWith("/account/orders") : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors", active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
