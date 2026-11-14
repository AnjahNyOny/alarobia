"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/compte", label: "Commandes" },
  { href: "/compte/favoris", label: "Favoris" },
  { href: "/compte/profil", label: "Profil et adresse" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace client" className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map((l) => {
        const active = l.href === "/compte" ? pathname === "/compte" || pathname.startsWith("/compte/commandes") : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors", active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
