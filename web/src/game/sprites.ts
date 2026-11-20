import type { SpriteDef } from "./pixel";
import type { Tier } from "./geology";

// Minerais 12×12, contour sombre, lumière en haut à gauche.
export const ORES: Record<Tier, SpriteDef> = {
  1: {
    rows: [
      "............",
      "....oooo....",
      "...ollllo...",
      "..olhlmmmoo.",
      ".olhlmmmmmmo",
      ".olmmmmdmmmo",
      ".ommmdmmmmdo",
      ".ommmmmmmddo",
      "..oddmmmdddo",
      "...oodddddo.",
      ".....ooooo..",
      "............",
    ],
    colors: { o: "#09080b", l: "#45414c", h: "#77727f", m: "#2b2930", d: "#1a191e" },
  },
  2: {
    rows: [
      "............",
      "....oooo....",
      "..oollllooo.",
      ".olhllmmmmo.",
      ".ollmmmsmgmo",
      "olmmsmmmmmmo",
      "ommmmgmmsmdo",
      "ommsmmmmmddo",
      ".ommmmmdddo.",
      "..ooddddoo..",
      "....oooo....",
      "............",
    ],
    colors: { o: "#2e1408", l: "#c8733f", h: "#eba574", m: "#9a4a24", d: "#6b2f17", s: "#45200e", g: "#a9aab2" },
  },
  3: {
    rows: [
      "............",
      "............",
      "...oooo.....",
      "..ohhllo.oo.",
      ".ohlllllolho",
      ".olllmllllmo",
      "ollmmmmmmllo",
      "olmmmmmmmmdo",
      ".odmmmmmddo.",
      "..oddddddo..",
      "...oooooo...",
      "............",
    ],
    colors: { o: "#4d3304", h: "#fff4b8", l: "#f7d44c", m: "#e0a82a", d: "#a8720c" },
  },
  4: {
    rows: [
      "....oooo....",
      "...ohhlmo...",
      "..ohllllmo..",
      "..olkllmmo..",
      "..olkllmmo..",
      "..olkllmmo..",
      "..olkllmmo..",
      "..olllllmo..",
      "..olllllmo..",
      "..odllmmdo..",
      "...odddddo..",
      "....ooooo...",
    ],
    colors: { o: "#04231a", h: "#d4ffe6", l: "#2fd07e", k: "#9bf5c6", m: "#179552", d: "#0c5a33" },
  },
  5: {
    rows: [
      "..........w.",
      "...oooooowww",
      "..ohhllmmow.",
      ".ohhlllmmmo.",
      "oggggggggggo",
      ".olllllmmmo.",
      "..olllmmmo..",
      "...ollmmo...",
      "....olmo....",
      ".....oo.....",
      "............",
      "............",
    ],
    colors: { o: "#25617e", h: "#ffffff", l: "#bdeeff", m: "#78c4e6", g: "#e6f8ff", w: "#ffffff" },
  },
  6: {
    rows: [
      "......oo....",
      ".....ohmo...",
      "....ohllmo..",
      "....olklmo..",
      ".oo.olklmo..",
      "ohmoolklmo..",
      "olkmoolklmo.",
      "olkmdolllmo.",
      ".olmdolllmo.",
      ".oddoddddo..",
      "..oooooooo..",
      "............",
    ],
    colors: { o: "#33030f", h: "#ffd3df", l: "#ff3f76", k: "#ffa6bf", m: "#c4114f", d: "#76082a" },
  },
};

// Icônes de l'interface, monochromes (currentColor) sauf la lampe du casque.
export const PICKAXE: SpriteDef = {
  rows: [
    "..hhhhhh....",
    ".hhhhhhhh...",
    "hh..ww..hh..",
    "h....ww..h..",
    "......ww....",
    ".......ww...",
    "........ww..",
    ".........ww.",
    "..........ww",
    "...........w",
  ],
  colors: { h: "currentColor", w: "currentColor" },
};

export const HELMET: SpriteDef = {
  rows: [
    "....oooo....",
    "..oobbbboo..",
    ".obbbllbbbo.",
    ".obbllllbbo.",
    "obbbllllbbbo",
    "obbbbllbbbbo",
    "oooooooooooo",
    ".oooooooooo.",
  ],
  colors: { o: "#3a2e24", b: "#6b5847", l: "var(--lamp-fill)" },
};

export const SPEAKER: SpriteDef = {
  rows: [
    "....s.......",
    "...ss...s...",
    "..sss....s..",
    "ssssss.s..s.",
    "ssssss..s.s.",
    "ssssss..s.s.",
    "ssssss.s..s.",
    "..sss....s..",
    "...ss...s...",
    "....s.......",
  ],
  colors: { s: "currentColor" },
};

// Chevalement au-dessus du puits (dessiné dans le canvas).
export const HEADFRAME: SpriteDef = {
  rows: [
    ".....ooo.....",
    "....owwwo....",
    "....ow.wo....",
    "....owwwo....",
    ".....ooo.....",
    ".....s.s.....",
    "....s...s....",
    "....sssss....",
    "...s.....s...",
    "...s.....s...",
    "..sssssssss..",
    "..s.......s..",
    ".s.........s.",
    ".s.........s.",
    "sssssssssssss",
    "s...........s",
  ],
  colors: { s: "#59616f", o: "#363c47", w: "#8b93a1" },
};
