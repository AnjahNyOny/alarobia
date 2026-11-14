"use client";

import { Button } from "@/components/ui/button";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page grid justify-items-center gap-4 py-28 text-center">
      <h1 className="display text-4xl">Un problème est survenu</h1>
      <p className="max-w-sm text-muted-foreground">La page n'a pas pu s'afficher. Réessayez ; si le problème persiste, revenez dans quelques minutes.</p>
      <Button size="md" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
