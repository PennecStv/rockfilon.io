import type { CSSProperties } from "react";
import type { SpriteDef } from "./pixel";

type Props = { def: SpriteDef; px: number; label?: string; className?: string; style?: CSSProperties };

/** Sprite en SVG net (crispEdges), un rectangle par suite de pixels de même couleur. */
export function Sprite({ def, px, label, className, style }: Props) {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const rects = [];
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== ".") rects.push(<rect key={`${x}.${y}`} x={x} y={y} width={end - x} height={1} fill={def.colors[c]} />);
      x = end;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * px}
      height={h * px}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects}
    </svg>
  );
}
