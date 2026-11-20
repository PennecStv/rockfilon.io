// La coupe du terrain. Purement visuel : les points et les mètres viennent de l'API (/api/daily).

export type PatternId = "humus" | "argile" | "calcaire" | "gres" | "schiste" | "granite" | "magma";

export type Stratum = {
  name: string;
  from: number; // mètres
  to: number;
  tones: [string, string, string, string]; // reflet, puis trois tons du haut vers le bas de la couche
  pattern: PatternId;
};

export const STRATA: Stratum[] = [
  { name: "Terre végétale", from: 0, to: 60, tones: ["#6b4a30", "#4f3622", "#402b1b", "#322115"], pattern: "humus" },
  { name: "Argile", from: 60, to: 250, tones: ["#a8603a", "#8a4a2c", "#743d24", "#5e311c"], pattern: "argile" },
  { name: "Calcaire", from: 250, to: 600, tones: ["#a39a84", "#857d69", "#706958", "#5b5547"], pattern: "calcaire" },
  { name: "Grès", from: 600, to: 1000, tones: ["#b8844d", "#98693c", "#7e5631", "#644326"], pattern: "gres" },
  { name: "Schiste", from: 1000, to: 1500, tones: ["#62738a", "#485668", "#3a4655", "#2c3642"], pattern: "schiste" },
  { name: "Granite", from: 1500, to: 2200, tones: ["#94787f", "#685b60", "#54494d", "#40373b"], pattern: "granite" },
  { name: "Roche profonde", from: 2200, to: 3400, tones: ["#c2451c", "#4d1c14", "#5a1d10", "#6e1f0c"], pattern: "magma" },
];

export const stratumAt = (m: number) => STRATA.find((s) => m < s.to) ?? STRATA[STRATA.length - 1];

// Palier -> minerai (noms et points : config serveur ; ici seulement l'apparence)
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
export const ORE_NAMES: Record<Tier, string> = {
  1: "Charbon",
  2: "Fer",
  3: "Or",
  4: "Émeraude",
  5: "Diamant",
  6: "Béryl rouge",
};

/** Ondulation déterministe d'une limite de couche (en px écran) : les strates ne sont jamais plates. */
export function wave(x: number, seed: number, amplitude: number) {
  return amplitude * (Math.sin(x / 140 + seed * 1.7) * 0.6 + Math.sin(x / 53 + seed * 3.1) * 0.4);
}
