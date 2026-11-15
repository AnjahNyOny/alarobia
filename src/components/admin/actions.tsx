"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { FormState } from "@/lib/form";

/** Bouton d'action irréversible : demande toujours confirmation et annonce le résultat. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Supprimer",
  children,
  variant = "ghost",
  size = "sm",
  danger = true,
  redirectTo,
}: {
  action: () => Promise<FormState>;
  title: string;
  description: string;
  confirmLabel?: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Faux pour une confirmation qui ne détruit rien (« Paiement reçu ») : le bouton n'est pas rouge. */
  danger?: boolean;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              type="button"
              size="lg"
              className={danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await action();
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success(res.message ?? "Action effectuée.");
                    if (redirectTo) router.push(redirectTo);
                  }
                  setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ToggleAction({ checked, action, label }: { checked: boolean; action: (next: boolean) => Promise<void>; label: string }) {
  const [pending, start] = useTransition();
  return <Switch checked={checked} disabled={pending} aria-label={label} onCheckedChange={(next) => start(() => action(next))} />;
}

/** Affiche une confirmation après une redirection (?ok=…), puis nettoie l'URL. */
export function FlashToast({ messages }: { messages: Record<string, string> }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const key = params.get("ok");
  useEffect(() => {
    if (!key || !messages[key]) return;
    toast.success(messages[key]);
    const next = new URLSearchParams(params);
    next.delete("ok");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [key, messages, params, pathname, router]);
  return null;
}

export function AutoSubmitSelect({ name, value, options, label, params = {} }: { name: string; value: string; options: { value: string; label: string }[]; label: string; params?: Record<string, string | undefined> }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      aria-label={label}
      value={value}
      className="field-select h-9 w-auto"
      onChange={(e) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
        if (e.target.value) next.set(name, e.target.value);
        router.push(next.size ? `${pathname}?${next}` : pathname);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
