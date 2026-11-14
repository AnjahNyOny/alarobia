"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";

type Point = { date: string; label: string; revenueCents: number; orders: number };

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: Point }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-muted-foreground">{p.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{formatPrice(p.revenueCents, currency)}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {p.orders} commande{p.orders > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function RevenueChart({ data, currency }: { data: Point[]; currency: string }) {
  const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="h-64 w-full" role="img" aria-label="Courbe du chiffre d'affaires par jour sur la période. Le détail figure dans le tableau des commandes.">
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
