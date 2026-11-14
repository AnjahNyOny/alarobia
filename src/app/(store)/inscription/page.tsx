import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/store/auth-forms";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(safeNext(next));
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="container-page flex justify-center py-14 md:py-20">
      <div className="w-full max-w-sm">
        <h1 className="display text-4xl">Créer un compte</h1>
        <p className="mt-3 text-muted-foreground">Suivez vos commandes et commandez plus vite la prochaine fois.</p>
        <div className="mt-8">
          <RegisterForm next={next} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href={`/connexion${suffix}`} className="font-medium text-foreground underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
