import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page grid justify-items-center gap-4 py-28 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="display text-5xl">Cette page n'existe pas</h1>
      <p className="max-w-sm text-muted-foreground">Le lien est peut-être ancien, ou le produit a été retiré de la vente.</p>
      <div className="mt-2 flex gap-3">
        <Link href="/" className={buttonVariants({ size: "md" })}>
          Retour à l'accueil
        </Link>
        <Link href="/produits" className={buttonVariants({ size: "md", variant: "outline" })}>
          Voir les produits
        </Link>
      </div>
    </div>
  );
}
