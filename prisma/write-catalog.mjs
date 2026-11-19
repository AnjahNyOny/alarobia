// Écriture en base du catalogue de `catalog.mjs` : zones de livraison, rayons et produits (traductions, photos,
// réglages de personnalisation). Partagée par `seed.mjs` (démonstration) et `init-production.mjs` (première mise
// en ligne), qui écrivent ainsi le même catalogue sans le recopier.
//
// Aucun tirage pseudo-aléatoire ici : la suite des tirages de `seed.mjs` (clients, avis, commandes) n'en dépend pas,
// et le jeu de démonstration reste identique d'un chargement à l'autre.
import { categories, products, shippingZones } from "./catalog.mjs";

const img = (name) => `/products/${name}.jpg`;

// Même règle que `slugify` de src/lib/format.ts (demo-catalog.test.ts vérifie que les adresses sont uniques).
const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Une ligne de traduction par langue supplémentaire ; un champ absent reste vide et retombe sur le français.
const translations = (record, fields) => ({
  create: ["en", "mg"].map((locale) => ({ locale, ...Object.fromEntries(fields.map((f) => [f, record[locale]?.[f] ?? ""])) })),
});

/** Zones de livraison, dans l'ordre de `catalog.mjs` (la première sert d'exemple sur l'accueil). */
export async function writeShippingZones(db) {
  await db.shippingZone.createMany({ data: shippingZones.map((z, position) => ({ ...z, position })) });
}

/**
 * Choix du statut des produits : en ligne (ACTIVE) pour le seul produit dont l'adresse est `slug`, brouillon (DRAFT)
 * pour tous les autres. Échoue si aucun produit du catalogue ne porte cette adresse : un nom changé dans catalog.mjs
 * mettrait sinon tout le catalogue en brouillon sans rien dire.
 */
export function onlyOnline(slug) {
  if (!products.some((p) => slugify(p.name) === slug))
    throw new Error(`aucun produit de prisma/catalog.mjs n'a l'adresse « ${slug} » : le produit à mettre en ligne est introuvable.`);
  return (productSlug) => (productSlug === slug ? "ACTIVE" : "DRAFT");
}

/**
 * Rayons puis produits. Renvoie les produits créés, avec leurs photos, dans l'ordre de `catalog.mjs`.
 * `status(slug)` choisit le statut de chaque produit ; sans lui, le statut par défaut du schéma (ACTIVE, en ligne).
 */
export async function writeCatalog(db, { status } = {}) {
  const cats = {};
  for (const [i, c] of categories.entries())
    cats[c.slug] = await db.category.create({
      data: { slug: c.slug, name: c.name, description: c.description, image: img(c.image), position: i, translations: translations(c, ["name", "description"]) },
    });

  const created = [];
  for (const [i, p] of products.entries()) {
    const slug = slugify(p.name);
    created.push(
      await db.product.create({
        data: {
          name: p.name, tagline: p.tagline, description: p.description, details: p.details, stock: p.stock, featured: p.featured ?? false,
          slug,
          ...(status && { status: status(slug) }),
          sku: `AL-${p.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
          // Montants en unités mineures : 1 Ar = 100.
          priceCents: p.priceAr * 100,
          compareAtCents: p.compareAtAr ? p.compareAtAr * 100 : null,
          categoryId: cats[p.category].id,
          // Dates de création étalées (deux jours d'écart) : l'ordre des nouveautés suit celui du catalogue.
          createdAt: new Date(Date.now() - (products.length - i) * 2 * 864e5),
          ...(p.custom && {
            customTemplate: p.custom.template,
            customColors: p.custom.colors.join(","),
            customTextMax: p.custom.textMax,
            customImage: p.custom.image,
            customSurchargeCents: p.custom.surchargeAr * 100,
          }),
          images: { create: p.images.map((n, position) => ({ url: img(n), position })) },
          translations: translations(p, ["name", "tagline", "description", "details"]),
        },
        include: { images: true },
      })
    );
  }
  return created;
}
