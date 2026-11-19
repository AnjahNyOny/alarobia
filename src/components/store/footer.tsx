import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { madagascarTime } from "@/lib/shipping";
import type { ShellData } from "./header";
import { LanguageSwitcher } from "./language-switcher";
import { NewsletterForm } from "./newsletter-form";

export function Footer({ settings, categories }: Pick<ShellData, "settings" | "categories">) {
  // useTranslations (synchrone) : ce composant ne doit pas devenir asynchrone, voir CLAUDE.md.
  const t = useTranslations("footer");
  const columns = [
    { title: t("shop"), links: [{ href: "/products", label: t("allProducts") }, ...categories.map((c) => ({ href: `/products?category=${c.slug}`, label: c.name }))] },
    {
      title: t("help"),
      links: [
        { href: "/help#livraison", label: t("delivery") },
        { href: "/help#retours", label: t("returns") },
        { href: "/help#questions", label: t("faq") },
        { href: "/account", label: t("track") },
      ],
    },
    {
      title: t("company"),
      links: [
        { href: "/about", label: t("about") },
        { href: "/legal", label: t("legal") },
      ],
    },
  ];
  return (
    <footer className="mt-20 bg-primary text-primary-foreground md:mt-28">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.2fr_2fr]">
        <div className="max-w-sm">
          <p className="flex items-center gap-2.5">
            <LogoMark className="h-8" />
            <span className="display text-3xl lowercase">{settings.storeName}</span>
          </p>
          <p className="mt-5 text-sm leading-relaxed text-primary-foreground/75">{t("newsletterText")}</p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="display-sm text-lg">{col.title}</p>
              <ul className="mt-4 grid gap-2.5 text-sm text-primary-foreground/75">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} prefetch={false} className="underline-offset-4 hover:text-primary-foreground hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {col.title === t("company") && (
                  <li>
                    <a href={`mailto:${settings.contactEmail}`} className="underline-offset-4 hover:text-primary-foreground hover:underline">
                      {t("contact")}
                    </a>
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-primary-foreground/20">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 text-[0.8125rem] text-primary-foreground/75">
          <p>{t("rights", { year: madagascarTime().getFullYear(), name: settings.storeName })}</p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
