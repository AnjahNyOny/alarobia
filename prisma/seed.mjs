import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { customers as customerSeeds, promoCodes, settings, shippingZones } from "./catalog.mjs";
import { writeCatalog, writeShippingZones } from "./write-catalog.mjs";

const db = new PrismaClient();

// Même règle que src/lib/shipping.ts : jours ouvrés, pas de livraison le dimanche.
function addBusinessDays(from, days) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let left = days; left > 0; ) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) left--;
  }
  return date;
}

// Générateur déterministe : le jeu de démonstration est identique à chaque exécution.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function main() {
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.review.deleteMany();
  await db.wishlistItem.deleteMany();
  await db.productTranslation.deleteMany();
  await db.categoryTranslation.deleteMany();
  await db.productImage.deleteMany();
  await db.customization.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.promoCode.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  await db.shippingZone.deleteMany();
  await db.storeSettings.deleteMany();
  await db.storeSettings.create({ data: { id: 1, ...settings } });
  await writeShippingZones(db);

  const adminHash = await bcrypt.hash("admin1234", 10);
  const clientHash = await bcrypt.hash("client1234", 10);
  await db.user.create({ data: { email: "admin@alarobia.example", name: "Administration", role: "ADMIN", passwordHash: adminHash } });

  const customers = [];
  for (const { email, name, phone, zone, ...address } of customerSeeds) {
    customers.push(
      await db.user.create({
        data: {
          email, name, phone, passwordHash: clientHash,
          createdAt: new Date(Date.now() - (20 + Math.floor(rand() * 70)) * 864e5),
          address: { create: { fullName: name, phone, ...address } },
        },
        include: { address: true },
      })
    );
    customers.at(-1).zone = shippingZones[zone];
  }

  // Rayons et produits, partagés avec init-production.mjs. Aucun tirage de rand() dedans : la suite des tirages
  // (avis, commandes) reste la même.
  const created = await writeCatalog(db);

  const comments = [
    [5, "Conforme à la description, la qualité est au rendez-vous. Livraison rapide et colis soigné."],
    [5, "Très bel objet, encore mieux en vrai que sur les photos. Je recommande."],
    [4, "Bon produit, finitions soignées. Une étoile en moins pour le délai de livraison un peu long."],
    [5, "Acheté pour offrir, tout le monde a été ravi. Je reviendrai."],
    [4, "Très satisfait dans l'ensemble, le rapport qualité-prix est bon."],
    [3, "Correct, mais je m'attendais à une matière un peu plus épaisse."],
    [5, "Deuxième commande et toujours aussi content. Service client réactif."],
  ];
  for (const p of created) {
    const n = Math.floor(rand() * 5);
    const reviewers = [...customers].sort(() => rand() - 0.5).slice(0, n);
    const texts = [...comments].sort(() => rand() - 0.5);
    for (const [k, u] of reviewers.entries()) {
      const [rating, comment] = texts[k];
      await db.review.create({
        data: { productId: p.id, userId: u.id, rating, comment, createdAt: new Date(Date.now() - Math.floor(rand() * 40) * 864e5) },
      });
    }
  }

  await db.promoCode.createMany({ data: promoCodes });

  // Commandes réparties sur 60 jours, pour alimenter le tableau de bord.
  const affordable = created.filter((p) => p.stock > 0 && p.priceCents <= 500_000 * 100);
  let seq = 1000;
  for (let day = 59; day >= 0; day--) {
    const perDay = Math.floor(rand() * 3) + (day % 7 < 2 ? 1 : 0);
    for (let k = 0; k < perDay; k++) {
      const user = pick(customers);
      const lines = [...affordable].sort(() => rand() - 0.5).slice(0, 1 + Math.floor(rand() * 3));
      const items = lines.map((p) => ({
        productId: p.id, name: p.name, imageUrl: p.images[0]?.url, priceCents: p.priceCents, quantity: 1 + (rand() < 0.2 ? 1 : 0),
      }));
      const subtotalCents = items.reduce((s, it) => s + it.priceCents * it.quantity, 0);
      const usePromo = rand() < 0.15;
      const discountCents = usePromo ? Math.round(subtotalCents * 0.1) : 0;
      const zone = user.zone;
      const shippingCents = subtotalCents - discountCents >= settings.freeShippingThresholdCents ? 0 : zone.priceCents;
      const r = rand();
      const status =
        day === 0 ? pick(["PENDING", "PAID"]) : day < 3 ? pick(["PAID", "PAID", "SHIPPED"]) : day < 7 ? pick(["SHIPPED", "DELIVERED"]) : r < 0.06 ? "CANCELLED" : r < 0.1 ? "REFUNDED" : "DELIVERED";
      const createdAt = new Date(Date.now() - day * 864e5 - Math.floor(rand() * 10) * 36e5);
      // Mobile Money pour quatre commandes sur cinq. Une commande encore « en attente » a parfois déjà sa référence (à vérifier), parfois non.
      const p = rand();
      const paymentMethod = p < 0.5 ? "MVOLA" : p < 0.7 ? "ORANGE_MONEY" : p < 0.8 ? "AIRTEL_MONEY" : "COD";
      const mobile = paymentMethod !== "COD";
      const paymentReference = mobile && status !== "CANCELLED" && (status !== "PENDING" || rand() < 0.5) ? `${Math.floor(1e9 + rand() * 9e9)}` : null;
      // Une commande payée à la livraison n'est jamais « payée » avant d'être livrée.
      const shownStatus = !mobile && status === "PAID" ? "PENDING" : status;
      const a = user.address;
      await db.order.create({
        data: {
          number: `AL-${++seq}`, userId: user.id, email: user.email, status: shownStatus,
          paymentMethod, paymentReference,
          paymentDeclaredAt: paymentReference ? new Date(createdAt.getTime() + 20 * 60e3) : null,
          paidAt: !mobile && status === "DELIVERED" ? addBusinessDays(createdAt, zone.maxDays) : mobile && ["PAID", "SHIPPED", "DELIVERED", "REFUNDED"].includes(status) ? new Date(createdAt.getTime() + 3 * 36e5) : null,
          shippingZone: zone.name, estimatedDelivery: addBusinessDays(createdAt, zone.maxDays),
          subtotalCents, discountCents, shippingCents, totalCents: subtotalCents - discountCents + shippingCents,
          promoCode: usePromo ? "BIENVENUE10" : null,
          fullName: a.fullName, line1: a.line1, line2: a.line2, district: a.district, postalCode: a.postalCode, city: a.city, province: a.province, country: a.country, phone: a.phone,
          trackingNumber: ["SHIPPED", "DELIVERED"].includes(status) ? `MG${Math.floor(1e8 + rand() * 9e8)}` : null,
          createdAt, updatedAt: createdAt,
          items: { create: items },
        },
      });
    }
  }

  console.log(`Base initialisée : ${created.length} produits, ${customers.length} clients, ${seq - 1000} commandes.`);
}

main().finally(() => db.$disconnect());
