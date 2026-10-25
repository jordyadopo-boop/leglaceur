/**
 * Le Glaceur — source unique des données métier.
 * Tout prix, numéro, zone ou texte commercial affiché par le site vient d'ici.
 * Les valeurs marquées « À VALIDER » sont des propositions en attente de confirmation client.
 */

export const BRAND = {
  name: 'Le Glaceur',
  parent: 'SDLSIT Group',
  signature: 'Marque de SDLSIT Group',
  tagline: 'La fraîcheur sous toutes ses formes',
  promise: 'Une glace alimentaire de qualité',
  values: [
    { id: 'purete', label: 'Pureté', text: 'Une eau traitée et contrôlée' },
    { id: 'hygiene', label: 'Hygiène', text: 'Des procédés de fabrication rigoureux' },
    { id: 'qualite', label: 'Qualité', text: 'Une fraîcheur constante et fiable' },
  ],
  url: 'https://www.leglaceur.ci',
  address: {
    street: 'Abatta – Carrefour Drogba',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    countryCode: 'CI',
    mapsQuery: 'Abatta Carrefour Drogba, Abidjan',
  },
  phones: [
    { label: 'Service client & WhatsApp', display: '+225 07 89 85 16 86', tel: '+2250789851686' },
    { label: 'Service client', display: '+225 05 66 04 31 69', tel: '+2250566043169' },
    { label: 'Ligne fixe', display: '+225 27 24 46 75 66', tel: '+2252724467566' },
  ],
  // Numéro WhatsApp qui reçoit les devis (confirmé par le client le 22/10/2026).
  whatsapp: '2250789851686',
  email: 'sdlsitgroup@gmail.com', // confirmée par le client le 22/10/2026
  hours: '24h/24 · 7j/7',
  deliveryClaim: 'Livraison partout à Abidjan',
  // URL du registre des devis (Google Apps Script, docs/apps-script/registre-devis.gs) : reçoit chaque devis
  // et alimente la page /admin. null = registre non branché.
  quoteWebhook: 'https://script.google.com/macros/s/AKfycbwo3y_lZxhRLQzj0YwQZRYmdUN52uGkwM_jOwpa6V1wIcKYiHBAyaQ-Us7OQqFOBbr6Yw/exec',
};

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BRAND.address.mapsQuery)}`;
export const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(BRAND.address.mapsQuery)}&z=15&output=embed`;

/**
 * Catalogue. Chaque produit a au moins une variante (sku) : c'est la variante qui va dans le devis.
 * available: false → affiché « Bientôt disponible », non ajoutable au devis.
 */
export const PRODUCTS = [
  {
    id: 'glacons',
    name: 'Glace cubique',
    alias: 'Glaçons alimentaires',
    tagline: 'Fraîcheur longue durée',
    available: true,
    img: 'glacons',
    description:
      'Des glaçons denses, cristallins et 100 % alimentaires. Leur fonte lente permet un refroidissement efficace sans trop diluer vos boissons.',
    uses: ['Boissons', 'Cocktails', 'Jus', 'Restaurants', 'Événements', 'Usage domestique'],
    howto: 'À utiliser directement dans vos boissons.',
    storage: "Conserver en glacière ou en congélateur, à l'abri du soleil.",
    safety: 'Servir avec une pelle propre, jamais à mains nues. Ne pas recongeler une glace qui a commencé à fondre.',
    variants: [{ sku: 'glacons-5kg', label: 'Pack de 5 kg', unit: 'pack', units: 'packs', kg: 5, price: 750 }],
  },
  {
    id: 'grain',
    isNew: true,
    name: 'Glace en grain',
    alias: 'Nugget ice',
    tagline: 'Douce, croquante, gourmande',
    available: true,
    img: 'grain',
    description:
      'De petits grains de glace compactés, à la texture moelleuse. Ils absorbent le sirop et le jus de la boisson et se croquent avec plaisir.',
    uses: ['Smoothies', "Cocktails d'été", 'Sodas', 'Jus de fruits', 'Fontaines à boissons', 'Événements'],
    howto: 'À verser directement dans vos boissons et préparations glacées.',
    storage: 'Conserver en glacière ou en congélateur ; à consommer rapidement une fois ouverte.',
    safety: 'Servir avec une pelle ou une cuillère propre. Ne pas recongeler une glace qui a commencé à fondre.',
    variants: [{ sku: 'grain-5kg', label: 'Pack de 5 kg', unit: 'pack', units: 'packs', kg: 5, price: 750 }],
  },
  {
    id: 'pilee',
    name: 'Glace pilée',
    alias: 'Glace concassée',
    tagline: 'Une fraîcheur intense',
    available: true,
    img: 'pilee',
    description:
      "De petits fragments de glace à la texture légère, offrant un refroidissement rapide et un apport d'eau maîtrisé.",
    uses: ['Cocktails (Mojito, Caïpirinha…)', 'Frappés', 'Smoothies', 'Présentoirs de fruits de mer', 'Poissonneries', 'Événements'],
    howto: 'À utiliser directement dans vos préparations ou pour la présentation.',
    storage: "Garder le sac fermé, en glacière ou conservateur, à l'ombre.",
    safety: "Pour le contact avec les aliments (poissons, fruits de mer), utiliser des bacs propres et vidanger l'eau de fonte régulièrement.",
    variants: [{ sku: 'pilee-50kg', label: 'Sac de 50 kg', unit: 'sac', units: 'sacs', kg: 50, price: 3000 }],
  },
  {
    id: 'carboglace',
    name: 'Carboglace',
    alias: 'Glace carbonique · glace sèche',
    tagline: 'Froid extrême · effet fumée',
    // Disponible (confirmé par le client le 22/10/2026). Passer à false pour afficher « Bientôt disponible ».
    available: true,
    img: 'carboglace',
    description:
      'Du dioxyde de carbone solide à -78,5 °C. Elle passe directement de l’état solide à l’état gazeux et crée une brume blanche spectaculaire.',
    uses: ['Conservation', 'Transport cryogénique', 'Événementiel', 'Mixologie spectaculaire'],
    howto: 'Manipuler avec des gants. Ne jamais ingérer ni toucher à mains nues.',
    storage: 'Conserver dans une glacière isotherme non hermétique, jamais dans un récipient fermé ni dans une pièce close.',
    safety: "Température de -78,5 °C : toujours manipuler avec des gants épais ou une pince. Ne jamais ingérer, ne jamais mettre en bouche. Utiliser dans un lieu aéré (le CO₂ dégagé remplace l'air). Tenir hors de portée des enfants.",
    variants: [{ sku: 'carboglace-kg', label: 'Le kilo', unit: 'kg', units: 'kg', kg: 1, price: 7500 }],
  },
  {
    id: 'gobelet',
    name: 'Ice Cup',
    alias: 'Gobelet de glaçons',
    tagline: "Pratique et prêt à l'emploi",
    available: true,
    img: 'gobelet',
    description:
      'Des glaçons creux, légers et rafraîchissants, conditionnés en gobelet à couvercle pour une consommation immédiate.',
    uses: ['Sodas', 'Jus de fruits', 'Fast-food', 'Ventes à emporter', 'Événements'],
    howto: "Prêt à l'emploi. Verser directement dans la boisson.",
    storage: "Garder le couvercle fermé jusqu'au service ; conserver au frais.",
    safety: 'Produit alimentaire à usage unique : ne pas réutiliser le gobelet pour la glace.',
    variants: [{ sku: 'gobelet', label: '1 Ice Cup', unit: 'Ice Cup', units: 'Ice Cups', kg: null, price: 250 }],
  },
  {
    id: 'barres',
    name: 'Barres de glace',
    alias: 'Pains de glace',
    tagline: 'Fraîcheur et conservation',
    available: true,
    img: 'barres',
    description:
      'Des barres de glace de grand format, à fonte lente et homogène, idéales pour maintenir durablement la fraîcheur de vos produits.',
    uses: ['Conservation des produits alimentaires', 'Transport de marchandises', 'Pêche', 'Marchés', 'Événements', 'Usage professionnel'],
    howto: 'À placer dans des glacières, conservateurs ou zones de stockage.',
    storage: "Stocker à l'ombre, en glacière ou chambre froide ; plus le bloc est gros, plus il dure.",
    safety: 'Manipuler avec des gants (bloc lourd et glissant). Pour le contact direct avec des aliments, utiliser la glace pilée.',
    variants: [
      { sku: 'barre-5kg', label: 'Barre de 5 kg', unit: 'barre', units: 'barres', kg: 5, price: 350 },
      { sku: 'barre-10kg', label: 'Barre de 10 kg', unit: 'barre', units: 'barres', kg: 10, price: 650 },
    ],
  },
];

export const SKUS = Object.fromEntries(
  PRODUCTS.flatMap((p) => p.variants.map((v) => [v.sku, { ...v, product: p }])),
);

/** Secteurs servis (affiches). */
export const SECTORS = [
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'bars', label: 'Bars & lounges' },
  { id: 'evenements', label: 'Événements' },
  { id: 'poissonneries', label: 'Poissonneries' },
  { id: 'menages', label: 'Ménages' },
  { id: 'pros', label: 'Usages professionnels' },
];

/** Engagements (affiche 1). */
export const PILLARS = [
  { id: 'hygiene', label: 'Hygiénique & sûr' },
  { id: 'eau', label: 'Eau traitée haute qualité' },
  { id: 'froid', label: 'Froid maîtrisé en continu' },
  { id: 'emballage', label: 'Emballage responsable' },
];

/**
 * Livraison (règle client du 22/10/2026) :
 *  - 20 articles ou plus au total → livraison OFFERTE ;
 *  - moins de 20 articles → devis « hors frais de livraison » : le tarif est communiqué ensuite par Le Glaceur.
 *    AUCUN prix de livraison n'est affiché sur le site ni dans les devis.
 *  - Retrait sur place à Abatta : gratuit.
 */
export const DELIVERY = {
  freeFrom: 20,
  freeLabel: 'Livraison offerte dès 20 articles',
  paidLabel: 'Hors frais de livraison',
  paidNote: 'En dessous de 20 articles, le devis est établi hors frais de livraison : Le Glaceur vous communique le tarif.',
  pickup: {
    id: 'retrait',
    label: 'Retrait sur place',
    text: 'Venez récupérer votre commande à Abatta – Carrefour Drogba, 24h/24 et 7j/7.',
  },
  // Communes desservies (liste de choix pour l'adresse de livraison ; pas de tarification par zone).
  communes: ['Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon', 'Grand-Bassam', 'Autre localité'],
};

export const QUOTE = {
  prefix: 'GLC',
  validityDays: 7, // À VALIDER
  currency: 'FCFA',
  disclaimer: 'Ce document est un devis et ne constitue pas une facture.',
  payment: 'Aucun paiement en ligne : le règlement se fait à la livraison ou au retrait.',
  deliveryNote: 'Livraison offerte dès 20 articles. En dessous, devis hors frais de livraison : le tarif vous est communiqué par Le Glaceur.',
  storageKey: 'leglaceur:devis:v1',
};

/** Contenu pédagogique (guide PDF « Les glaces alimentaires : typologies & usages métiers »). */
export const ICE_TYPES = [
  { id: 'plein', name: 'Glaçon plein', alt: 'Cube gourmet', temp: '-2 °C à -5 °C', melt: 'Lente', meltScore: 3, dilution: 'Faible', sector: 'Bars & spiritueux',
    physical: "Dense, cristallin et 100 % massif. Poids élevé, absence d'air emprisonné.",
    speed: 'Très lente. Refroidissement continu sans diluer la boisson.',
    uses: 'Spiritueux nobles (whisky, cognac), cocktails « on the rocks », verres old fashioned.' },
  { id: 'creux', name: 'Glaçon creux', alt: 'Cylindrique', temp: '-1 °C à -3 °C', melt: 'Rapide', meltScore: 7, dilution: 'Élevée', sector: 'Fast-food & softs',
    physical: 'Forme de dé à coudre avec cavité centrale, produite par pulvérisation d’eau sur des palettes froides.',
    speed: 'Rapide : les surfaces interne et externe sont en contact avec le liquide.',
    uses: 'Sodas, jus de fruits, fast-food, verres de brasserie.' },
  { id: 'pilee', name: 'Glace pilée', alt: 'Crushed ice', temp: '-1 °C à -4 °C', melt: 'Moyenne à rapide', meltScore: 6, dilution: 'Contrôlée', sector: 'Mixologie (mojito)',
    physical: 'Fragments d’eau congelée cassés mécaniquement, de 5 à 15 mm.',
    speed: 'Modérée à rapide. Fraîcheur intense et apport d’eau maîtrisé.',
    uses: 'Mojito, caïpirinha, caïpiroska, seaux à champagne, présentoirs d’huîtres.' },
  { id: 'sphere', name: 'Sphère de glace', alt: 'Ice sphere', temp: '-3 °C à -6 °C', melt: 'Ultra-lente', meltScore: 1, dilution: 'Traces', sector: 'Cocktails premium',
    physical: 'Sphère ultra-transparente : le plus faible ratio surface/volume de la géométrie.',
    speed: 'Ultra-lente. Boisson à 0 °C plus de 30 minutes sans dilution notable.',
    uses: 'Bars à cocktails premium, dégustation de spiritueux haut de gamme.' },
  { id: 'ecailles', name: 'Glace en écailles', alt: 'Flake ice', temp: '-7 °C à -10 °C', melt: 'Très lente', meltScore: 2, dilution: 'Nulle à sec', sector: 'Poissonneries & industrie',
    physical: 'Lames plates et sèches sous-refroidies, de 1,5 à 2 mm d’épaisseur.',
    speed: 'Épouse la forme des aliments sans blesser les chairs fraîches.',
    uses: 'Étals de poissonnerie, transport des produits de la mer, boulangerie.' },
  { id: 'grains', name: 'Glace en grains', alt: 'Nugget ice', temp: '-1 °C à -3 °C', melt: 'Rapide', meltScore: 7, dilution: 'Élevée', sector: 'Smoothies & soda',
    physical: 'Petits amalgames de glace compactés, texture moelleuse et compressible.',
    speed: 'Absorbe le sirop et le jus de la boisson : un encas « mâchable ».',
    uses: 'Smoothies, cocktails d’été, fontaines à soda, milieux hospitaliers.' },
  { id: 'carbo', name: 'Carboglace (CO₂)', alt: 'Glace sèche', temp: '-78,5 °C', melt: 'Sublimation', meltScore: 0, dilution: 'Aucune (gaz)', sector: 'Événementiel & cryogénie',
    physical: 'Dioxyde de carbone solide. Passe directement de solide à gaz.',
    speed: 'Brume blanche dense au contact d’un liquide chaud ou tiède.',
    uses: 'Mixologie spectaculaire, transport cryogénique. Ne jamais ingérer.' },
];

export const SCIENCE = {
  latentHeat: 334, // J/g absorbés à la fusion
};

/** Espace administrateur : catégories proposées à la saisie (la saisie reste libre). */
export const FINANCE = {
  depenseCategories: [
    'Électricité', 'Eau', 'Carburant & transport', 'Salaires', 'Emballages (sacs, gobelets)', 'Entretien & réparations',
    'Loyer', 'Téléphone & internet', 'Marketing & publicité', 'Impôts & taxes', 'Fournitures', 'Autre',
  ],
  glace: 'Ventes de glace', // recettes de glace : devis encaissés (bouton « Encaisser ») et ventes sans devis
  recetteCategories: ['Ventes de glace', 'Vente de boissons', 'Location de matériel', 'Prestation de service', 'Autre activité'],
};
