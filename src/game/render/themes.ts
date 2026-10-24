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
};

// Vie de chaque dojo : espèces de poissons (decor/fish-*.svg), objets flottants (decor/float-*.svg), particules d'ambiance.
export interface Life {
  fish: string[];
  floats: string[];
  amb: string;
  glint: number;
  nFish: number;
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
};
