import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("pages");
  return (
    <div className="container-page pt-12 pb-12 md:pt-20">
      <h1 className="display text-5xl md:text-6xl">{t("notFoundTitle")}</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">{t("notFoundText")}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/" className={buttonVariants({ size: "md" })}>
          {t("home")}
        </Link>
        <Link href="/products" className={buttonVariants({ size: "md", variant: "outline" })}>
          {t("products")}
        </Link>
      </div>
    </div>
  );
}
