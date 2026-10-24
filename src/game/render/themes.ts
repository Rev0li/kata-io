// Ambiances d'arène, d'après les visuels de référence (art/reference), et vie de chaque dojo.
export interface Theme {
  water: string;
  top: number;
  top2: number;
  seam: number;
  rim: number;
  side: number;
  out: number;
  line?: number;
  edge?: number;
  lamp?: number;
  glow?: number;
  sky: string;
}
export const THEMES: Record<string, Theme> = {
  brume: {
    water: '#656455',
    sky: '#a3a69c',
    top: 0x76604d,
    top2: 0x82694f,
    seam: 0x4a3b2f,
    rim: 0x8d9189,
    side: 0x4d4238,
    out: 0x2a2924,
    lamp: 0xf5e2b0,
    glow: 0xffd88a,
  },
  coucher: {
    water: '#355d62',
    sky: '#d9a982',
    top: 0xc98450,
    top2: 0xd89462,
    seam: 0x7a4624,
    rim: 0xb36a38,
    side: 0x7d4a27,
    out: 0x3a2314,
    line: 0x2f6f7d,
  },
  neige: {
    water: '#3b5a74',
    sky: '#b9cfe0',
    top: 0xb59f86,
    top2: 0xc4af95,
    seam: 0x6f5a45,
    rim: 0xe9f1f6,
    side: 0x7b6a5a,
    out: 0x1e2b38,
    line: 0x7fb8e8,
    lamp: 0xffe0a0,
    glow: 0xffd070,
  },
  bambou: {
    water: '#2f5a4a',
    sky: '#b8d4a0',
    top: 0xa8924e,
    top2: 0xb59f58,
    seam: 0x6a5a2a,
    rim: 0xc4b060,
    side: 0x6b5a30,
    out: 0x1d3a2c,
    line: 0x3e8a5a,
  },
  volcan: {
    water: '#3a1208',
    sky: '#2a0f12',
    top: 0x4a3028,
    top2: 0x563830,
    seam: 0x2a1a16,
    rim: 0x6a4a3c,
    side: 0x2a1a16,
    out: 0x120606,
    line: 0xff7a2a,
    edge: 0xff9a3c,
    lamp: 0xff9a3c,
    glow: 0xff7a2a,
  },
  neon: {
    water: '#0a1020',
    sky: '#0c1229',
    top: 0x3a2a3c,
    top2: 0x45324b,
    seam: 0x1b1220,
    rim: 0x2b2132,
    side: 0x18111f,
    out: 0x080610,
    line: 0x2de6ea,
    edge: 0xff9a3c,
    lamp: 0x2de6ea,
    glow: 0xff9a3c,
  },
  // les quatre mondes (voir worlds.ts) : water = l'étang, sky inutilisé (pas d'horizon)
  cerisiers: {
    water: '#4fb3c2',
    sky: '#7ea35a',
    top: 0xc9945e,
    top2: 0xd4a06a,
    seam: 0x7a4f2c,
    rim: 0xa86f3e,
    side: 0x7a4a26,
    out: 0x3a2314,
    line: 0x6fbf9a,
  },
  bambous: {
    water: '#3f9c94',
    sky: '#5f7f44',
    top: 0xb08a55,
    top2: 0xbb9660,
    seam: 0x6a4a2a,
    rim: 0x9a6a3a,
    side: 0x6b4526,
    out: 0x2a1a10,
    line: 0x5fae6e,
  },
  enneige: {
    water: '#9ed6dc',
    sky: '#e9f1f5',
    top: 0xb4b9bd,
    top2: 0xc2c7ca,
    seam: 0x7a8187,
    rim: 0xeef4f8,
    side: 0x8a939a,
    out: 0x3a4650,
    line: 0x9fd8e8,
  },
  forge: {
    water: '#e2561f',
    sky: '#2b1713',
    top: 0x3a2a26,
    top2: 0x44302b,
    seam: 0x1a0f0d,
    rim: 0x55524f,
    side: 0x2a1c18,
    out: 0x0c0606,
    line: 0xff7a2a,
    edge: 0xff9a3c,
  },
};

// Vie de chaque dojo : espèces de poissons (decor/fish-*.svg), objets flottants (decor/float-*.svg), particules d'ambiance.
export interface Life {
  fish: string[];
  floats: string[];
  amb: string;
  glint: number;
  nFish: number;
  fishA?: number; // opacité des poissons (sous la glace : à peine visibles)
}
export const LIFE: Record<string, Life> = {
  coucher: {
    fish: ['koi_orange', 'koi_blanc', 'koi_or'],
    floats: ['nenuphar', 'fleur'],
    amb: 'petal',
    glint: 0xfbe2b4,
    nFish: 5,
  },
  brume: {
    fish: ['koi_blanc', 'argente', 'carpe_jade'],
    floats: ['nenuphar', 'feuille'],
    amb: 'leaf',
    glint: 0xdfe2d6,
    nFish: 4,
  },
  neon: { fish: ['lanterne'], floats: ['lanterne'], amb: 'firefly', glint: 0x2de6ea, nFish: 5 },
  neige: { fish: ['argente', 'koi_blanc'], floats: ['glace'], amb: 'snow', glint: 0xf6fafc, nFish: 4 },
  bambou: {
    fish: ['carpe_jade', 'koi_or', 'koi_orange'],
    floats: ['nenuphar', 'fleur', 'feuille'],
    amb: 'firefly',
    glint: 0xe9f0c2,
    nFish: 5,
  },
  volcan: { fish: ['braise'], floats: ['lave'], amb: 'ember', glint: 0xff9a3c, nFish: 4 },
  // mondes : objets flottants découpés dans les planches (« monde/nom »), poissons vectoriels
  cerisiers: {
    fish: ['koi_orange', 'koi_blanc', 'koi_or'],
    floats: [
      'cerisiers/nenuphar-a',
      'cerisiers/lotus-rose-a',
      'cerisiers/nenuphar-b',
      'cerisiers/lotus-blanc',
      'cerisiers/nenuphar-c',
    ],
    amb: 'petal',
    glint: 0xe8fbff,
    nFish: 6,
  },
  bambous: {
    fish: ['carpe_jade', 'koi_or', 'koi_orange'],
    floats: ['bambous/nenuphars', 'bambous/nenuphars-lotus', 'bambous/lotus', 'bambous/nenuphars-sombres'],
    amb: 'firefly',
    glint: 0xe9f0c2,
    nFish: 5,
  },
  enneige: { fish: ['argente', 'koi_blanc'], floats: [], amb: 'snow', glint: 0xffffff, nFish: 4, fishA: 0.3 },
  forge: { fish: ['braise'], floats: [], amb: 'ember', glint: 0xffd36a, nFish: 4 },
};
