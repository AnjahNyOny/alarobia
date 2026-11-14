import { notFound } from "next/navigation";

/** Toute adresse inconnue affiche la page 404 de la boutique, dans la langue du visiteur. */
export default function CatchAll() {
  notFound();
}
