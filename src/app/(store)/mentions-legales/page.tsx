import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Mentions légales et CGV" };

export default async function LegalPage() {
  const s = await getSettings();
  const sections = [
    ["Éditeur du site", `${s.storeName}. Raison sociale, forme juridique, adresse du siège, numéro d'immatriculation et directeur de la publication : à compléter avant la mise en ligne.`],
    ["Hébergement", "Nom et adresse de l'hébergeur : à compléter avant la mise en ligne."],
    ["Conditions générales de vente", "Les prix sont indiqués toutes taxes comprises, hors frais de livraison. La vente est conclue à la confirmation de la commande. Conformément au droit de la consommation, vous disposez d'un délai de rétractation ; nous l'étendons à 30 jours à compter de la réception."],
    ["Données personnelles", `Les informations collectées servent uniquement au traitement de vos commandes et, si vous y avez consenti, à l'envoi de notre lettre d'information. Vous pouvez demander l'accès, la rectification ou la suppression de vos données à ${s.contactEmail}.`],
    ["Cookies", "Ce site n'utilise que des cookies strictement nécessaires : votre session et votre panier. Aucun traceur publicitaire n'est déposé."],
  ];
  return (
    <div className="container-page pt-10 md:pt-16">
      <div className="max-w-3xl">
        <h1 className="display text-5xl">Mentions légales et CGV</h1>
        <p className="mt-5 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Modèle à faire relire et compléter par un professionnel du droit avant toute mise en ligne commerciale.</p>
        {sections.map(([title, text]) => (
          <section key={title} className="mt-10">
            <h2 className="text-xl font-medium">{title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
