import { useEffect, useState } from "react";
import type { Daily } from "@/api";
import { isSoundOn, setSound } from "@/sound";
import type { Find } from "./PixelWorld";
import { Sprite } from "./Sprite";
import { MISS, ORES, PICKAXE, SPEAKER, SPEAKER_OFF } from "./sprites";
import { ORE_NAMES, type Tier } from "./geology";

export function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.visualViewport?.height ?? window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener("resize", on);
    window.visualViewport?.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      window.visualViewport?.removeEventListener("resize", on);
    };
  }, []);
  return vp;
}

/** Géométrie de la scène : l'échelle se resserre avec la profondeur pour que tout le puits reste visible. */
export function sceneLayout(w: number, h: number, depth: number, panelRatio = 0.66, surfaceY?: number) {
  const wide = w >= 768;
  const px = wide ? 4 : 3;
  const surface = surfaceY ?? (wide ? 322 : 250);
  const panelTop = Math.round(h * panelRatio);
  const front = panelTop - (wide ? 64 : 48);
  const scale = Math.min(0.6, (front - surface) / Math.max(depth, 1));
  return { wide, px, surface, panelTop, scale };
}

export const meters = (m: number) => new Intl.NumberFormat("fr-FR").format(Math.round(m)).replace(/ /g, " ");

/** Rejoue la progression renvoyée par l'API : profondeur, minerais trouvés, case de chaque question. */
export function replay(daily: Daily) {
  let depth = 0;
  const finds: Find[] = [];
  const slots: (Tier | null | undefined)[] = daily.progress.map((p) => {
    if (p.status !== "done") return undefined;
    depth += p.points * daily.meters_per_point;
    if (!p.valid || !p.tier) return null;
    finds.push({ depth, tier: p.tier as Tier, label: p.canonical ?? "" });
    return p.tier as Tier;
  });
  const next = daily.progress.findIndex((p) => p.status !== "done");
  return { depth, finds, slots, next: next < 0 ? daily.progress.length : next };
}

export function SoundButton() {
  const [on, setOn] = useState(isSoundOn);
  return (
    <button
      type="button"
      aria-label={on ? "Couper le son" : "Activer le son"}
      aria-pressed={!on}
      onClick={() => {
        setSound(!on);
        setOn(!on);
      }}
      className="-mr-2.5 grid size-11 place-items-center text-foreground hover:text-primary"
    >
      <Sprite def={on ? SPEAKER : SPEAKER_OFF} px={2} />
    </button>
  );
}

export function Slots({ slots, current }: { slots: (Tier | null | undefined)[]; current?: number }) {
  return (
    <ol className="flex gap-[calc(var(--px)*2)]" aria-label="Minerai de chaque question">
      {slots.map((tier, i) => {
        const now = i === current && tier === undefined;
        return (
          <li key={i} className={`pixel-frame grid size-7 place-items-center ${now ? "bg-primary text-primary-foreground" : "bg-face"}`}>
            {tier ? (
              <Sprite def={ORES[tier]} px={2} label={ORE_NAMES[tier]} />
            ) : tier === null ? (
              <Sprite def={MISS} px={2} label="Rien trouvé" />
            ) : now ? (
              <>
                <Sprite def={PICKAXE} px={2} />
                <span className="sr-only">Question en cours</span>
              </>
            ) : (
              <span className="sr-only">À venir</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
