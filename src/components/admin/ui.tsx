import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, back, children }: { title: string; description?: string; back?: { href: string; label: string }; children?: React.ReactNode }) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Card({ title, description, action, children, className, flush }: { title?: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {title && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "" : cn("px-5 pb-5", !title && "pt-5")}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/** Recherche par formulaire GET : l'état vit dans l'URL, donc partageable et compatible avec le bouton Retour. */
export function SearchForm({ action, placeholder, defaultValue, hidden = {} }: { action: string; placeholder: string; defaultValue?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} role="search" className="relative w-full max-w-xs">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
    </form>
  );
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string; value: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Filtrer" className="-mb-px flex gap-5 overflow-x-auto border-b">
      {tabs.map((t) => {
        const active = t.value === current;
        return (
          <Link key={t.value} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-1.5 border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors", active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count != null && <span className="text-xs text-muted-foreground tabular-nums">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pagination({ page, pages, total, href }: { page: number; pages: number; total: number; href: (page: number) => string }) {
  if (pages <= 1) return <p className="px-5 py-3 text-[0.8125rem] text-muted-foreground">{total} résultat{total > 1 ? "s" : ""}</p>;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <p className="text-[0.8125rem] text-muted-foreground">
        Page {page} sur {pages} · {total} résultats
      </p>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ChevronLeft aria-hidden /> Précédent
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Suivant <ChevronRight aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const th = "h-10 px-5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
export const td = "px-5 py-3 text-sm align-middle";
