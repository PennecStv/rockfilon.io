import { useEffect, useRef } from "react";
import { STRATA, wave, type PatternId, type Tier } from "./geology";
import { bayer, hash, mix, rgb, shade, type RGB, type SpriteDef } from "./pixel";
import { Sprite } from "./Sprite";
import { HEADFRAME, ORES } from "./sprites";

export type Find = { depth: number; tier: Tier; label: string };

type Props = {
  w: number;
  h: number;
  px: number; // taille d'un pixel de la scène, en px écran
  surface: number; // y de la surface (px écran)
  scale: number; // px écran par mètre
  depth: number;
  finds: Find[];
  lamp: number; // 1 = lampe pleine, 0 = éteinte : c'est le chrono
  panelTop: number; // haut du front de taille (px écran)
  labels: boolean; // noms des couches sur le côté (grands écrans)
};

const SKY = ["#0a0d13", "#0f131c", "#151b26", "#1d2532"].map(rgb);
const STAR = rgb("#cfc8ba");
const STAR_DIM = rgb("#6f6b66");
const GRASS = ["#66923d", "#4a6e30", "#33502a"].map(rgb);
const VOID = rgb("#0b0807");
const RIM = rgb("#2a1f17");
const ROPE = rgb("#7d6f5f");
const LAMP = rgb("#ffc65c");
const BERYL = rgb("#ff2e63");
const MAGMA = [rgb("#ff7a26"), rgb("#ffb347")];
const TONES = STRATA.map((s) => s.tones.map(rgb));
const SHAFT_HALF = 7;
const ORE = 12; // taille des sprites de minerai

/** Motifs lithologiques des coupes géologiques, pixel par pixel : -1 ombre, 1 reflet. */
function texture(p: PatternId, x: number, y: number): -1 | 0 | 1 {
  switch (p) {
    case "humus": {
      const r = hash(x, y, 1);
      return r < 0.07 ? -1 : r > 0.975 ? 1 : 0;
    }
    case "argile":
      return y % 5 === 0 && (x + Math.floor(y / 5) * 7) % 14 < 8 ? -1 : 0;
    case "calcaire": {
      const off = (x + (Math.floor(y / 6) % 2) * 6) % 12;
      if (y % 6 === 0 || off === 0) return -1;
      return y % 6 === 1 && off > 1 && off < 6 ? 1 : 0;
    }
    case "gres": {
      const r = hash(x, y, 2);
      return r < 0.1 ? -1 : r > 0.96 ? 1 : 0;
    }
    case "schiste":
      return (y + (Math.floor(x / 6) % 2)) % 4 === 0 && x % 11 < 8 ? -1 : 0;
    case "granite": {
      const lx = x % 7;
      const ly = y % 7;
      const cross = (lx === 3 && ly >= 2 && ly <= 4) || (ly === 3 && lx >= 2 && lx <= 4);
      if (cross && hash(Math.floor(x / 7), Math.floor(y / 7), 3) < 0.5) return -1;
      return hash(x, y, 4) < 0.04 ? 1 : 0;
    }
    case "magma": {
      const r = hash(x, y, 5);
      return r < 0.05 ? 1 : r < 0.12 ? -1 : 0;
    }
  }
}

function drawSprite(ctx: CanvasRenderingContext2D, def: SpriteDef, x0: number, y0: number) {
  def.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = def.colors[ch];
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }),
  );
}

/** La coupe géologique en pixel art : dessinée en basse résolution puis agrandie sans lissage. */
export function PixelWorld({ w, h, px, surface, scale, depth, finds, lamp, panelTop, labels }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = Math.ceil(w / px);
  const H = Math.ceil(h / px);
  const S = Math.round(surface / px);
  const k = scale / px; // pixels de scène par mètre
  const Y = (m: number) => S + m * k;
  const cx = Math.floor(W / 2);
  const B = Math.round(Y(depth)); // fond du puits
  const lampY = B - 3;

  // minerais incrustés dans les parois, en alternance, sans se chevaucher
  const lastTop = { [-1]: -99, [1]: -99 } as Record<number, number>;
  const ores = finds.map((f, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const top = Math.max(S + 2, Math.round(Y(f.depth)) - ORE + 1, lastTop[side] + ORE + 1);
    lastTop[side] = top;
    const x = side < 0 ? cx - SHAFT_HALF - ORE + 4 : cx + SHAFT_HALF - 3;
    return { ...f, side, x, y: top };
  });

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const data = img.data;
    const PT = Math.round(panelTop / px);
    const R = (80 + 260 * lamp) / px;
    const ground = Int32Array.from({ length: W }, (_, x) => S - (hash(Math.floor(x / 5), 0, 9) < 0.3 ? 1 : 0));
    const jag = Int32Array.from({ length: W }, (_, x) => Math.floor(hash(Math.floor(x / 3), 1, 11) * 4));
    const bnd = STRATA.map((s, i) =>
      Int32Array.from({ length: W }, (_, x) =>
        i === 0 ? S + 1 : Math.round(Y(s.from) + wave(x * px, i, Math.min(9, (s.to - s.from) * scale * 0.12)) / px),
      ),
    );
    const beryl = ores.find((o) => o.tier === 6);
    const bx = beryl ? beryl.x + ORE / 2 : 0;
    const by = beryl ? beryl.y + ORE / 2 : 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = ground[x];
        let c: RGB;
        if (y < g - 1) {
          // ciel de nuit, tramé vers l'horizon
          c = SKY[Math.max(0, Math.min(3, Math.floor((y / Math.max(1, g)) * 4 + bayer(x, y) - 0.5)))];
          const r = hash(x, y, 7);
          if (r < 0.0015) c = STAR;
          else if (r < 0.004) c = STAR_DIM;
        } else if (y <= g) {
          c = y === g ? GRASS[1] : hash(x, 3, 8) < 0.4 ? GRASS[0] : SKY[3];
        } else if (y === g + 1) {
          c = GRASS[2];
        } else {
          let i = 0;
          while (i + 1 < STRATA.length && y >= bnd[i + 1][x]) i++;
          const top = bnd[i][x];
          const bottom = i + 1 < STRATA.length ? bnd[i + 1][x] : Math.round(Y(STRATA[i].to));
          const t = Math.min(1, (y - top) / Math.max(1, bottom - top));
          const tone = 1 + Math.max(0, Math.min(2, Math.floor(t * 3 + bayer(x, y) - 0.5))); // dégradé tramé
          const tex = texture(STRATA[i].pattern, x, y);
          c = tex === 1 ? TONES[i][0] : tex === -1 ? shade(TONES[i][tone], 0.7) : TONES[i][tone];
          const m = (y - S) / k;
          if (m > 2550 && bayer(x, y) < (m - 2550) / 450) c = MAGMA[hash(x, y, 6) < 0.3 ? 1 : 0];
        }

        // le puits, aux parois irrégulières
        if (y > g && y <= B) {
          const narrow = y > B - 2 ? (y - B + 2) * 2 : 0;
          const L = cx - SHAFT_HALF + Math.floor(hash(0, Math.floor(y / 3), 12) * 3) - 1 + narrow;
          const Rr = cx + SHAFT_HALF + Math.floor(hash(1, Math.floor(y / 3), 13) * 3) - 1 - narrow;
          if (x >= L && x <= Rr) c = x === L || x === Rr ? RIM : VOID;
        }
        if (x === cx && y >= S - 14 && y <= B - 5) c = ROPE;

        // éclairage : la lampe par paliers tramés ; le front de taille reste dans l'ombre
        if (y > g) {
          if (y >= PT + jag[x]) {
            const dy = y - lampY;
            const beam = dy > 0 && Math.abs(x - cx) < dy * 0.9 + 3 ? Math.max(0, 1 - (y - PT) / (H - PT)) * lamp : 0;
            const f = y === PT + jag[x] ? 0.45 : [0.13, 0.19, 0.26, 0.33][Math.min(3, Math.floor(beam * 3 + bayer(x, y)))];
            c = shade(c, f);
          } else {
            const d = Math.hypot(x - cx, (y - lampY) * 1.15);
            const light = 1 - Math.min(1, Math.max(0, (d - R * 0.35) / (R * 0.65)));
            const lvl = Math.min(3, Math.floor(light * 3 + bayer(x, y)));
            c = shade(lvl === 3 ? mix(c, LAMP, 0.1) : c, [0.4, 0.56, 0.78, 1][lvl]);
          }
        }
        // halo du béryl rouge, visible même dans le noir
        if (beryl) {
          const d = Math.hypot(x - bx, y - by);
          if (d < 10 && bayer(x, y) < (1 - d / 10) * 0.75) c = mix(c, BERYL, 0.5);
        }

        const o = (y * W + x) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    drawSprite(ctx, HEADFRAME, cx - 6, S - 16);
    ctx.fillStyle = "#fff3c4"; // la lampe frontale
    ctx.fillRect(cx - 1, lampY - 1, 2, 2);
  });

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <canvas ref={ref} width={W} height={H} className="pixelated absolute top-0 left-0" style={{ width: W * px, height: H * px }} />
      {ores.map((o) => (
        <div
          key={o.depth}
          className="absolute flex items-center"
          style={{
            top: o.y * px,
            left: o.side > 0 ? o.x * px : undefined,
            right: o.side < 0 ? w - (o.x + ORE) * px : undefined,
            flexDirection: o.side < 0 ? "row-reverse" : "row",
            gap: px * 2,
          }}
        >
          <Sprite def={ORES[o.tier]} px={px} className={o.tier === 6 ? "beryl-blink" : undefined} />
          <span
            className="pixel-plate overflow-hidden px-2 text-xl leading-7 text-ellipsis whitespace-nowrap"
            style={{ maxWidth: (o.side < 0 ? o.x * px : w - (o.x + ORE) * px) - px * 2 - 12 }}
          >
            {o.label}
          </span>
        </div>
      ))}
      {labels &&
        STRATA.map((s) => {
          const top = Y(s.from) * px;
          const height = (Math.min(s.to, 3000) - s.from) * scale;
          if (height < 30 || top > panelTop - 30) return null;
          return (
            <p key={s.name} className="absolute right-10 text-xl text-foreground/85" style={{ top: top + Math.min(height / 2, 140) - 12 }}>
              {s.name} <span className="text-muted-foreground tabular-nums">{s.from.toLocaleString("fr-FR")} m</span>
            </p>
          );
        })}
    </div>
  );
}
