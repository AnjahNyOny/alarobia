import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("title") };
}

export default async function LegalPage() {
  const [s, t] = await Promise.all([getSettings(), getTranslations("legal")]);
  const sections = [
    [t("s1"), t("s1text", { name: s.storeName })],
    [t("s2"), t("s2text")],
    [t("s3"), t("s3text")],
    [t("s4"), t("s4text", { email: s.contactEmail })],
    [t("s5"), t("s5text")],
  ];
  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-3xl">
        <h1 className="display text-5xl md:text-6xl">{t("title")}</h1>
        <p className="mt-6 bg-highlight px-4 py-3 text-sm font-medium text-highlight-foreground">{t("notice")}</p>
        {sections.map(([title, text]) => (
          <section key={title} className="mt-10">
            <h2 className="display-sm text-2xl">{title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
