"use client";

import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";

/** `label` arrive déjà formaté dans la langue de l'interface (jour et mois courts) ; `date` est la clé du jour à Madagascar (« 2026-11-18 »). */
type Point = { date: string; label: string; revenueCents: number; orders: number };

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: Point }[]; currency: string }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-muted-foreground">{p.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{formatPrice(p.revenueCents, currency, locale)}</p>
      <p className="text-xs text-muted-foreground tabular-nums">{t("chartOrders", { count: p.orders })}</p>
    </div>
  );
}

export function RevenueChart({ data, currency }: { data: Point[]; currency: string }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  // Même règle que formatPrice : le malgache suit l'écriture française des nombres.
  const compact = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="h-64 w-full" role="img" aria-label={t("chartLabel")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={36} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis width={44} tickLine={false} axisLine={false} tickCount={4} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => compact.format(v / 100)} />
          <Tooltip cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.25 }} content={<ChartTooltip currency={currency} />} />
          <Area type="monotone" dataKey="revenueCents" stroke="var(--brand)" strokeWidth={2} fill="url(#revenue-fill)" activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
