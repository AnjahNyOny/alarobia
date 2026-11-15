import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/store/auth-forms";
import { Link } from "@/i18n/navigation";
import { redirectTo } from "@/i18n/server";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) return redirectTo(safeNext(next));
  const t = await getTranslations("auth");
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="container-page py-10 md:py-16">
      <div className="w-full max-w-sm">
        <h1 className="display text-5xl">{t("registerTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("registerLead")}</p>
        <div className="mt-8">
          <RegisterForm next={next} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {t.rich("already", {
            link: (chunks) => (
              <Link href={`/login${suffix}`} className="font-medium text-foreground underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
