// Outils du pixel art : trame ordonnée (dithering), bruit déterministe, couleurs.

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Seuil de trame de Bayer 4×4, dans [0, 1). Sert aux dégradés et à l'éclairage par paliers. */
export const bayer = (x: number, y: number) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

/** Bruit déterministe dans [0, 1) : la même roche à chaque rendu. */
export function hash(x: number, y: number, seed = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

/** Sprite : une ligne de texte par rangée de pixels, `.` = transparent. */
export type SpriteDef = { rows: string[]; colors: Record<string, string> };
