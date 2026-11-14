import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Notre parti pris", description: "Comment nous choisissons les objets de la boutique, et pourquoi il y en a si peu." };

const principles = [
  { title: "Testé avant d'être vendu", text: "Chaque produit passe plusieurs semaines entre nos mains. S'il ne tient pas ses promesses à l'usage, il n'entre pas au catalogue." },
  { title: "Des fiches qui disent tout", text: "Matières, dimensions, origine de fabrication, entretien : nous écrivons ce que nous voudrions lire avant d'acheter." },
  { title: "Fait pour être gardé", text: "Nous privilégions les pièces réparables et les matières qui se patinent. Un bon achat est un achat que l'on ne refait pas." },
];

export default async function AboutPage() {
  const { storeName } = await getSettings();
  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-3xl">
        <p className="eyebrow">La maison</p>
        <h1 className="display mt-5 text-5xl md:text-6xl">Moins d'objets, mais de meilleurs.</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          {storeName} est une petite boutique en ligne. Nous ne cherchons pas à tout vendre : nous choisissons, catégorie par catégorie, les quelques références que nous recommanderions à nos proches.
        </p>
      </div>
      <div className="relative mt-12 aspect-[16/9] max-h-[560px] w-full overflow-hidden rounded-lg bg-muted">
        <Image src="/editorial/hero.jpg" alt="Salon lumineux avec un fauteuil jaune et un lampadaire en laiton" fill sizes="100vw" className="object-cover" priority />
      </div>
      <ol className="mt-14 grid gap-10 md:grid-cols-3">
        {principles.map((p, i) => (
          <li key={p.title} className="border-t pt-5">
            <p className="text-sm text-muted-foreground tabular-nums">0{i + 1}</p>
            <h2 className="display mt-3 text-2xl">{p.title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{p.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-14">
        <Link href="/products" className={buttonVariants({ size: "xl" })}>
          Voir la sélection
        </Link>
      </div>
    </div>
  );
}
