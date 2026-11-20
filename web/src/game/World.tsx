import { Ore } from "./Ore";
import { STRATA, wave, type Tier } from "./geology";

export type Find = { depth: number; tier: Tier; label: string };

type Props = {
  w: number;
  h: number;
  surface: number; // y de la surface, en px
  scale: number; // px par mètre
  depth: number;
  finds: Find[];
  lamp: number; // 1 = lampe pleine, 0 = éteinte (le chrono)
  labels: boolean; // noms des couches sur le côté (grands écrans)
};

const STEP = 16;
const darker = "rgba(0,0,0,.32)";
const lighter = "rgba(255,240,220,.07)";

/** La coupe géologique : ciel, chevalement, couches, puits creusé et minerais trouvés. */
export function World({ w, h, surface, scale, depth, finds, lamp, labels }: Props) {
  const y = (m: number) => surface + m * scale;
  const cx = Math.round(w / 2);
  const shaftW = w < 768 ? 44 : 60;
  const xs = Array.from({ length: Math.ceil(w / STEP) + 2 }, (_, i) => i * STEP);

  const boundary = (i: number) => {
    const s = STRATA[i];
    const amp = i === 0 ? 2 : Math.min(9, (s.to - s.from) * scale * 0.12);
    return xs.map((x) => [x, y(s.from) + wave(x, i, amp)] as const);
  };
  const layers = STRATA.map((s, i) => {
    const top = boundary(i);
    const bottom = i + 1 < STRATA.length ? [...boundary(i + 1)].reverse() : [[w + STEP, h + 40] as const, [0, h + 40] as const];
    return { s, i, d: "M" + [...top, ...bottom].map(([x, yy]) => `${x} ${yy.toFixed(1)}`).join("L") + "Z" };
  });

  // puits aux parois irrégulières, de la surface au front de taille
  const bottomY = y(depth);
  const ys = Array.from({ length: Math.max(2, Math.ceil((bottomY - surface) / 12)) + 1 }, (_, i) =>
    Math.min(bottomY, surface + i * 12),
  );
  const jitter = (yy: number, k: number) => 2.5 * Math.sin(yy / 9 + k) + 1.5 * Math.sin(yy / 23 + 2 * k);
  const left = ys.map((yy) => `${(cx - shaftW / 2 + jitter(yy, 1)).toFixed(1)} ${yy.toFixed(1)}`);
  const right = [...ys].reverse().map((yy) => `${(cx + shaftW / 2 + jitter(yy, 4)).toFixed(1)} ${yy.toFixed(1)}`);
  const shaft = `M${left.join("L")}Q${cx} ${bottomY + 14} ${right[0]}L${right.join("L")}Z`;

  const y0 = y(0);
  const radius = 80 + 240 * lamp;

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <svg width={w} height={h} className="absolute inset-0">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2={y0} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0c1016" />
            <stop offset="1" stopColor="#1f2733" />
          </linearGradient>
          {STRATA.map((s, i) => (
            <linearGradient key={s.name} id={`g${i}`} x1="0" x2="0" y1={y(s.from)} y2={y(Math.min(s.to, 2900))} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={s.top} />
              <stop offset="1" stopColor={s.bottom} />
            </linearGradient>
          ))}
          <linearGradient id="magma" x1="0" x2="0" y1={y(2500)} y2={y(3000)} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff4d1f" stopOpacity="0" />
            <stop offset="1" stopColor="#ff5a1f" stopOpacity=".55" />
          </linearGradient>
          {/* motifs lithologiques des coupes géologiques : briques du calcaire, points du grès, croix du granite… */}
          <pattern id="humus" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="6" r="1.3" fill={darker} />
            <circle cx="15" cy="17" r="1" fill={darker} />
            <path d="M18 2q3 5 0 10" stroke={darker} strokeWidth="1.4" fill="none" />
            <circle cx="9" cy="19" r="1" fill={lighter} />
          </pattern>
          <pattern id="argile" width="44" height="16" patternUnits="userSpaceOnUse">
            <path d="M2 4h24M22 12h20" stroke={darker} strokeWidth="1.5" />
          </pattern>
          <pattern id="calcaire" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 .75h40M0 10.75h40M.75 0v10M20.75 10v10" stroke={darker} strokeWidth="1.5" />
            <path d="M3 3h14" stroke={lighter} strokeWidth="1" />
          </pattern>
          <pattern id="gres" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r="1.1" fill={darker} />
            <circle cx="10" cy="9" r="1.1" fill={darker} />
            <circle cx="6" cy="12" r=".9" fill={lighter} />
          </pattern>
          <pattern id="schiste" width="36" height="14" patternUnits="userSpaceOnUse">
            <path d="M2 5q4-3 8 0t8 0M18 12q4-3 8 0t8 0" stroke={darker} strokeWidth="1.4" fill="none" />
          </pattern>
          <pattern id="granite" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M5 8h6M8 5v6M25 18h6M28 15v6M11 30h6M14 27v6" stroke={darker} strokeWidth="1.5" />
            <path d="m30 31 3 4 3-4" stroke={lighter} strokeWidth="1.3" fill="none" />
          </pattern>
          <pattern id="magma" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="m4 6 3 5 3-5M18 20l3 5 3-5" stroke="rgba(255,110,60,.28)" strokeWidth="1.4" fill="none" />
          </pattern>
        </defs>

        <rect width={w} height={y0 + 4} fill="url(#sky)" />
        {[60, 140, 230, 310, 420, 520, 640, 760, 880, 1010, 1150, 1290].map((x, i) =>
          x < w ? <circle key={x} cx={x} cy={18 + ((i * 37) % Math.max(20, y0 - 40))} r={i % 3 ? 1 : 1.5} fill="#f3e9d6" opacity=".35" /> : null,
        )}

        {layers.map(({ s, i, d }) => (
          <g key={s.name}>
            <path d={d} fill={`url(#g${i})`} />
            <path d={d} fill={`url(#${s.pattern})`} />
          </g>
        ))}
        <rect y={y(2500)} width={w} height={Math.max(0, h - y(2500))} fill="url(#magma)" />

        {/* herbe et chevalement au-dessus du puits */}
        <path
          d={`M0 ${y0 + 3}` + xs.map((x) => `L${x} ${(y0 - 3 - (x % 48 === 0 ? 4 : 0)).toFixed(1)}`).join("") + `L${w + STEP} ${y0 + 3}Z`}
          fill="#34512b"
        />
        <g stroke="#3a404b" strokeWidth="4" fill="none" strokeLinecap="square" transform={`translate(${cx} ${y0}) scale(${w < 768 ? 0.6 : 1})`}>
          <path d="M-26 0-5-66M26 0 5-66M-18-22h36M-11-44h22" />
          <circle cy="-72" r="9" strokeWidth="3" />
        </g>

        <path d={shaft} fill="#0b0807" />
        <path d={`M${cx} ${y0 - 72 * (w < 768 ? 0.6 : 1)}V${bottomY - 16}`} stroke="#4a443d" strokeWidth="1.5" />
      </svg>

      {/* obscurité : seule la lampe éclaire ; elle faiblit avec le temps */}
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background: `radial-gradient(circle at ${cx}px ${bottomY - 8}px, transparent 0, transparent ${radius * 0.3}px, rgba(6,4,3,.5) ${radius}px, rgba(6,4,3,.68) ${radius * 2}px)`,
        }}
      />
      <span
        className="absolute size-2 rounded-full bg-[#fff3c4]"
        style={{ left: cx - 4, top: bottomY - 14, boxShadow: `0 0 ${10 + 20 * lamp}px ${4 + 8 * lamp}px rgba(255,198,92,${0.35 + 0.4 * lamp})` }}
      />

      {finds.map((f, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const size = w < 768 ? 34 : 40;
        const top = y(f.depth) - size / 2 - 4;
        const wall = cx + side * (shaftW / 2 - 2);
        return (
          <div
            key={f.depth}
            className="absolute flex items-center gap-2"
            style={{
              top,
              left: side < 0 ? undefined : wall - size / 2,
              right: side < 0 ? w - wall - size / 2 : undefined,
              flexDirection: side < 0 ? "row-reverse" : "row",
            }}
          >
            <Ore tier={f.tier} size={size} />
            <span className="bg-face/85 px-2 py-0.5 text-[15px] leading-6 whitespace-nowrap">{f.label}</span>
          </div>
        );
      })}

      {labels &&
        STRATA.map((s) => {
          const top = y(s.from);
          const height = (Math.min(s.to, 3000) - s.from) * scale;
          if (height < 30 || top > h - 40) return null;
          return (
            <p key={s.name} className="absolute right-8 text-right text-[15px] leading-5 text-foreground/80" style={{ top: top + Math.min(height / 2, 140) - 10 }}>
              {s.name} <span className="text-muted-foreground tabular-nums">{s.from.toLocaleString("fr-FR")} m</span>
            </p>
          );
        })}
    </div>
  );
}
