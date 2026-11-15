"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/account", label: "navOrders" },
  { href: "/account/wishlist", label: "navWishlist" },
  { href: "/account/profile", label: "navProfile" },
] as const;

export function AccountNav() {
  const t = useTranslations("account");
  const pathname = usePathname();
  return (
    <nav aria-label={t("nav")} className="relative overflow-x-auto border-y">
      <ul className="flex w-max">
        {links.map((l) => {
          const active = l.href === "/account" ? pathname === "/account" || pathname.startsWith("/account/orders") : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="border-l first:border-l-0">
              <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("display-sm block px-4 py-3 text-xl whitespace-nowrap -outline-offset-2", active ? "bg-highlight text-highlight-foreground" : "hover:bg-muted")}>
                {t(l.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
