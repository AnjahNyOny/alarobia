"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { createIssue, sendIssueBatch, sendTestIssue, updateIssue } from "@/actions/admin/newsletter";
import { Field, Form, FormAlert, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { FormState } from "@/lib/form";
import type { BatchResult } from "@/lib/newsletter-send";
import { ISSUE_BODY_MAX, ISSUE_SUBJECT_MAX } from "@/lib/schemas";
import { ConfirmAction } from "./actions";

/**
 * Lettre d'information dans le back-office (PLAN.md 7.14) : rédaction et modification, essai au vendeur, envoi par lots
 * avec sa progression. Les textes sont dans `admin.newsletter`.
 */

/** Objet et texte d'une lettre. Sans `issue`, crée la lettre (l'action redirige vers sa page) ; avec, la modifie. */
export function IssueForm({ issue }: { issue?: { id: string; subject: string; body: string } }) {
  const [state, action] = useActionState<FormState, FormData>(issue ? updateIssue.bind(null, issue.id) : createIssue, {});
  const t = useTranslations("admin.newsletter");
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  const e = state.fieldErrors ?? {};
  return (
    <Form action={action} className="grid gap-4">
      <FormAlert state={{ error: state.error }} />
      <Field label={t("subject")} name="subject" defaultValue={issue?.subject} error={e.subject} maxLength={ISSUE_SUBJECT_MAX} required autoComplete="off" />
      <Field as="textarea" label={t("body")} name="body" defaultValue={issue?.body} error={e.body} hint={t("bodyHint")} maxLength={ISSUE_BODY_MAX} required rows={issue ? 10 : 16} />
      <div>
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </Form>
  );
}

/** « M'envoyer un essai » : le résultat est annoncé par une notification, l'adresse est écrite sous le bouton. */
export function TestSendButton({ issueId, hint }: { issueId: string; hint: string }) {
  const t = useTranslations("admin.newsletter");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="md"
        disabled={pending}
        focusableWhenDisabled
        aria-describedby="essai-adresse"
        className="w-full"
        onClick={() =>
          start(async () => {
            const res = await sendTestIssue(issueId);
            if (res.error) toast.error(res.error);
            else toast.success(res.message);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("testButton")}
      </Button>
      <p id="essai-adresse" className="text-[0.8125rem] break-words text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

type Progress = { delivered: number; attempted: number; remaining: number };

/**
 * Envoi aux inscrits confirmés, par lots : l'action `sendIssueBatch` est rappelée tant qu'il reste des adresses et
 * qu'elle ne s'est pas arrêtée (plafond, refus de Gmail). Quitter la page arrête la boucle ; la base sait où l'envoi en
 * était, « Reprendre l'envoi » repart de là sans doublon. Une fois tout envoyé, la page est relue (date d'envoi).
 */
export function IssueSender({ issueId, subject, initial }: { issueId: string; subject: string; initial: Progress }) {
  const t = useTranslations("admin.newsletter");
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<BatchResult["stopped"]>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function run() {
    setRunning(true);
    setStopped(undefined);
    let current = progress;
    let result: BatchResult;
    do {
      try {
        result = await sendIssueBatch(issueId);
      } catch {
        // Réseau coupé, session expirée : la base n'a rien perdu, on s'arrête comme sur un refus.
        result = { sent: 0, remaining: current.remaining, stopped: "error" };
      }
      if (!alive.current) return;
      // Un arrêt imprévu ne connaît pas le reste : on garde le dernier compte.
      const remaining = result.stopped === "error" && result.sent === 0 ? current.remaining : result.remaining;
      current = { delivered: current.delivered + result.sent, attempted: current.attempted + result.sent, remaining };
      setProgress(current);
    } while (!result.stopped && result.remaining > 0 && alive.current);
    setRunning(false);
    setStopped(result.stopped);
    if (!result.stopped && result.remaining === 0) router.refresh();
  }

  const total = progress.attempted + progress.remaining;
  const started = progress.attempted > 0;
  const finished = !running && !stopped && started && progress.remaining === 0;
  const message = stopped === "quota" ? t("stoppedQuota") : stopped === "error" ? t("stoppedError") : running ? t("sending") : started && !finished ? t("paused") : null;

  if (!started && !running && progress.remaining === 0) return <p className="text-sm text-muted-foreground">{t("noRecipients")}</p>;

  return (
    <div className="grid gap-4">
      {(started || running) && (
        <div className="grid gap-2">
          <p className="text-sm font-medium tabular-nums" role="status">
            {t("progress", { sent: progress.delivered, total })}
          </p>
          <div role="progressbar" aria-label={t("sendTitle")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={progress.delivered} className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${total ? (progress.delivered / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {message && (
        <p role={stopped ? "alert" : undefined} className={stopped ? "rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-warning" : "text-[0.8125rem] text-muted-foreground"}>
          {message}
        </p>
      )}
      {running ? null : started ? (
        progress.remaining > 0 && (
          <Button type="button" size="md" className="w-full" onClick={run}>
            <Send aria-hidden />
            {t("resume")}
          </Button>
        )
      ) : (
        <ConfirmAction
          action={async () => {
            void run();
            return { ok: true, message: t("sendStarted") };
          }}
          title={t("sendConfirmTitle", { subject })}
          description={t("sendConfirmDescription", { count: progress.remaining })}
          confirmLabel={t("sendConfirm")}
          variant="default"
          size="md"
          danger={false}
          className="w-full"
        >
          <Send aria-hidden />
          {t("sendButton", { count: progress.remaining })}
        </ConfirmAction>
      )}
    </div>
  );
}
