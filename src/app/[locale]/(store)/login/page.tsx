import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirectTo } from "@/i18n/server";
import { LoginForm } from "@/components/store/auth-forms";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) return redirectTo(safeNext(next));
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="container-page flex justify-center py-14 md:py-20">
      <div className="w-full max-w-sm">
        <h1 className="display text-4xl">Connexion</h1>
        <p className="mt-3 text-muted-foreground">Retrouvez vos commandes, vos favoris et votre adresse.</p>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href={`/register${suffix}`} className="font-medium text-foreground underline underline-offset-4">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
