import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { ORE_NAMES, type Tier } from "./geology";

// Six minerais dessinés à la main, du plus commun au plus rare. viewBox 40×40, aplats sans dégradé.
const SHAPES: Record<Tier, React.ReactNode> = {
  1: (
    <>
      <path d="M7 24 11 12l10-5 10 4 4 11-5 10-13 2z" fill="#1c1b1e" />
      <path d="m11 12 10-5 2 10-9 3z" fill="#2f2d33" />
      <path d="m23 17 8-6 4 11-9 3z" fill="#242227" />
      <path d="m14 20 9-3 3 8-9 9-10-10z" fill="#141316" />
      <path d="m17 10 4-3 1 4z" fill="#55525c" />
    </>
  ),
  2: (
    <>
      <path d="M8 22c0-9 7-15 15-14s12 8 10 16-10 11-17 9c-6-2-8-6-8-11z" fill="#7b3a1d" />
      <path d="M12 18c2-6 8-8 13-7-4 2-8 5-10 11z" fill="#b8642f" />
      <path d="M22 31c5 0 9-3 10-8-3 3-6 5-10 5z" fill="#5a2913" />
      <circle cx="24" cy="23" r="2.3" fill="#4a210f" />
      <circle cx="16" cy="27" r="1.6" fill="#4a210f" />
      <circle cx="28" cy="16" r="1.3" fill="#d4874f" />
    </>
  ),
  3: (
    <>
      <path d="M6 25c0-7 5-11 9-10 2-6 10-7 13-2 6 0 8 7 5 12-1 6-8 8-14 7-7 1-13-2-13-7z" fill="#c38a16" />
      <path d="M15 15c2-6 10-7 13-2-4-1-8 1-10 5z" fill="#f6d24c" />
      <path d="M9 23c1-4 4-5 6-4-2 2-3 5-3 8z" fill="#e8b62c" />
      <path d="M21 31c5 0 10-2 12-6-4 2-8 3-12 3z" fill="#9c6b0c" />
      <circle cx="24" cy="12" r="1.7" fill="#fff2b8" />
    </>
  ),
  4: (
    <>
      <path d="m23 12 7-3 4 4-1 17-6 3-5-4z" fill="#0e5c35" />
      <path d="m27 33 6-3 1-17-4 3z" fill="#0b4a2b" />
      <path d="m10 14 4-6h10l4 6v17l-4 5H14l-4-5z" fill="#14894f" />
      <path d="m10 14 4-6v28l-4-5z" fill="#0c5a33" />
      <path d="M14 8h10v28H14z" fill="#1fae64" />
      <path d="M14 8h10l-2 4h-6z" fill="#8ff2bf" />
      <path d="M16 15h2v14h-2z" fill="#5fe0a0" />
    </>
  ),
  5: (
    <>
      <path d="m20 4 14 14-14 18L6 18z" fill="#8fd3ef" />
      <path d="m20 4 14 14H20z" fill="#e3f7ff" />
      <path d="M20 4v14H6z" fill="#b6e7fb" />
      <path d="M6 18h14v18z" fill="#5aaed3" />
      <path d="M20 18h14L20 36z" fill="#79c3e4" />
      <path d="m31 6 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fff" />
    </>
  ),
  6: (
    <>
      <path d="m24 13 7-3 4 4-1 15-6 3-5-4z" fill="#7d0c2e" />
      <path d="m10 14 4-7h10l4 7v17l-4 5H14l-4-5z" fill="#c4114f" />
      <path d="m10 14 4-7v29l-4-5z" fill="#8e0d34" />
      <path d="M14 7h10v29H14z" fill="#ee2a68" />
      <path d="M14 7h10l-2 4h-6z" fill="#ffb3c8" />
      <path d="M16 14h2v15h-2z" fill="#ff7aa2" />
      <path d="m4 30 4-5 5 2 1 6-5 3z" fill="#b10e48" />
      <path d="m4 30 4-5 1 9z" fill="#ff5c8a" />
    </>
  ),
};

type OreProps = SVGProps<SVGSVGElement> & { tier: Tier; size?: number };

export function Ore({ tier, size = 40, className, ...props }: OreProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={ORE_NAMES[tier]}
      className={cn(tier === 6 && "beryl-glow", className)}
      {...props}
    >
      {SHAPES[tier]}
    </svg>
  );
}

export function Pickaxe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path d="M3 11Q15 1 29 9l-1.5 2.5Q16 5 4.5 13.5z" fill="currentColor" />
      <path d="m14.5 7.5 3-1.2 9 22-3 1.2z" fill="currentColor" />
    </svg>
  );
}

/** Casque de mineur dont la lampe faiblit avec le chrono. */
export function Helmet({ lamp, ...props }: SVGProps<SVGSVGElement> & { lamp: number }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path d="M5 21a11 11 0 0 1 22 0z" fill="#5b4a3a" />
      <path d="M2 21h28v3H2z" fill="#3e3228" />
      <path d="M13 9h6v3h-6z" fill="#3e3228" />
      <circle cx="16" cy="15" r="4" fill="var(--primary)" opacity={0.35 + 0.65 * lamp} />
    </svg>
  );
}
