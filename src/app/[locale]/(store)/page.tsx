import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Headset, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { cardInclude, wishedIds } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <h2 className="display text-3xl md:text-4xl">{title}</h2>
      <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-medium underline-offset-4 hover:underline">
        {linkLabel}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [settings, user] = await Promise.all([getSettings(), getUser()]);
  const [categories, featured, latest, wished] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } } }),
    db.product.findMany({ where: { status: "ACTIVE", featured: true }, include: cardInclude, orderBy: { updatedAt: "desc" }, take: 8 }),
    db.product.findMany({ where: { status: "ACTIVE" }, include: cardInclude, orderBy: { createdAt: "desc" }, take: 4 }),
    wishedIds(user?.id),
  ]);

  const promises = [
    { icon: PackageCheck, title: "Livraison soignée", text: settings.freeShippingThresholdCents > 0 ? `Offerte dès ${formatPrice(settings.freeShippingThresholdCents, settings.currency)} d'achat` : "Expédition sous 24 h" },
    { icon: RotateCcw, title: "30 jours pour changer d'avis", text: "Retour simple et remboursement rapide" },
    { icon: ShieldCheck, title: "Paiement sécurisé", text: "Carte bancaire ou paiement à la livraison" },
    { icon: Headset, title: "Une équipe à l'écoute", text: "Réponse sous 24 h, du lundi au samedi" },
  ];

  return (
    <>
      <section className="container-page grid items-center gap-8 pt-8 md:pt-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="max-w-xl py-4 lg:py-12">
          <p className="eyebrow">Collection d'automne</p>
          <h1 className="display mt-5 text-[2.75rem] sm:text-6xl lg:text-[4.25rem]">
            Des objets bien faits, <em className="text-brand">pour tous les jours.</em>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Mobilier, vêtements et accessoires choisis un à un, pour leur fabrication honnête et leur capacité à bien vieillir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className={buttonVariants({ size: "xl" })}>
              Découvrir la boutique
            </Link>
            <Link href="/products?category=maison" className={buttonVariants({ size: "xl", variant: "outline" })}>
              L'univers maison
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted lg:aspect-[5/4]">
          <Image src="/editorial/hero.jpg" alt="Salon lumineux avec un fauteuil jaune, un lampadaire en laiton et une affiche encadrée" fill priority sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover" />
        </div>
      </section>

      <section aria-label="Nos engagements" className="container-page mt-12 md:mt-16">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-6 border-y py-7 lg:grid-cols-4">
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page mt-16 md:mt-24">
        <SectionHeader title="Par univers" href="/products" linkLabel="Tout le catalogue" />
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/products?category=${c.slug}`} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                  {c.image && <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw" className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]" />}
                </div>
                <p className="mt-3 font-medium group-hover:underline group-hover:underline-offset-4">{c.name}</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {c._count.products} article{c._count.products > 1 ? "s" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page mt-16 md:mt-24">
        <SectionHeader title="La sélection du moment" href="/products" linkLabel="Voir tout" />
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} />
          ))}
        </div>
      </section>

      <section className="mt-16 bg-secondary md:mt-24">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-20">
          <div className="relative aspect-[4/5] max-h-[560px] overflow-hidden rounded-lg bg-muted md:order-last">
            <Image src="/products/canape-lin.jpg" alt="Canapé en lin beige dans un salon aux tons naturels" fill sizes="(min-width: 768px) 46vw, 100vw" className="object-cover" />
          </div>
          <div className="max-w-lg">
            <p className="eyebrow">Notre parti pris</p>
            <h2 className="display mt-5 text-3xl md:text-5xl">Moins d'objets, mais de meilleurs.</h2>
            <p className="mt-6 leading-relaxed text-muted-foreground">
              Chaque référence est testée plusieurs semaines avant d'entrer au catalogue. Nous indiquons les matières, l'origine de fabrication et la manière d'entretenir chaque pièce, parce qu'un bon achat est un achat que l'on garde.
            </p>
            <Link href="/about" className={cn(buttonVariants({ size: "md", variant: "outline" }), "mt-8 bg-transparent")}>
              Lire notre démarche
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page mt-16 md:mt-24">
        <SectionHeader title="Derniers arrivages" href="/products?sort=newest" linkLabel="Toutes les nouveautés" />
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {latest.map((p) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} wished={wished.has(p.id)} />
          ))}
        </div>
      </section>
    </>
  );
}
