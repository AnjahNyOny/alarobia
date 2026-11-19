// Données de départ de la base de production, à lancer une seule fois, à la main, après la première mise en ligne
// (les migrations ont créé les tables, vides) :
//
//   node --env-file=.env.secrets.local prisma/init-production.mjs
//
// `.env.secrets.local` (ignoré par git, et que Next ne charge pas) donne DATABASE_URL_UNPOOLED (adresse directe de
// Neon) ou, à défaut, DATABASE_URL, ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères au moins). Le script prend l'adresse
// directe quand elle est là : DATABASE_URL y est l'adresse regroupée, qui passe par PgBouncer. Il affiche l'hôte et la
// base visés, sans identifiants, avant de s'y connecter.
//
// Crée : les réglages de la boutique, sans numéro Mobile Money (seul le paiement à la livraison est proposé tant que
// le vendeur n'a pas saisi les siens dans le back-office) et avec ADMIN_EMAIL comme adresse de contact ; les zones de
// livraison ; les rayons et les produits de catalog.mjs (traductions, photos, personnalisation), tous en brouillon sauf
// la tasse personnalisable ; le compte administrateur.
// Ne crée rien d'autre : ni client, ni avis (jamais de faux avis sur une vraie boutique), ni commande, ni code promo,
// ni abonné. Refuse de tourner si la base contient déjà un utilisateur, un produit ou une commande.
import { z } from "zod";
import { categories, settings, shippingZones } from "./catalog.mjs";
import { onlyOnline, writeCatalog, writeShippingZones } from "./write-catalog.mjs";

// Seul produit mis en ligne : la tasse personnalisable, qui sert au contrôle de la mise en ligne (envoi d'une image sur
// sa fiche, PLAN.md 7.5). Les autres produits de démonstration arrivent en brouillon : le vendeur les corrige
// (prix, stock, photos) et les met en ligne lui-même depuis le back-office. Décision du propriétaire, 19/11/2026.
const ONLINE_PRODUCT = "tasse-en-gres-vato";

/** Réglages lus dans l'environnement, ou le message qui dit ce qui manque. */
function readConfig(env) {
  // Vérifiée avant de créer le client Prisma, à qui elle est passée explicitement : sans elle, Prisma lirait le fichier
  // .env du projet et écrirait dans la base de développement.
  const variable = env.DATABASE_URL_UNPOOLED ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL";
  const databaseUrl = env[variable];
  if (!databaseUrl) return { error: "DATABASE_URL_UNPOOLED et DATABASE_URL manquantes. Mettre l'adresse directe de la base Neon dans .env.secrets.local." };
  let target;
  try {
    const { host, pathname } = new URL(databaseUrl);
    // Hôte et base visés, sans identifiants : le propriétaire voit où il écrit.
    target = `${host}${pathname}`;
  } catch {
    return { error: `${variable} invalide : attendu postgresql://utilisateur:mot-de-passe@hôte/base.` };
  }
  const email = z.string().trim().toLowerCase().pipe(z.email()).safeParse(env.ADMIN_EMAIL ?? "");
  if (!email.success) return { error: "ADMIN_EMAIL manquante ou invalide : l'adresse e-mail du compte administrateur, dans .env.secrets.local." };
  const password = env.ADMIN_PASSWORD ?? "";
  if (password.length < 12) return { error: "ADMIN_PASSWORD manquant ou trop court : 12 caractères au moins, dans .env.secrets.local." };
  let status;
  try {
    status = onlyOnline(ONLINE_PRODUCT);
  } catch (error) {
    return { error: error.message };
  }
  return { databaseUrl, variable, target, email: email.data, password, status };
}

async function main() {
  const config = readConfig(process.env);
  if (config.error) {
    console.error(`init-production : ${config.error}`);
    return 1;
  }
  const { databaseUrl, variable, target, email, password, status } = config;
  console.log(`Base visée : ${target} (${variable}).`);

  const { PrismaClient } = await import("@prisma/client");
  const { default: bcrypt } = await import("bcryptjs");
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const [users, products, orders] = await Promise.all([db.user.count(), db.product.count(), db.order.count()]);
    if (users + products + orders > 0) {
      console.error(
        `init-production : la base ${target} n'est pas vide (${users} utilisateur(s), ${products} produit(s), ${orders} commande(s)). ` +
          "Ce script ne sert qu'une fois, sur une base neuve : rien n'a été modifié.",
      );
      return 1;
    }

    // Coût 12, comme les comptes créés sur le site (src/actions/auth.ts) ; le seed de démonstration se contente de 10.
    const passwordHash = await bcrypt.hash(password, 12);
    // Une seule transaction : en cas d'échec à mi-chemin (connexion coupée), la base reste vide et le script peut être
    // relancé. Délai large : depuis Madagascar, chaque requête traverse l'océan jusqu'à la base.
    const created = await db.$transaction(
      async (tx) => {
        // `upsert` et non `create` : la première page affichée du site en ligne crée déjà la ligne de réglages, avec les
        // valeurs par défaut (getSettings, src/lib/settings.ts). Personne n'a pu la modifier (aucun compte administrateur
        // n'existe avant ce script) : on la remplace.
        const storeSettings = { ...settings, mvolaNumber: "", orangeMoneyNumber: "", airtelMoneyNumber: "", contactEmail: email };
        await tx.storeSettings.upsert({ where: { id: 1 }, update: storeSettings, create: { id: 1, ...storeSettings } });
        await writeShippingZones(tx);
        const catalog = await writeCatalog(tx, { status });
        await tx.user.create({ data: { email, name: "Administration", role: "ADMIN", passwordHash } });
        return catalog;
      },
      { maxWait: 30_000, timeout: 300_000 },
    );

    console.log(
      `Base ${target} initialisée : ${categories.length} rayons, ${created.length} produits (en ligne : ${ONLINE_PRODUCT} ; les autres en brouillon), ` +
        `${shippingZones.length} zones de livraison, compte administrateur ${email}.`,
    );
    console.log("Paiement à la livraison seulement : saisir les numéros Mobile Money dans le back-office (Réglages) pour les proposer.");
    return 0;
  } catch (error) {
    console.error(`init-production : échec sur ${target}, rien n'a été écrit (transaction annulée).`);
    console.error(error);
    return 1;
  } finally {
    await db.$disconnect();
  }
}

process.exitCode = await main();
