"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, Search } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links, storeName, signedIn }: { links: { href: string; label: string; accent?: boolean }[]; storeName: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const locale = useLocale();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Identifiant fixe : un useId généré dans la mise en page asynchrone peut différer entre serveur et navigateur. */}
      <SheetTrigger id="declencheur-menu" className="grid size-10 place-items-center rounded-md hover:bg-muted lg:hidden" aria-label={t("openMenu")}>
        <Menu className="size-5" strokeWidth={1.6} aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-full gap-0 sm:max-w-sm data-[side=left]:w-[86%]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="display text-2xl lowercase">{storeName}</SheetTitle>
          <SheetDescription className="sr-only">{t("menu")}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("menu")} className="flex flex-col px-5 py-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} prefetch={false} onClick={() => setOpen(false)} className="border-b py-3.5 text-lg last:border-0">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={`/${locale}/products`} className="relative border-t px-5 py-4" onSubmit={() => setOpen(false)}>
          <Search className="pointer-events-none absolute top-1/2 left-8 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" type="search" placeholder={t("search")} aria-label={t("search")} className="h-11 w-full rounded-md border border-input bg-card pr-3 pl-10 text-base outline-none focus-visible:border-ring" />
        </form>
        <div className="mt-auto grid gap-1 border-t px-5 py-4 text-sm text-muted-foreground">
          <LanguageSwitcher className="pb-2 text-foreground" />
          <Link href={signedIn ? "/account" : "/login"} prefetch={false} onClick={() => setOpen(false)} className="py-1.5 text-foreground">
            {signedIn ? t("account") : t("signIn")}
          </Link>
          <Link href="/help" prefetch={false} onClick={() => setOpen(false)} className="py-1.5">
            {t("help")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
