import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/store/auth-forms";
import { Link } from "@/i18n/navigation";
import { redirectTo } from "@/i18n/server";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) return redirectTo(safeNext(next));
  const t = await getTranslations("auth");
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="container-page py-10 md:py-16">
      <div className="w-full max-w-sm">
        <h1 className="display text-5xl">{t("loginTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("loginLead")}</p>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {t.rich("noAccount", {
            link: (chunks) => (
              <Link href={`/register${suffix}`} className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
