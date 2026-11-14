import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { AccountNav } from "@/components/store/account-nav";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="container-page pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Espace client</p>
          <h1 className="display mt-3 text-4xl md:text-5xl">Bonjour, {user.name.split(" ")[0]}</h1>
        </div>
        <form action={logout}>
          <button type="submit" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            <LogOut className="size-4" aria-hidden /> Se déconnecter
          </button>
        </form>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-14">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
