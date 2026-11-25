"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Mail, Menu, MessageSquare, Package, Settings, ShoppingCart, TicketPercent, Truck, Users } from "lucide-react";
import { logout } from "@/actions/auth";
import { LogoMark } from "@/components/logo";
import { LanguageSwitcher } from "@/components/store/language-switcher";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Libellés lus dans `admin.nav` : les clés servent aussi d'identifiants stables pour React. */
const groups = [
  {
    key: "activity",
    items: [
      { href: "/admin", key: "dashboard", icon: LayoutDashboard },
      { href: "/admin/orders", key: "orders", icon: ShoppingCart, badge: true },
      { href: "/admin/customers", key: "customers", icon: Users },
      { href: "/admin/newsletter", key: "newsletter", icon: Mail },
    ],
  },
  {
    key: "catalog",
    items: [
      { href: "/admin/products", key: "products", icon: Package },
      { href: "/admin/categories", key: "categories", icon: FolderTree },
      { href: "/admin/reviews", key: "reviews", icon: MessageSquare },
    ],
  },
  {
    key: "store",
    items: [
      { href: "/admin/shipping", key: "shipping", icon: Truck },
      { href: "/admin/promotions", key: "promotions", icon: TicketPercent },
      { href: "/admin/settings", key: "settings", icon: Settings },
    ],
  },
] as const;

const footerLink = "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground";

function Nav({ toProcess, storeName, userName, onNavigate }: { toProcess: number; storeName: string; userName: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 min-w-0 items-center gap-2 px-4">
        <LogoMark className="h-6 shrink-0" />
        <span className="truncate font-medium">{storeName}</span>
        <span className="shrink-0 rounded border px-1.5 py-px text-[0.6875rem] text-muted-foreground">{t("badge")}</span>
      </div>
      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-2.5 py-2">
        {groups.map((g) => (
          <div key={g.key} className="mb-5">
            <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">{t(g.key)}</p>
            <ul className="grid gap-0.5">
              {g.items.map((item) => {
                const { href, key, icon: Icon } = item;
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors", active ? "bg-sidebar-accent font-medium text-foreground" : "text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground")}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0">{t(key)}</span>
                      {"badge" in item && toProcess > 0 && (
                        <span className="ml-auto rounded-full bg-brand px-1.5 text-[0.6875rem] leading-5 font-semibold text-brand-foreground tabular-nums" aria-label={t("toProcess", { count: toProcess })}>
                          {toProcess}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="grid gap-0.5 border-t p-2.5 text-sm">
        {/*
          Même page, mêmes paramètres, autre langue. Chaque langue est écrite dans sa langue : on la reconnaît même
          quand l'interface est dans une autre. La courante est soulignée (pas seulement colorée) et annoncée par aria-current.
        */}
        <LanguageSwitcher
          className="pb-1 text-foreground"
          listClassName="grid grid-cols-3 gap-0.5"
          linkClassName="flex h-9 items-center justify-center px-1 text-[0.8125rem] aria-[current]:bg-sidebar-accent hover:bg-sidebar-accent/60"
        />
        <Link href="/" className={footerLink}>
          <ExternalLink className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> {t("viewStore")}
        </Link>
        <form action={logout}>
          <button type="submit" className={cn(footerLink, "w-full")}>
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> {t("signOut")}
          </button>
        </form>
        <p className="truncate px-2.5 pt-1.5 text-xs text-muted-foreground">{t("signedInAs", { name: userName })}</p>
      </div>
    </div>
  );
}

export function AdminSidebar(props: { toProcess: number; storeName: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("admin.nav");
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <Nav {...props} />
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger id="declencheur-menu-admin" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted" aria-label={t("openMenu")}>
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-64 gap-0 bg-sidebar p-0 data-[side=left]:w-64">
            <SheetHeader className="sr-only">
              <SheetTitle>{t("menuTitle")}</SheetTitle>
              <SheetDescription>{t("menuDescription")}</SheetDescription>
            </SheetHeader>
            <Nav {...props} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="flex min-w-0 items-center gap-2">
          <LogoMark className="h-5 shrink-0" />
          <span className="truncate font-medium">{props.storeName}</span>
        </span>
      </div>
    </>
  );
}
