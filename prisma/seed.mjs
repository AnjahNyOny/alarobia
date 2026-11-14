import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const img = (name) => `/products/${name}.jpg`;

const categories = [
  { slug: "maison", name: "Maison", description: "Mobilier, luminaires et objets pour un intérieur qui dure.", image: img("canape") },
  { slug: "mode", name: "Mode", description: "Des pièces simples, bien coupées, faites pour être portées longtemps.", image: img("veste") },
  { slug: "accessoires", name: "Accessoires", description: "Sacs, montres et lunettes : les détails qui font la différence.", image: img("montre-3") },
  { slug: "tech", name: "Tech & audio", description: "Du son juste et des outils fiables, sans gadgets superflus.", image: img("casque-2") },
  { slug: "table", name: "Table & bien-être", description: "Café, thé et petits rituels du quotidien.", image: img("the") },
];

// [catégorie, nom, accroche, prix €, prix barré €, stock, vedette, images, description, caractéristiques]
const products = [
  ["maison", "Canapé Alba en velours", "Trois places, assise profonde", 1290, null, 6, true, ["canape"], "Un canapé trois places à l'assise généreuse, habillé d'un velours côtelé vert sapin. Sa structure en hêtre massif et ses coussins à mémoire de forme en font une pièce pensée pour durer.", "Structure en hêtre massif\nVelours 100 % coton, traité anti-taches\nL 210 × P 92 × H 78 cm\nLivré monté, sur rendez-vous"],
  ["maison", "Canapé Dune en lin lavé", "Modulable, housse déhoussable", 1490, 1690, 3, false, ["canape-lin", "interieur"], "Des lignes basses, un lin lavé au toucher souple et une housse entièrement déhoussable. Le Dune s'installe au centre du salon et s'y fait vite oublier.", "Lin lavé européen\nHousse lavable à 30 °C\nL 230 × P 98 × H 72 cm\nGarantie 5 ans sur la structure"],
  ["maison", "Fauteuil Margaux capitonné", "Bouclette écrue, pieds tournés", 420, null, 8, true, ["fauteuil"], "Un petit fauteuil d'appoint au dossier capitonné, recouvert d'une bouclette écrue. Ses pieds tournés en hêtre laqué lui donnent une allure discrètement rétro.", "Bouclette laine et coton\nPieds en hêtre laqué\nL 68 × P 70 × H 80 cm"],
  ["maison", "Tabouret haut Oslo", "Coque noire, piètement chêne", 149, null, 24, false, ["chaise"], "Coque moulée mate, piètement en chêne massif et repose-pieds en acier : un tabouret de bar stable et léger, à l'aise autour d'un îlot comme d'un plan de travail.", "Hauteur d'assise 65 cm\nPiètement chêne massif\nPatins anti-rayures fournis"],
  ["maison", "Lampadaire Atelier", "Acier laqué gris, tête orientable", 189, 229, 14, false, ["lampe"], "Inspiré des lampes d'atelier, ce lampadaire en acier laqué diffuse une lumière franche et se règle d'un geste grâce à sa tête orientable.", "Acier laqué mat\nHauteur 155 cm\nDouille E27, ampoule LED fournie\nInterrupteur au pied"],
  ["maison", "Bougie Veillée", "Cèdre, ambre et fève tonka", 34, null, 60, true, ["bougie"], "Une bougie coulée à la main dans un verre fumé. Notes boisées de cèdre, fond chaud d'ambre et de fève tonka. Environ cinquante heures de combustion.", "Cire végétale de soja et colza\nMèche 100 % coton\n220 g, environ 50 h\nFabriquée en France"],
  ["maison", "Aloès en pot céramique", "Plante et cache-pot menthe", 29, null, 4, false, ["plante"], "Un aloès robuste livré dans son cache-pot en céramique émaillée. Peu d'arrosage, beaucoup de lumière : la plante idéale pour débuter.", "Cache-pot Ø 14 cm\nArrosage toutes les 2 à 3 semaines\nLumière vive, sans soleil direct"],

  ["mode", "T-shirt Essentiel blanc", "Coton biologique 190 g", 35, null, 120, true, ["tshirt-2"], "La coupe droite que l'on cherche toujours : un jersey de coton biologique dense, un col rond qui ne se détend pas et des coutures renforcées.", "100 % coton biologique, 190 g/m²\nCoupe droite\nLavage à 30 °C\nConfectionné au Portugal"],
  ["mode", "T-shirt Atelier noir", "Sérigraphie poitrine, coupe ample", 39, null, 75, false, ["tshirt-1"], "Un jersey épais teint en noir profond, sérigraphié à la main sur la poitrine. Coupe légèrement ample, épaules tombantes.", "100 % coton peigné, 220 g/m²\nSérigraphie à l'eau\nCoupe ample"],
  ["mode", "Perfecto Sully en cuir", "Cuir d'agneau pleine fleur", 389, 459, 9, true, ["veste"], "Le perfecto dans sa version la plus juste : cuir d'agneau pleine fleur, fermeture asymétrique et doublure en viscose. Il se patine et s'assouplit au fil des années.", "Cuir d'agneau pleine fleur\nDoublure 100 % viscose\nFermetures métal nickelé\nEntretien par un spécialiste du cuir"],
  ["mode", "Richelieu Lucien en suède", "Suède vert, semelle gomme", 185, null, 18, false, ["chaussures-1"], "Un richelieu à bout fleuri en veau velours vert sauge, monté sur une semelle gomme souple. Élégant sans être guindé.", "Tige en veau velours\nDoublure cuir\nSemelle gomme cousue\nDu 39 au 46"],
  ["mode", "Baskets Tempo grises", "Maille respirante, amorti léger", 119, null, 32, false, ["sneakers-1"], "Une tige en maille technique d'une seule pièce et une semelle à amorti progressif : une basket de tous les jours, aussi légère qu'elle en a l'air.", "Tige en maille recyclée\nSemelle EVA\n240 g par chaussure (taille 42)"],
  ["mode", "Baskets Riviera bordeaux", "Toile et daim, semelle vulcanisée", 79, 95, 0, false, ["sneakers-2"], "Toile épaisse, renforts en daim et semelle vulcanisée : une basse classique, dans un bordeaux qui va avec tout.", "Toile de coton et croûte de cuir\nSemelle caoutchouc vulcanisée\nDu 36 au 46"],

  ["accessoires", "Sac panier Capucine", "Osier tressé et cuir naturel", 245, null, 7, true, ["sac-2"], "Un sac à main en osier tressé à la main, fermé par un rabat en cuir à tannage végétal. Bandoulière amovible fournie.", "Osier naturel tressé main\nCuir à tannage végétal\nL 26 × H 20 × P 12 cm\nBandoulière amovible"],
  ["accessoires", "Sac à dos Transit", "Toile enduite, 18 litres", 95, null, 40, false, ["sac-dos"], "Compartiment ordinateur rembourré, poche frontale zippée et dos matelassé : le sac à dos des trajets quotidiens, en toile enduite déperlante.", "Toile enduite déperlante\nCompartiment ordinateur 15 pouces\n18 litres, 620 g"],
  ["accessoires", "Portefeuille Marius", "Cuir pleine fleur, six cartes", 69, null, 55, false, ["portefeuille"], "Un portefeuille compact en cuir pleine fleur, cousu au fil de lin. Six emplacements pour cartes, un compartiment à billets.", "Cuir de vachette pleine fleur\nCouture au fil de lin ciré\n11 × 9 cm fermé"],
  ["accessoires", "Lunettes Sorrente", "Monture dorée, verres verts", 129, null, 22, true, ["lunettes-2"], "Une monture ronde en métal doré, fine et légère, équipée de verres minéraux verts de catégorie 3.", "Monture acier inoxydable\nVerres minéraux catégorie 3\nProtection UV 100 %\nÉtui rigide fourni"],
  ["accessoires", "Lunettes Brando", "Acétate noir, verres polarisés", 115, null, 3, false, ["lunettes-1"], "La forme trapèze intemporelle, taillée dans un acétate noir poli à la main. Verres polarisés anti-reflets.", "Acétate de cellulose\nVerres polarisés catégorie 3\nCharnières à cinq tenons"],
  ["accessoires", "Montre Lisière 36", "Cadran blanc, bracelet taupe", 165, null, 16, true, ["montre-3"], "Un cadran blanc épuré, un boîtier or rose de 36 mm et un bracelet en cuir nubuck taupe. Mouvement à quartz japonais.", "Boîtier acier 36 mm, épaisseur 7 mm\nVerre minéral bombé\nMouvement quartz japonais\nÉtanche 3 ATM"],
  ["accessoires", "Montre Horizon blanche", "Minimaliste, bracelet silicone", 139, 169, 11, false, ["montre-1"], "Boîtier en polycarbonate mat, cadran sombre sans index et bracelet en silicone souple. Une montre que l'on oublie au poignet.", "Boîtier 40 mm\nBracelet silicone hypoallergénique\nÉtanche 5 ATM"],
  ["accessoires", "Montre Méridien noire", "Cadran noir, aiguille jaune", 210, null, 5, false, ["montre-2"], "Lisibilité avant tout : chiffres blancs sur cadran noir mat, trotteuse jaune et bracelet en maille milanaise.", "Boîtier acier PVD noir 38 mm\nVerre saphir\nMouvement quartz suisse\nÉtanche 5 ATM"],

  ["tech", "Casque Studio One", "Sans fil, réduction de bruit", 249, 299, 20, true, ["casque-1"], "Réduction de bruit active, trente heures d'autonomie et coussinets à mémoire de forme. Un casque fermé au rendu équilibré, pour le bureau comme pour le train.", "Bluetooth 5.3 multipoint\nRéduction de bruit active\nAutonomie 30 h, charge rapide USB-C\n260 g"],
  ["tech", "Casque Mono filaire", "Monitoring, câble détachable", 89, null, 28, false, ["casque-2"], "Un casque de monitoring filaire au son neutre et détaillé. Arceau en acier, câble détachable et coussinets remplaçables.", "Transducteurs 40 mm\nImpédance 32 Ω\nCâble détachable 1,5 m, jack 3,5 mm"],
  ["tech", "Écouteurs Pulse", "True wireless, boîtier de charge", 129, null, 45, true, ["ecouteurs"], "Des écouteurs intra-auriculaires sans fil avec réduction de bruit, six heures d'écoute et trois recharges dans le boîtier.", "Bluetooth 5.3\nAutonomie 6 h + 18 h avec boîtier\nRésistance à l'eau IPX4\nTrois tailles d'embouts"],
  ["tech", "Clavier Frappe", "Sans fil, aluminium, AZERTY", 99, null, 2, false, ["clavier"], "Un clavier compact en aluminium, à touches ciseaux silencieuses. Se connecte à trois appareils et tient un mois sur une charge.", "Disposition AZERTY\nBluetooth, trois appareils\nAutonomie un mois, recharge USB-C"],
  ["tech", "Montre connectée Tempo", "GPS, cardio, écran OLED", 279, null, 13, false, ["montre-co"], "Suivi d'activité, GPS intégré et notifications sur un écran OLED toujours lisible. Cinq jours d'autonomie.", "Écran OLED 1,4 pouce\nGPS et capteur cardiaque\nAutonomie 5 jours\nÉtanche 5 ATM"],

  ["table", "Café en grains Sidamo", "Éthiopie, torréfaction artisanale", 14.5, null, 90, true, ["cafe"], "Un arabica d'altitude d'Éthiopie, torréfié en petites quantités. En tasse : des notes de fruits rouges, de cacao et une acidité douce.", "100 % arabica, région de Sidamo\nTorréfaction moyenne\nSachet de 250 g à valve fraîcheur"],
  ["table", "Thé noir Matinée", "Assam et Ceylan, boîte de 100 g", 12, null, 70, false, ["the"], "Un mélange corsé de thés noirs d'Assam et de Ceylan, à boire nature ou avec un nuage de lait.", "Thé noir en feuilles entières\nInfusion 4 minutes à 95 °C\nBoîte métal de 100 g"],
  ["table", "Mug Galet en grès", "Émail blanc mat, 30 cl", 18, null, 85, false, ["mug"], "Un mug en grès tourné, émaillé blanc mat. Sa forme arrondie tient bien en main et garde la chaleur.", "Grès émaillé, 30 cl\nCompatible lave-vaisselle et micro-ondes\nFabriqué au Portugal"],
  ["table", "Gourde isotherme Forêt", "Inox double paroi, 50 cl", 32, null, 48, true, ["gourde"], "Douze heures au chaud, vingt-quatre au frais. Une gourde en inox à double paroi, finition mate antidérapante.", "Inox 18/8 double paroi\n50 cl, bouchon étanche\nSans BPA"],
  ["table", "Sérum Éclat à la vitamine C", "Flacon ambré de 30 ml", 42, null, 36, false, ["soin-1"], "Un sérum léger concentré en vitamine C stabilisée et en acide hyaluronique, pour un teint plus lumineux en quelques semaines.", "Vitamine C stabilisée à 10 %\nSans parfum, tous types de peau\nFlacon verre ambré 30 ml\nFabriqué en France"],
];

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Générateur déterministe : le jeu de démonstration est identique à chaque exécution.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function main() {
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.review.deleteMany();
  await db.wishlistItem.deleteMany();
  await db.productImage.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.promoCode.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.newsletterSubscriber.deleteMany();
  await db.storeSettings.deleteMany();
  await db.storeSettings.create({ data: { id: 1 } });

  const adminHash = await bcrypt.hash("admin1234", 10);
  const clientHash = await bcrypt.hash("client1234", 10);
  await db.user.create({ data: { email: "admin@seve.example", name: "Administration", role: "ADMIN", passwordHash: adminHash } });

  const customerSeeds = [
    ["client@seve.example", "Camille Roux", "12 rue des Lilas", "69003", "Lyon"],
    ["julien.morel@example.com", "Julien Morel", "4 place du Marché", "33000", "Bordeaux"],
    ["ines.benali@example.com", "Inès Benali", "27 avenue Jean Jaurès", "75019", "Paris"],
    ["thomas.girard@example.com", "Thomas Girard", "8 chemin des Vignes", "44000", "Nantes"],
    ["lea.fontaine@example.com", "Léa Fontaine", "15 rue de la Paix", "67000", "Strasbourg"],
    ["hugo.lambert@example.com", "Hugo Lambert", "3 impasse du Port", "13007", "Marseille"],
    ["sarah.petit@example.com", "Sarah Petit", "41 boulevard Carnot", "31000", "Toulouse"],
    ["nicolas.faure@example.com", "Nicolas Faure", "19 rue Nationale", "59800", "Lille"],
  ];
  const customers = [];
  for (const [email, name, line1, postalCode, city] of customerSeeds) {
    customers.push(
      await db.user.create({
        data: {
          email, name, passwordHash: clientHash, phone: "06 12 34 56 78",
          createdAt: new Date(Date.now() - (20 + Math.floor(rand() * 70)) * 864e5),
          address: { create: { fullName: name, line1, postalCode, city, country: "France", phone: "06 12 34 56 78" } },
        },
        include: { address: true },
      })
    );
  }

  const cats = {};
  for (const [i, c] of categories.entries()) cats[c.slug] = await db.category.create({ data: { ...c, position: i } });

  const created = [];
  for (const [i, [cat, name, tagline, price, compare, stock, featured, images, description, details]] of products.entries()) {
    created.push(
      await db.product.create({
        data: {
          name, tagline, description, details, stock, featured,
          slug: slugify(name),
          sku: `SV-${cat.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
          priceCents: Math.round(price * 100),
          compareAtCents: compare ? Math.round(compare * 100) : null,
          categoryId: cats[cat].id,
          createdAt: new Date(Date.now() - (products.length - i) * 2 * 864e5),
          images: { create: images.map((n, position) => ({ url: img(n), position })) },
        },
        include: { images: true },
      })
    );
  }

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

  await db.promoCode.createMany({
    data: [
      { code: "BIENVENUE10", type: "PERCENT", value: 10 },
      { code: "MAISON20", type: "FIXED", value: 2000, minSubtotalCents: 15000, maxUses: 100 },
      { code: "ETE2025", type: "PERCENT", value: 15, expiresAt: new Date("2025-09-01"), active: false },
    ],
  });

  // Commandes réparties sur 60 jours, pour alimenter le tableau de bord.
  const affordable = created.filter((p) => p.priceCents < 50000);
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
      const express = rand() < 0.2;
      const shippingCents = express ? 990 : subtotalCents - discountCents >= 8000 ? 0 : 490;
      const r = rand();
      const status =
        day === 0 ? pick(["PENDING", "PAID"]) : day < 3 ? pick(["PAID", "PAID", "SHIPPED"]) : day < 7 ? pick(["SHIPPED", "DELIVERED"]) : r < 0.06 ? "CANCELLED" : r < 0.1 ? "REFUNDED" : "DELIVERED";
      const createdAt = new Date(Date.now() - day * 864e5 - Math.floor(rand() * 10) * 36e5);
      const a = user.address;
      await db.order.create({
        data: {
          number: `SV-${++seq}`, userId: user.id, email: user.email, status,
          paymentMethod: rand() < 0.85 ? "CARD" : "COD",
          shippingMethod: express ? "EXPRESS" : "STANDARD",
          subtotalCents, discountCents, shippingCents, totalCents: subtotalCents - discountCents + shippingCents,
          promoCode: usePromo ? "BIENVENUE10" : null,
          fullName: a.fullName, line1: a.line1, postalCode: a.postalCode, city: a.city, country: a.country, phone: a.phone,
          trackingNumber: ["SHIPPED", "DELIVERED"].includes(status) ? `6A${Math.floor(1e10 + rand() * 9e10)}` : null,
          createdAt, updatedAt: createdAt,
          items: { create: items },
        },
      });
    }
  }

  console.log(`Base initialisée : ${created.length} produits, ${customers.length} clients, ${seq - 1000} commandes.`);
}

main().finally(() => db.$disconnect());
