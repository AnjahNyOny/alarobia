"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links, storeName, signedIn }: { links: { href: string; label: string }[]; storeName: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Identifiant fixe : un useId généré dans la mise en page asynchrone peut différer entre serveur et navigateur. */}
      <SheetTrigger id="declencheur-menu" className="grid size-10 place-items-center rounded-lg hover:bg-muted lg:hidden" aria-label="Ouvrir le menu">
        <Menu className="size-5" strokeWidth={1.6} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-full gap-0 sm:max-w-sm data-[side=left]:w-[86%]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="display text-2xl">{storeName}</SheetTitle>
          <SheetDescription className="sr-only">Menu principal</SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu principal" className="flex flex-col px-5 py-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b py-3.5 text-lg last:border-0">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action="/products" className="relative border-t px-5 py-4" onSubmit={() => setOpen(false)}>
          <Search className="pointer-events-none absolute top-1/2 left-8 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" type="search" placeholder="Rechercher un produit" aria-label="Rechercher un produit" className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-base outline-none focus-visible:border-ring" />
        </form>
        <div className="mt-auto grid gap-1 border-t px-5 py-4 text-sm text-muted-foreground">
          <Link href={signedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="py-1.5 text-foreground">
            {signedIn ? "Mon compte" : "Se connecter"}
          </Link>
          <Link href="/help" onClick={() => setOpen(false)} className="py-1.5">
            Livraison, retours et aide
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
