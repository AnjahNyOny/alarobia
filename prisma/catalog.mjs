// Données de démonstration d'Alarobia : rayons, produits, clients et réglages.
// Fichier de données pur (aucun accès à la base) : `seed.mjs` l'écrit en base et
// `src/lib/__tests__/demo-catalog.test.ts` en vérifie la cohérence.
//
// Prix en ariary entiers (`priceAr`) ; le seed les convertit en unités mineures (× 100).
// Le français est la version de référence. Le malgache est rédigé par Claude et reste
// à relire (voir docs/glossaire.md) ; les caractéristiques (`details`) n'y sont pas
// traduites et retombent sur le français.

export const settings = {
  currency: "MGA",
  announcement: "Livraison offerte dès 150 000 Ar d'achat",
  announcementEn: "Free delivery on orders over Ar 150,000",
  announcementMg: "Fanaterana maimaim-poana raha mividy 150 000 Ar na mihoatra",
  freeShippingThresholdCents: 150_000 * 100,
  // Numéros marchands fictifs : le préfixe correspond au réseau de chaque opérateur.
  mvolaNumber: "034 00 123 45",
  orangeMoneyNumber: "032 00 123 45",
  airtelMoneyNumber: "033 00 123 45",
  mobileMoneyName: "Alarobia",
};

// Zones de livraison, de la plus proche à la plus lointaine. Délais en jours ouvrés (pas de livraison le dimanche).
// La première sert d'exemple sur l'accueil (« Commandé aujourd'hui, livré… »).
export const shippingZones = [
  { name: "Antananarivo ville", nameEn: "Antananarivo city", nameMg: "Antananarivo renivohitra", priceCents: 3_000 * 100, minDays: 1, maxDays: 2 },
  { name: "Environs d'Antananarivo", nameEn: "Around Antananarivo", nameMg: "Manodidina an'Antananarivo", priceCents: 5_000 * 100, minDays: 2, maxDays: 3 },
  { name: "Grandes villes de province", nameEn: "Main provincial towns", nameMg: "Tanàn-dehibe any amin'ny faritany", priceCents: 10_000 * 100, minDays: 3, maxDays: 5 },
  { name: "Autres localités", nameEn: "Other places", nameMg: "Toerana hafa", priceCents: 15_000 * 100, minDays: 5, maxDays: 8 },
];

export const categories = [
  {
    slug: "cuisine", name: "Cuisine", image: "mug",
    description: "Tasses, gourdes et ustensiles qui servent tous les jours.",
    en: { name: "Kitchen", description: "Mugs, bottles and utensils you reach for every day." },
    mg: { name: "Lakozia", description: "Kaopy, tavoahangy ary fitaovana ampiasaina isan'andro." },
  },
  {
    slug: "maison", name: "Maison", image: "fauteuil",
    description: "Meubles, lampes et plantes pour la pièce où l'on vit.",
    en: { name: "Home", description: "Furniture, lamps and plants for the room you live in." },
    mg: { name: "Trano", description: "Fanaka, jiro ary zavamaniry ho an'ny efitra ipetrahana." },
  },
  {
    slug: "vannerie-textile", name: "Vannerie et textile", image: "sac-2",
    description: "Paniers tressés, vêtements, chaussures et sacs.",
    en: { name: "Basketry and textiles", description: "Woven baskets, clothes, shoes and bags." },
    mg: { name: "Rary sy lamba", description: "Harona voarary, akanjo, kiraro ary kitapo." },
  },
  {
    slug: "epicerie", name: "Épicerie", image: "cafe",
    description: "Café et thé pour bien commencer la journée.",
    en: { name: "Pantry", description: "Coffee and tea to start the day well." },
    mg: { name: "Kafe sy dite", description: "Kafe sy dite hanombohana tsara ny andro." },
  },
  {
    slug: "soin", name: "Soin", image: "soin-1",
    description: "De quoi prendre soin de soi et parfumer la maison.",
    en: { name: "Care", description: "Things to look after yourself and scent the house." },
    mg: { name: "Fikarakarana", description: "Entana hikarakarana ny tena sy hampamerovero ny trano." },
  },
  {
    slug: "electronique", name: "Électronique", image: "casque-2",
    description: "Casques, écouteurs, claviers et montres fiables.",
    en: { name: "Electronics", description: "Dependable headphones, earbuds, keyboards and watches." },
    mg: { name: "Elektronika", description: "Casque, écouteur, klavie ary famantaranandro azo itokisana." },
  },
];

export const products = [
  // ── Cuisine ──────────────────────────────────────────────────────────────
  {
    category: "cuisine", name: "Tasse en grès Vato", tagline: "Émail blanc mat, 30 cl",
    priceAr: 12_000, stock: 85, featured: true, images: ["mug"],
    description: "Une tasse en grès tourné, émaillée blanc mat. Sa forme arrondie tient bien en main et garde le café chaud.",
    details: "Grès émaillé, 30 cl\nPasse au micro-ondes\nSe lave à la main ou en machine",
    en: {
      name: "Vato stoneware mug", tagline: "Matt white glaze, 30 cl",
      description: "A wheel-thrown stoneware mug with a matt white glaze. Its rounded shape sits well in the hand and keeps coffee hot.",
      details: "Glazed stoneware, 30 cl\nMicrowave safe\nHand wash or dishwasher",
    },
    mg: {
      name: "Kaopy tanimanga Vato", tagline: "Fotsy tsy mamirapiratra, 30 cl",
      description: "Kaopy vita amin'ny tanimanga, miloko fotsy. Boribory ny endriny, mora tazonina ary mitazona ny hafanan'ny kafe.",
    },
  },
  {
    category: "cuisine", name: "Gourde isotherme Forêt", tagline: "Inox double paroi, 50 cl",
    priceAr: 45_000, stock: 48, featured: true, images: ["gourde"],
    description: "Douze heures au chaud, vingt-quatre au frais. Une gourde en inox à double paroi, finition mate qui ne glisse pas.",
    details: "Inox 18/8 double paroi\n50 cl, bouchon étanche\nSans BPA",
    en: {
      name: "Forêt insulated bottle", tagline: "Double-wall steel, 50 cl",
      description: "Twelve hours hot, twenty-four hours cold. A double-wall stainless steel bottle with a matt, non-slip finish.",
      details: "18/8 double-wall stainless steel\n50 cl, leakproof cap\nBPA free",
    },
    mg: {
      name: "Tavoahangy mitahiry hafanana Forêt", tagline: "Vy tsy mety harafesina, 50 cl",
      description: "Mitazona ny hafanana mandritra ny roa ambin'ny folo ora, ary ny hatsiaka mandritra ny efatra amby roapolo ora. Tsy malama eo an-tanana.",
    },
  },

  // ── Maison ───────────────────────────────────────────────────────────────
  {
    category: "maison", name: "Canapé Alba en velours", tagline: "Trois places, assise profonde",
    priceAr: 1_250_000, stock: 6, featured: true, images: ["canape"],
    description: "Un canapé trois places à l'assise généreuse, habillé d'un velours côtelé vert. Structure en bois massif, pensée pour durer.",
    details: "Structure en bois massif\nVelours de coton\nL 210 × P 92 × H 78 cm\nLivré monté, sur rendez-vous",
    en: {
      name: "Alba velvet sofa", tagline: "Three seats, deep cushions",
      description: "A generous three-seater sofa covered in green corduroy velvet. Solid wood frame, built to last.",
      details: "Solid wood frame\nCotton velvet\nW 210 × D 92 × H 78 cm\nDelivered assembled, by appointment",
    },
    mg: {
      name: "Seza lava Alba", tagline: "Olona telo, lalina ny fipetrahana",
      description: "Seza lava ho an'olona telo, voarakotra velours maitso. Hazo matevina ny rafitra, natao haharitra.",
    },
  },
  {
    category: "maison", name: "Canapé Dune en lin", tagline: "Modulable, housse lavable",
    priceAr: 2_850_000, compareAtAr: 3_200_000, stock: 3, images: ["canape-lin", "interieur"],
    description: "Des lignes basses, un lin lavé au toucher souple et une housse qui s'enlève pour le lavage. Il s'installe au centre du salon.",
    details: "Lin lavé\nHousse lavable à 30 °C\nL 230 × P 98 × H 72 cm\nGarantie 5 ans sur la structure",
    en: {
      name: "Dune linen sofa", tagline: "Modular, washable cover",
      description: "Low lines, soft washed linen and a cover that comes off for washing. Made to sit in the middle of the living room.",
      details: "Washed linen\nCover washable at 30 °C\nW 230 × D 98 × H 72 cm\n5-year warranty on the frame",
    },
    mg: {
      name: "Seza lava Dune", tagline: "Azo arindra, azo sasana ny fonony",
      description: "Seza lava iva, malefaka ny lamba ary azo esorina ny fonony rehefa hosasana. Mety apetraka eo afovoan'ny efitrano fandraisam-bahiny.",
    },
  },
  {
    category: "maison", name: "Fauteuil Margaux", tagline: "Bouclette écrue, pieds tournés",
    priceAr: 680_000, stock: 8, images: ["fauteuil"],
    description: "Un petit fauteuil d'appoint au dossier capitonné, recouvert d'une bouclette écrue. Ses pieds tournés lui donnent une allure rétro.",
    details: "Tissu bouclette laine et coton\nPieds en bois laqué\nL 68 × P 70 × H 80 cm",
    en: {
      name: "Margaux armchair", tagline: "Off-white bouclé, turned legs",
      description: "A small occasional armchair with a tufted back, covered in off-white bouclé. Its turned legs give it a retro look.",
      details: "Wool and cotton bouclé\nLacquered wooden legs\nW 68 × D 70 × H 80 cm",
    },
    mg: {
      name: "Seza malefaka Margaux", tagline: "Lamba fotsy, tongotra hazo",
      description: "Seza malefaka kely misy lamosina, voarakotra lamba fotsy. Hazo voasokitra ny tongony.",
    },
  },
  {
    category: "maison", name: "Tabouret haut Oslo", tagline: "Coque noire, pieds en bois",
    priceAr: 145_000, stock: 24, images: ["chaise"],
    description: "Coque moulée mate, pieds en bois massif et repose-pieds en acier : un tabouret stable et léger, pour le comptoir ou le plan de travail.",
    details: "Hauteur d'assise 65 cm\nPieds en bois massif\nPatins anti-rayures fournis",
    en: {
      name: "Oslo bar stool", tagline: "Black shell, wooden legs",
      description: "Matt moulded shell, solid wood legs and a steel footrest: a stable, light stool for the counter or the worktop.",
      details: "Seat height 65 cm\nSolid wood legs\nFloor protectors included",
    },
    mg: {
      name: "Seza avo Oslo", tagline: "Mainty, tongotra hazo",
      description: "Seza avo maivana sady mafy orina, hazo matevina ny tongony ary misy fametrahan-tongotra vy.",
    },
  },
  {
    category: "maison", name: "Lampadaire Atelier", tagline: "Acier gris, tête orientable",
    priceAr: 220_000, compareAtAr: 260_000, stock: 14, images: ["lampe"],
    description: "Inspiré des lampes d'atelier, ce lampadaire en acier diffuse une lumière franche et se règle d'un geste.",
    details: "Acier laqué mat\nHauteur 155 cm\nDouille E27, ampoule LED fournie\nInterrupteur au pied",
    en: {
      name: "Atelier floor lamp", tagline: "Grey steel, adjustable head",
      description: "Modelled on workshop lamps, this steel floor lamp gives a clear light and adjusts with one hand.",
      details: "Matt lacquered steel\nHeight 155 cm\nE27 socket, LED bulb included\nFoot switch",
    },
    mg: {
      name: "Jiro mijoro Atelier", tagline: "Vy volondavenona, azo ahodina ny lohany",
      description: "Jiro mijoro vita amin'ny vy, mazava tsara ny hazavany ary mora ahodina amin'izay tiana hazavaina.",
    },
  },
  {
    category: "maison", name: "Aloès en pot", tagline: "Plante et cache-pot en céramique",
    priceAr: 18_000, stock: 4, images: ["plante"],
    description: "Un aloès robuste dans son cache-pot en céramique émaillée. Peu d'arrosage, beaucoup de lumière : la plante idéale pour débuter.",
    details: "Cache-pot Ø 14 cm\nArrosage toutes les 2 à 3 semaines\nLumière vive, sans soleil direct",
    en: {
      name: "Potted aloe", tagline: "Plant and ceramic pot",
      description: "A sturdy aloe in its glazed ceramic pot. Little water, plenty of light: the ideal first plant.",
      details: "Pot Ø 14 cm\nWater every 2 to 3 weeks\nBright light, no direct sun",
    },
    mg: {
      name: "Vahona anaty vilany", tagline: "Zavamaniry sy vilany seramika",
      description: "Vahona matanjaka anaty vilany seramika. Tsy mila rano be fa mila hazavana betsaka : mety ho an'izay vao manomboka mamboly.",
    },
  },

  // ── Vannerie et textile ──────────────────────────────────────────────────
  {
    category: "vannerie-textile", name: "Panier tressé Soa", tagline: "Tressé à la main, rabat en cuir",
    priceAr: 65_000, stock: 7, featured: true, images: ["sac-2"],
    description: "Un sac panier tressé à la main, fermé par un rabat en cuir. Bandoulière amovible fournie.",
    details: "Fibres naturelles tressées à la main\nRabat et anses en cuir\nL 26 × H 20 × P 12 cm\nBandoulière amovible",
    en: {
      name: "Soa woven basket bag", tagline: "Hand-woven, leather flap",
      description: "A hand-woven basket bag closed by a leather flap. Comes with a removable shoulder strap.",
      details: "Hand-woven natural fibres\nLeather flap and handles\nW 26 × H 20 × D 12 cm\nRemovable shoulder strap",
    },
    mg: {
      name: "Harona voarary Soa", tagline: "Voarary tanana, misy rakotra hoditra",
      description: "Harona voarary tanana, mihidy amin'ny rakotra hoditra. Misy tady azo esorina hanantonana azy eo an-tsoroka.",
    },
  },
  {
    category: "vannerie-textile", name: "Sac à dos Transit", tagline: "Toile enduite, 18 litres",
    priceAr: 85_000, stock: 40, images: ["sac-dos"],
    description: "Compartiment rembourré pour l'ordinateur, poche zippée et dos matelassé : le sac des trajets quotidiens, en toile qui résiste à la pluie.",
    details: "Toile enduite déperlante\nCompartiment ordinateur 15 pouces\n18 litres, 620 g",
    en: {
      name: "Transit backpack", tagline: "Coated canvas, 18 litres",
      description: "Padded laptop compartment, zipped pocket and quilted back: the everyday commuting bag, in canvas that stands up to rain.",
      details: "Water-repellent coated canvas\n15-inch laptop compartment\n18 litres, 620 g",
    },
    mg: {
      name: "Kitapo babena Transit", tagline: "Lamba matevina, 18 litatra",
      description: "Misy toerana malefaka ho an'ny solosaina sy paosy misy zipo. Kitapo entina isan'andro, tsy tantera-drano mora foana.",
    },
  },
  {
    category: "vannerie-textile", name: "T-shirt Essentiel blanc", tagline: "Coton épais, coupe droite",
    priceAr: 25_000, stock: 120, featured: true, images: ["tshirt-2"],
    description: "La coupe droite que l'on cherche toujours : un coton dense, un col rond qui ne se détend pas et des coutures renforcées.",
    details: "100 % coton, 190 g/m²\nCoupe droite\nLavage à 30 °C",
    en: {
      name: "Essentiel white T-shirt", tagline: "Heavy cotton, straight cut",
      description: "The straight cut everyone looks for: dense cotton, a crew neck that keeps its shape and reinforced seams.",
      details: "100% cotton, 190 g/m²\nStraight cut\nWash at 30 °C",
    },
    mg: {
      name: "T-shirt fotsy Essentiel", tagline: "Landihazo matevina, mahitsy",
      description: "T-shirt mahitsy vita amin'ny landihazo matevina. Tsy mihalalaka ny vozony ary mafy ny zaitra.",
    },
  },
  {
    category: "vannerie-textile", name: "T-shirt Atelier noir", tagline: "Motif imprimé, coupe ample",
    priceAr: 30_000, stock: 75, images: ["tshirt-1"],
    description: "Un coton épais teint en noir profond, imprimé sur la poitrine. Coupe légèrement ample, épaules tombantes.",
    details: "100 % coton peigné, 220 g/m²\nImpression à l'eau\nCoupe ample",
    en: {
      name: "Atelier black T-shirt", tagline: "Printed design, loose fit",
      description: "Heavy cotton dyed deep black, printed on the chest. Slightly loose fit with dropped shoulders.",
      details: "100% combed cotton, 220 g/m²\nWater-based print\nLoose fit",
    },
    mg: {
      name: "T-shirt mainty Atelier", tagline: "Misy sary vita pirinty, malalaka",
      description: "Landihazo matevina mainty, misy sary eo amin'ny tratra. Somary malalaka rehefa anaovana.",
    },
  },
  {
    category: "vannerie-textile", name: "Veste Sully en cuir", tagline: "Cuir souple, fermeture asymétrique",
    priceAr: 450_000, compareAtAr: 520_000, stock: 9, images: ["veste"],
    description: "Une veste en cuir souple à fermeture asymétrique, doublée. Elle se patine et s'assouplit au fil des années.",
    details: "Cuir pleine fleur\nDoublure en viscose\nFermetures en métal\nÀ faire entretenir par un spécialiste du cuir",
    en: {
      name: "Sully leather jacket", tagline: "Soft leather, asymmetric zip",
      description: "A lined jacket in soft leather with an asymmetric zip. It softens and takes on a patina over the years.",
      details: "Full-grain leather\nViscose lining\nMetal zips\nHave it cleaned by a leather specialist",
    },
    mg: {
      name: "Palitao hoditra Sully", tagline: "Hoditra malefaka, zipo mitongilana",
      description: "Palitao hoditra malefaka misy lamba ao anatiny. Vao mainka mihatsara sy mihamalefaka rehefa ela.",
    },
  },
  {
    category: "vannerie-textile", name: "Baskets Tempo grises", tagline: "Maille respirante, semelle légère",
    priceAr: 135_000, stock: 32, images: ["sneakers-1"],
    description: "Une tige en maille d'une seule pièce et une semelle qui amortit : une basket de tous les jours, aussi légère qu'elle en a l'air.",
    details: "Tige en maille\nSemelle EVA\n240 g par chaussure (taille 42)",
    en: {
      name: "Tempo grey trainers", tagline: "Breathable knit, light sole",
      description: "A one-piece knit upper and a cushioned sole: an everyday trainer, as light as it looks.",
      details: "Knit upper\nEVA sole\n240 g per shoe (size 42)",
    },
    mg: {
      name: "Kiraro Tempo volondavenona", tagline: "Lamba mamela rivotra, maivana",
      description: "Kiraro entina isan'andro, maivana ary malefaka eo ambany tongotra.",
    },
  },
  {
    category: "vannerie-textile", name: "Baskets Riviera bordeaux", tagline: "Toile et daim, semelle caoutchouc",
    priceAr: 75_000, compareAtAr: 90_000, stock: 0, images: ["sneakers-2"],
    description: "Toile épaisse, renforts en daim et semelle en caoutchouc : une basse classique, dans un bordeaux qui va avec tout.",
    details: "Toile de coton et cuir\nSemelle en caoutchouc\nDu 36 au 46",
    en: {
      name: "Riviera burgundy trainers", tagline: "Canvas and suede, rubber sole",
      description: "Thick canvas, suede reinforcements and a rubber sole: a classic low-top in a burgundy that goes with everything.",
      details: "Cotton canvas and leather\nRubber sole\nSizes 36 to 46",
    },
    mg: {
      name: "Kiraro Riviera mena antitra", tagline: "Lamba sy hoditra, faladia fingotra",
      description: "Kiraro iva vita amin'ny lamba matevina, mena antitra mifanaraka amin'ny akanjo rehetra.",
    },
  },
  {
    category: "vannerie-textile", name: "Portefeuille Marius", tagline: "Cuir, six cartes",
    priceAr: 40_000, stock: 55, images: ["portefeuille"],
    description: "Un portefeuille compact en cuir, cousu solidement. Six emplacements pour les cartes, un compartiment pour les billets.",
    details: "Cuir de vachette pleine fleur\nCouture au fil ciré\n11 × 9 cm fermé",
    en: {
      name: "Marius wallet", tagline: "Leather, six cards",
      description: "A compact, sturdily stitched leather wallet. Six card slots and a compartment for notes.",
      details: "Full-grain cowhide\nWaxed thread stitching\n11 × 9 cm closed",
    },
    mg: {
      name: "Paoketra Marius", tagline: "Hoditra, karatra enina",
      description: "Paoketra hoditra kely, mafy zaitra. Misy toerana ho an'ny karatra enina sy ho an'ny vola taratasy.",
    },
  },
  {
    category: "vannerie-textile", name: "Lunettes de soleil Sorrente", tagline: "Monture dorée, verres verts",
    priceAr: 60_000, stock: 22, images: ["lunettes-2"],
    description: "Une monture ronde en métal doré, fine et légère, avec des verres verts qui protègent bien du soleil.",
    details: "Monture en acier inoxydable\nVerres catégorie 3\nProtection UV 100 %\nÉtui rigide fourni",
    en: {
      name: "Sorrente sunglasses", tagline: "Gold frame, green lenses",
      description: "A thin, light round frame in gold-tone metal, with green lenses that give good sun protection.",
      details: "Stainless steel frame\nCategory 3 lenses\n100% UV protection\nHard case included",
    },
    mg: {
      name: "Solomaso Sorrente", tagline: "Volamena ny tahony, maitso ny fitaratra",
      description: "Solomaso boribory manify sady maivana, miaro tsara amin'ny masoandro.",
    },
  },

  // ── Épicerie ─────────────────────────────────────────────────────────────
  {
    category: "epicerie", name: "Café en grains des Hautes Terres", tagline: "Arabica, torréfié en petites quantités",
    priceAr: 18_000, stock: 90, featured: true, images: ["cafe"],
    description: "Un arabica d'altitude torréfié en petites quantités. En tasse : des notes de cacao et une acidité douce.",
    details: "100 % arabica\nTorréfaction moyenne\nSachet de 250 g",
    en: {
      name: "Highlands coffee beans", tagline: "Arabica, roasted in small batches",
      description: "A high-grown arabica roasted in small batches. In the cup: cocoa notes and a gentle acidity.",
      details: "100% arabica\nMedium roast\n250 g bag",
    },
    mg: {
      name: "Kafe voa avy any afovoan-tany", tagline: "Arabica, voaendy tsikelikely",
      description: "Kafe arabica nambolena any amin'ny toerana avo, voaendy tsikelikely. Manitra kakao ary malefaka ny tsirony.",
    },
  },
  {
    category: "epicerie", name: "Thé noir Matinée", tagline: "Feuilles entières, boîte de 100 g",
    priceAr: 9_000, stock: 70, images: ["the"],
    description: "Un thé noir corsé en feuilles entières, à boire nature ou avec un peu de lait.",
    details: "Thé noir en feuilles entières\nInfusion 4 minutes à 95 °C\nBoîte en métal de 100 g",
    en: {
      name: "Matinée black tea", tagline: "Whole leaf, 100 g tin",
      description: "A full-bodied whole-leaf black tea, to drink plain or with a little milk.",
      details: "Whole-leaf black tea\nBrew 4 minutes at 95 °C\n100 g metal tin",
    },
    mg: {
      name: "Dite mainty Matinée", tagline: "Ravina manontolo, boaty 100 g",
      description: "Dite mainty mahery tsiro, sotroina tsotra na asiana ronono kely.",
    },
  },

  // ── Soin ─────────────────────────────────────────────────────────────────
  {
    category: "soin", name: "Sérum Éclat à la vitamine C", tagline: "Flacon ambré de 30 ml",
    priceAr: 55_000, stock: 36, images: ["soin-1"],
    description: "Un sérum léger à la vitamine C et à l'acide hyaluronique, pour un teint plus lumineux en quelques semaines.",
    details: "Vitamine C à 10 %\nSans parfum, tous types de peau\nFlacon en verre ambré de 30 ml",
    en: {
      name: "Éclat vitamin C serum", tagline: "30 ml amber bottle",
      description: "A light serum with vitamin C and hyaluronic acid, for a brighter complexion within a few weeks.",
      details: "10% vitamin C\nFragrance free, all skin types\n30 ml amber glass bottle",
    },
    mg: {
      name: "Sérum Éclat misy vitamina C", tagline: "Tavoahangy kely 30 ml",
      description: "Sérum maivana misy vitamina C, mampamirapiratra ny hoditry ny tarehy ao anatin'ny herinandro vitsivitsy.",
    },
  },
  {
    category: "soin", name: "Bougie Veillée", tagline: "Cèdre, ambre et fève tonka",
    priceAr: 28_000, stock: 60, featured: true, images: ["bougie"],
    description: "Une bougie coulée à la main dans un verre fumé. Notes boisées de cèdre, fond chaud d'ambre. Environ cinquante heures de combustion.",
    details: "Cire végétale\nMèche 100 % coton\n220 g, environ 50 h",
    en: {
      name: "Veillée candle", tagline: "Cedar, amber and tonka bean",
      description: "A candle hand-poured into smoked glass. Woody cedar notes on a warm amber base. Burns for about fifty hours.",
      details: "Vegetable wax\n100% cotton wick\n220 g, about 50 hours",
    },
    mg: {
      name: "Labozia manitra Veillée", tagline: "Fofon-kazo sy ambra",
      description: "Labozia manitra natao tanana, anaty vera. Mirehitra mandritra ny dimampolo ora eo ho eo.",
    },
  },

  // ── Électronique ─────────────────────────────────────────────────────────
  {
    category: "electronique", name: "Casque Studio One", tagline: "Sans fil, réduction de bruit",
    priceAr: 350_000, compareAtAr: 420_000, stock: 20, featured: true, images: ["casque-1"],
    description: "Réduction de bruit active, trente heures d'autonomie et coussinets confortables. Un casque fermé au son équilibré, pour le bureau comme pour le taxi-brousse.",
    details: "Bluetooth 5.3, deux appareils à la fois\nRéduction de bruit active\nAutonomie 30 h, charge rapide USB-C\n260 g",
    en: {
      name: "Studio One headphones", tagline: "Wireless, noise cancelling",
      description: "Active noise cancelling, thirty hours of battery and comfortable ear pads. Closed-back headphones with a balanced sound, for the office or the bush taxi.",
      details: "Bluetooth 5.3, two devices at once\nActive noise cancelling\n30 h battery, USB-C fast charging\n260 g",
    },
    mg: {
      name: "Casque Studio One", tagline: "Tsy misy tariby, manafoana ny tabataba",
      description: "Manafoana ny tabataba manodidina ary maharitra telopolo ora ny batery. Mety ampiasaina any am-piasana na anaty taxi-brousse.",
    },
  },
  {
    category: "electronique", name: "Casque Mono filaire", tagline: "Son neutre, câble détachable",
    priceAr: 95_000, stock: 28, images: ["casque-2"],
    description: "Un casque filaire au son neutre et détaillé. Arceau en acier, câble détachable et coussinets remplaçables.",
    details: "Haut-parleurs 40 mm\nImpédance 32 Ω\nCâble détachable 1,5 m, jack 3,5 mm",
    en: {
      name: "Mono wired headphones", tagline: "Neutral sound, detachable cable",
      description: "Wired headphones with a neutral, detailed sound. Steel headband, detachable cable and replaceable ear pads.",
      details: "40 mm drivers\n32 Ω impedance\n1.5 m detachable cable, 3.5 mm jack",
    },
    mg: {
      name: "Casque misy tariby Mono", tagline: "Feo madio, tariby azo esorina",
      description: "Casque misy tariby, madio sy mazava ny feony. Azo esorina ny tariby ary azo soloina ny ondany.",
    },
  },
  {
    category: "electronique", name: "Écouteurs Pulse", tagline: "Sans fil, boîtier de charge",
    priceAr: 160_000, stock: 45, featured: true, images: ["ecouteurs"],
    description: "Des écouteurs sans fil avec réduction de bruit : six heures d'écoute et trois recharges dans le boîtier.",
    details: "Bluetooth 5.3\nAutonomie 6 h + 18 h avec le boîtier\nRésiste aux éclaboussures (IPX4)\nTrois tailles d'embouts",
    en: {
      name: "Pulse earbuds", tagline: "Wireless, charging case",
      description: "Wireless earbuds with noise cancelling: six hours of listening and three recharges in the case.",
      details: "Bluetooth 5.3\n6 h battery + 18 h with the case\nSplash resistant (IPX4)\nThree ear tip sizes",
    },
    mg: {
      name: "Écouteur Pulse", tagline: "Tsy misy tariby, misy boaty famahanana",
      description: "Écouteur tsy misy tariby : enina ora ny fihainoana, ary azo fenoina in-telo ao anaty boatiny.",
    },
  },
  {
    category: "electronique", name: "Clavier Frappe", tagline: "Sans fil, aluminium, AZERTY",
    priceAr: 120_000, stock: 2, images: ["clavier"],
    description: "Un clavier compact en aluminium, aux touches silencieuses. Il se connecte à trois appareils et tient un mois sur une charge.",
    details: "Disposition AZERTY\nBluetooth, trois appareils\nAutonomie un mois, recharge USB-C",
    en: {
      name: "Frappe keyboard", tagline: "Wireless, aluminium, AZERTY",
      description: "A compact aluminium keyboard with quiet keys. It pairs with three devices and lasts a month on one charge.",
      details: "AZERTY layout\nBluetooth, three devices\nOne month of battery, USB-C charging",
    },
    mg: {
      name: "Klavie Frappe", tagline: "Tsy misy tariby, aliminioma, AZERTY",
      description: "Klavie kely vita amin'ny aliminioma, tsy mitabataba ny bokotra. Mifandray amin'ny fitaovana telo ary maharitra iray volana ny batery.",
    },
  },
  {
    category: "electronique", name: "Montre connectée Tempo", tagline: "GPS, cardio, écran OLED",
    priceAr: 480_000, stock: 13, images: ["montre-co"],
    description: "Suivi d'activité, GPS intégré et notifications sur un écran toujours lisible. Cinq jours d'autonomie.",
    details: "Écran OLED 1,4 pouce\nGPS et capteur cardiaque\nAutonomie 5 jours\nÉtanche 5 ATM",
    en: {
      name: "Tempo smartwatch", tagline: "GPS, heart rate, OLED screen",
      description: "Activity tracking, built-in GPS and notifications on a screen that stays readable. Five days of battery.",
      details: "1.4-inch OLED screen\nGPS and heart rate sensor\n5 days of battery\nWater resistant to 5 ATM",
    },
    mg: {
      name: "Famantaranandro mifandray Tempo", tagline: "GPS, fitepon'ny fo, efijery OLED",
      description: "Manara-maso ny fihetsehana, misy GPS ary mampiseho ny hafatra voaray. Maharitra dimy andro ny batery.",
    },
  },
  {
    category: "electronique", name: "Montre Lisière 36", tagline: "Cadran blanc, bracelet en cuir",
    priceAr: 190_000, stock: 16, images: ["montre-3"],
    description: "Un cadran blanc épuré, un boîtier de 36 mm et un bracelet en cuir taupe. Mouvement à quartz.",
    details: "Boîtier en acier 36 mm, épaisseur 7 mm\nVerre minéral\nMouvement à quartz\nÉtanche 3 ATM",
    en: {
      name: "Lisière 36 watch", tagline: "White dial, leather strap",
      description: "A clean white dial, a 36 mm case and a taupe leather strap. Quartz movement.",
      details: "36 mm steel case, 7 mm thick\nMineral glass\nQuartz movement\nWater resistant to 3 ATM",
    },
    mg: {
      name: "Famantaranandro Lisière 36", tagline: "Fotsy ny tarehiny, hoditra ny fehiny",
      description: "Famantaranandro tsotra, fotsy ny tarehiny, 36 mm ny sakany ary hoditra ny fehiny.",
    },
  },
];

// Le premier client est le compte de démonstration (client@…). `zone` : rang de sa zone de livraison dans `shippingZones`.
export const customers = [
  { email: "client@seve.example", name: "Hery Rakotomalala", line1: "Lot II M 45", district: "Ankadivato", postalCode: "101", city: "Antananarivo", province: "Antananarivo", zone: 0, country: "Madagascar", phone: "034 12 345 67" },
  { email: "voahirana.razafy@example.com", name: "Voahirana Razafindrakoto", line1: "Lot 12 B", district: "Ambohimena", postalCode: "110", city: "Antsirabe", province: "Antananarivo", zone: 2, country: "Madagascar", phone: "033 45 210 98" },
  { email: "tiana.andria@example.com", name: "Tiana Andrianarisoa", line1: "Lot IVG 203", district: "Antanimena", line2: "Près de la pharmacie", postalCode: "101", city: "Antananarivo", province: "Antananarivo", zone: 0, country: "Madagascar", phone: "032 07 654 32" },
  { email: "fanja.rasoa@example.com", name: "Fanja Rasoanaivo", line1: "Lot 31", district: "Ampasambazaha", postalCode: "301", city: "Fianarantsoa", province: "Fianarantsoa", zone: 2, country: "Madagascar", phone: "034 88 120 45" },
  { email: "mamy.randria@example.com", name: "Mamy Randrianasolo", line1: "14 boulevard Joffre", district: "Anjoma", postalCode: "501", city: "Toamasina", province: "Toamasina", zone: 2, country: "Madagascar", phone: "038 21 776 03" },
  { email: "lalao.ravelo@example.com", name: "Lalao Ravelojaona", line1: "Lot 8", district: "Mahabibo", postalCode: "401", city: "Mahajanga", province: "Mahajanga", zone: 2, country: "Madagascar", phone: "033 19 402 57" },
  { email: "njaka.rabe@example.com", name: "Njaka Rabemananjara", line1: "22 rue Colbert", district: "Tanambao", postalCode: "201", city: "Antsiranana", province: "Antsiranana", zone: 2, country: "Madagascar", phone: "032 54 903 11" },
  { email: "soa.rakoto@example.com", name: "Soa Rakotondrabe", line1: "Lot 27", district: "Sanfily", postalCode: "601", city: "Toliara", province: "Toliara", zone: 3, country: "Madagascar", phone: "034 60 318 74" },
];

export const promoCodes = [
  { code: "BIENVENUE10", type: "PERCENT", value: 10 },
  { code: "TONGASOA", type: "FIXED", value: 10_000 * 100, minSubtotalCents: 100_000 * 100, maxUses: 100 },
  { code: "ETE2025", type: "PERCENT", value: 15, expiresAt: new Date("2025-09-01"), active: false },
];
