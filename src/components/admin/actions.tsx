"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { FormState } from "@/lib/form";

/**
 * Bouton d'action irréversible : demande toujours confirmation et annonce le résultat.
 * Sans `confirmLabel` ni `cancelLabel`, les boutons disent « Supprimer » et « Annuler » dans la langue de l'interface (`admin.common`).
 */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel,
  cancelLabel,
  children,
  variant = "ghost",
  size = "sm",
  danger = true,
  redirectTo,
  focusAfter,
}: {
  action: () => Promise<FormState>;
  title: string;
  description: string;
  /** Bouton qui exécute l'action ; « Supprimer » par défaut. */
  confirmLabel?: string;
  /** Bouton qui referme la fenêtre sans rien faire ; « Annuler » par défaut. */
  cancelLabel?: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Faux pour une confirmation qui ne détruit rien (« Paiement reçu ») : le bouton n'est pas rouge. */
  danger?: boolean;
  redirectTo?: string;
  /**
   * `id` de l'élément qui confirme le nouvel état, focalisé après une réussite. Pour une action qui fait disparaître
   * son propre bouton (« Paiement reçu ») : sans lui, le focus retomberait sur la page.
   */
  focusAfter?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const t = useTranslations("admin.common");
  const succeeded = useRef(false);
  const focusTarget = () => (succeeded.current && focusAfter ? document.getElementById(focusAfter) : null);

  // Le bouton disparaît avec la commande qui change d'état : ce composant est démonté avec sa fenêtre,
  // qui ne peut plus rendre le focus. On le place sur la confirmation, une fois la nouvelle page affichée.
  useEffect(() => {
    if (!focusAfter) return;
    return () => {
      if (succeeded.current) requestAnimationFrame(() => document.getElementById(focusAfter)?.focus());
    };
  }, [focusAfter]);

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Si le bouton reste en place, la fenêtre rend le focus à la confirmation (ou, par défaut, au bouton). */}
        <DialogContent showCloseButton={false} finalFocus={() => focusTarget() ?? true}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)} disabled={pending}>
              {cancelLabel ?? t("cancel")}
            </Button>
            <Button
              type="button"
              size="lg"
              className={danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              disabled={pending}
              focusableWhenDisabled
              onClick={() =>
                start(async () => {
                  const res = await action();
                  if (res.error) toast.error(res.error);
                  else {
                    succeeded.current = true;
                    toast.success(res.message ?? t("done"));
                    if (redirectTo) router.push(redirectTo);
                  }
                  setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel ?? t("delete")}
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

/** Affiche une confirmation après une redirection (?ok=…), puis nettoie l'URL. `messages` : clé de `ok` → texte déjà traduit. */
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

/** Liste qui change un paramètre de l'adresse dès qu'on choisit. `label` et les libellés des options arrivent traduits. */
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
