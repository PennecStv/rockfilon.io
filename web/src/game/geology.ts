// La coupe du terrain. Purement visuel : les points et les mètres viennent de l'API (/api/daily).

export type PatternId = "humus" | "argile" | "calcaire" | "gres" | "schiste" | "granite" | "magma";

export type Stratum = {
  name: string;
  from: number; // mètres
  to: number;
  top: string; // teinte en haut de la couche, assombrie vers le bas
  bottom: string;
  pattern: PatternId;
};

export const STRATA: Stratum[] = [
  { name: "Terre végétale", from: 0, to: 60, top: "#4b3321", bottom: "#352416", pattern: "humus" },
  { name: "Argile", from: 60, to: 250, top: "#7a4329", bottom: "#56301e", pattern: "argile" },
  { name: "Calcaire", from: 250, to: 600, top: "#7b7361", bottom: "#5c5547", pattern: "calcaire" },
  { name: "Grès", from: 600, to: 1000, top: "#86603a", bottom: "#634427", pattern: "gres" },
  { name: "Schiste", from: 1000, to: 1500, top: "#3e4a58", bottom: "#29333f", pattern: "schiste" },
  { name: "Granite", from: 1500, to: 2200, top: "#574b50", bottom: "#3a3236", pattern: "granite" },
  { name: "Roche profonde", from: 2200, to: 3400, top: "#3b1712", bottom: "#6a1a0c", pattern: "magma" },
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

/** Ondulation déterministe d'une limite de couche : les strates ne sont jamais parfaitement plates. */
export function wave(x: number, seed: number, amplitude: number) {
  return amplitude * (Math.sin(x / 140 + seed * 1.7) * 0.6 + Math.sin(x / 53 + seed * 3.1) * 0.4);
}
