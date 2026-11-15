"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("pages");
  return (
    <div className="container-page pt-12 pb-12 md:pt-20">
      <h1 className="display text-5xl">{t("errorTitle")}</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">{t("errorText")}</p>
      <Button size="md" className="mt-7" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
