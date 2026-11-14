import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { NewsletterForm } from "./newsletter-form";

export async function Footer() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    db.category.findMany({ orderBy: { position: "asc" }, select: { name: true, slug: true } }),
  ]);
  const columns = [
    { title: "Boutique", links: [{ href: "/produits", label: "Tous les produits" }, ...categories.map((c) => ({ href: `/produits?categorie=${c.slug}`, label: c.name }))] },
    {
      title: "Aide",
      links: [
        { href: "/aide#livraison", label: "Livraison" },
        { href: "/aide#retours", label: "Retours et remboursements" },
        { href: "/aide#questions", label: "Questions fréquentes" },
        { href: "/compte", label: "Suivre une commande" },
      ],
    },
    {
      title: "La maison",
      links: [
        { href: "/a-propos", label: "Notre parti pris" },
        { href: "/mentions-legales", label: "Mentions légales et CGV" },
        { href: `mailto:${settings.contactEmail}`, label: "Nous écrire" },
      ],
    },
  ];
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.3fr_2fr]">
        <div className="max-w-sm">
          <p className="display text-3xl">{settings.storeName}</p>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            Une lettre par mois : les nouveautés, les retours en stock et quelques conseils d'entretien. Désinscription en un clic.
          </p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-sm font-medium">{col.title}</p>
              <ul className="mt-4 grid gap-2.5 text-sm text-primary-foreground/70">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition-colors hover:text-primary-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="container-page flex flex-wrap justify-between gap-2 py-5 text-[0.8125rem] text-primary-foreground/60">
          <p>
            © {new Date().getFullYear()} {settings.storeName}. Tous droits réservés.
          </p>
          <p>Prix affichés toutes taxes comprises.</p>
        </div>
      </div>
    </footer>
  );
}
