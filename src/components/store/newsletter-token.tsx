"use client";

import { useActionState, useEffect, useRef } from "react";
import { confirmNewsletter, unsubscribeNewsletter } from "@/actions/newsletter";
import { Form, SubmitButton } from "@/components/form";

const ACTIONS = { confirm: confirmNewsletter, unsubscribe: unsubscribeNewsletter };

/** Issue déjà connue à l'ouverture de la page (adresse déjà confirmée, lien inconnu), ou `null` : le bouton est proposé. */
export type TokenOutcome = "done" | "invalid" | null;

/** Titre et phrase de chaque état, traduits par la page serveur : l'espace `newsletter` ne part pas avec chaque page du site. */
export type TokenTexts = { title: string; text: string; button: string; doneTitle: string; doneText: string; invalidTitle: string; invalidText: string };

/**
 * Page ouverte depuis un e-mail de la lettre d'information : un titre, une phrase, un seul bouton. La page ne fait rien
 * d'elle-même (un antivirus de messagerie l'ouvre aussi) ; le bouton envoie l'action, puis le titre et la phrase disent
 * ce qui a été fait, et `children` (le lien de retour) apparaît. Le focus passe sur le titre pour qu'un lecteur d'écran
 * annonce le résultat.
 */
export function NewsletterTokenAction({ kind, token, texts, settled = null, children }: { kind: keyof typeof ACTIONS; token: string; texts: TokenTexts; settled?: TokenOutcome; children: React.ReactNode }) {
  const [state, action] = useActionState(ACTIONS[kind], {});
  const heading = useRef<HTMLHeadingElement>(null);
  const outcome: TokenOutcome = state.ok ? "done" : state.error ? "invalid" : settled;

  useEffect(() => {
    if (state.ok || state.error) heading.current?.focus();
  }, [state]);

  return (
    <>
      <h1 ref={heading} tabIndex={-1} className="display text-4xl outline-none md:text-5xl">
        {outcome === "done" ? texts.doneTitle : outcome === "invalid" ? texts.invalidTitle : texts.title}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">{outcome === "done" ? texts.doneText : outcome === "invalid" ? texts.invalidText : texts.text}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        {outcome ? (
          children
        ) : (
          <Form action={action}>
            <input type="hidden" name="token" value={token} />
            <SubmitButton>{texts.button}</SubmitButton>
          </Form>
        )}
      </div>
    </>
  );
}
