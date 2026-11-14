"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, MessageSquare, Package, Settings, ShoppingCart, TicketPercent, Users } from "lucide-react";
import { logout } from "@/actions/auth";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Activité",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart, badge: true },
      { href: "/admin/clients", label: "Clients", icon: Users },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/produits", label: "Produits", icon: Package },
      { href: "/admin/categories", label: "Catégories", icon: FolderTree },
      { href: "/admin/avis", label: "Avis", icon: MessageSquare },
    ],
  },
  {
    label: "Boutique",
    items: [
      { href: "/admin/promotions", label: "Codes promo", icon: TicketPercent },
      { href: "/admin/reglages", label: "Réglages", icon: Settings },
    ],
  },
];

function Nav({ toProcess, storeName, userName, onNavigate }: { toProcess: number; storeName: string; userName: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{storeName.charAt(0)}</span>
        <span className="font-medium">{storeName}</span>
        <span className="rounded border px-1.5 py-px text-[0.6875rem] text-muted-foreground">Admin</span>
      </div>
      <nav aria-label="Administration" className="flex-1 overflow-y-auto px-2.5 py-2">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">{g.label}</p>
            <ul className="grid gap-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors", active ? "bg-sidebar-accent font-medium text-foreground" : "text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground")}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      {label}
                      {badge && toProcess > 0 && (
                        <span className="ml-auto rounded-full bg-brand px-1.5 text-[0.6875rem] leading-5 font-semibold text-brand-foreground tabular-nums" aria-label={`${toProcess} à traiter`}>
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
        <Link href="/" className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground">
          <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden /> Voir la boutique
        </Link>
        <form action={logout}>
          <button type="submit" className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground">
            <LogOut className="size-4" strokeWidth={1.75} aria-hidden /> Se déconnecter
          </button>
        </form>
        <p className="truncate px-2.5 pt-1.5 text-xs text-muted-foreground">Connecté : {userName}</p>
      </div>
    </div>
  );
}

export function AdminSidebar(props: { toProcess: number; storeName: string; userName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <Nav {...props} />
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger id="declencheur-menu-admin" className="grid size-9 place-items-center rounded-md hover:bg-muted" aria-label="Ouvrir le menu">
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-64 gap-0 bg-sidebar p-0 data-[side=left]:w-64">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu d'administration</SheetTitle>
              <SheetDescription>Navigation</SheetDescription>
            </SheetHeader>
            <Nav {...props} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-medium">{props.storeName}</span>
      </div>
    </>
  );
}
