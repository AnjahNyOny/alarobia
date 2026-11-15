import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { logout } from "@/actions/auth";
import { AccountNav } from "@/components/store/account-nav";
import { requireUser } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([requireUser(), getTranslations("account")]);
  return (
    <div className="container-page pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl md:text-6xl">{t("hello", { name: user.name.split(" ")[0] })}</h1>
        <form action={logout}>
          <button type="submit" className="text-sm underline underline-offset-4">
            {t("signOut")}
          </button>
        </form>
      </div>
      {/* Même rangée d'enseignes que les rayons du catalogue. */}
      <div className="mt-7">
        <AccountNav />
      </div>
      <div className="mt-8 min-w-0">{children}</div>
    </div>
  );
}
