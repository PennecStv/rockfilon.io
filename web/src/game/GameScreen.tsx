import { useEffect, useState } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Helmet, Ore, Pickaxe } from "./Ore";
import { World, type Find } from "./World";
import type { Tier } from "./geology";

// Données factices de la maquette : plongée n°12, question 7 sur 7, 14 s restantes.
const FINDS: Find[] = [
  { depth: 20, tier: 1, label: "Tibia" },
  { depth: 80, tier: 2, label: "Saint-nectaire" },
  { depth: 220, tier: 3, label: "Locronan" },
  { depth: 460, tier: 4, label: "Huppe fasciée" },
  { depth: 800, tier: 5, label: "Rigaudon" },
  { depth: 1200, tier: 6, label: "Cormier" },
];
const DEPTH = 1200;
const SECONDS_LEFT = 14;
const SECONDS = 25;

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.visualViewport?.height ?? window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener("resize", on);
    window.visualViewport?.addEventListener("resize", on); // clavier mobile
    return () => {
      window.removeEventListener("resize", on);
      window.visualViewport?.removeEventListener("resize", on);
    };
  }, []);
  return vp;
}

export function GameScreen() {
  const { w, h } = useViewport();
  const wide = w >= 768;
  const surface = wide ? 290 : 216; // sous la rangée de minerais
  const panelTop = Math.round(h * (wide ? 0.66 : 0.6));
  const front = panelTop - (wide ? 64 : 48);
  const scale = Math.min(0.6, (front - surface) / Math.max(DEPTH, 1)); // tout le puits reste visible
  const lamp = SECONDS_LEFT / SECONDS;

  return (
    <main className="relative h-dvh overflow-hidden">
      <World w={w} h={h} surface={surface} scale={scale} depth={DEPTH} finds={FINDS} lamp={lamp} labels={wide} />

      <header className="absolute inset-x-0 top-0 px-5 pt-4 md:px-10 md:pt-6">
        <div className="flex items-center justify-between">
          <p className="font-stencil text-2xl leading-none font-extrabold text-primary">rockfilon</p>
          <div className="flex items-center gap-3">
            <p className="font-display text-xl font-bold text-muted-foreground tabular-nums">Plongée n°12</p>
            <button type="button" aria-label="Couper le son" aria-pressed="false" className="grid size-11 place-items-center text-foreground hover:text-primary">
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-3 font-display text-[84px] leading-[0.9] font-extrabold tracking-[-0.02em] md:mt-4 md:text-[150px]">
          <NumberTicker value={DEPTH} startValue={800} />
          <span className="ml-2 text-[40px] text-muted-foreground md:text-[60px]">m</span>
        </p>
        <ol className="mt-3 flex gap-1.5 md:mt-4" aria-label="Minerai de chaque question">
          {[...FINDS.map((f) => f.tier), null].map((tier: Tier | null, i) => (
            <li key={i} className={tier ? "grid size-8 place-items-center bg-face/80" : "grid size-8 place-items-center bg-primary text-primary-foreground"}>
              {tier ? <Ore tier={tier} size={24} /> : <><Pickaxe className="size-5" /><span className="sr-only">Question en cours</span></>}
            </li>
          ))}
        </ol>
      </header>

      <section
        className="absolute inset-x-0 bottom-0 bg-face px-5 pb-6 md:px-10"
        style={{
          top: panelTop,
          // front de taille : bord supérieur cassé, comme une paroi
          clipPath: "polygon(0 14px, 7% 5px, 15% 16px, 24% 3px, 33% 12px, 41% 0, 52% 10px, 61% 2px, 70% 15px, 79% 4px, 88% 13px, 95% 3px, 100% 11px, 100% 100%, 0 100%)",
          backgroundImage: `radial-gradient(ellipse 70% 85% at 50% 0%, rgba(255,198,92,${0.06 + 0.16 * lamp}), transparent 70%)`,
        }}
        aria-labelledby="question"
      >
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-5">
          <h1 id="question" className="font-display text-[40px] leading-[0.95] font-bold tracking-[-0.01em] text-balance md:text-[60px]">
            Cite un instrument à&nbsp;cordes
          </h1>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="answer" className="sr-only">
              Ta réponse
            </label>
            <input
              id="answer"
              defaultValue="théorbe"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              maxLength={100}
              placeholder="Ta réponse…"
              className="h-14 min-w-0 flex-1 bg-muted px-4 text-xl text-foreground caret-primary placeholder:text-muted-foreground focus-visible:outline-offset-0"
            />
            <button
              type="submit"
              className="flex h-14 items-center gap-2 bg-primary px-5 font-display text-2xl font-extrabold text-primary-foreground transition-transform hover:bg-[#ffd27d] active:translate-y-0.5"
            >
              <Pickaxe className="size-6" />
              Creuser
            </button>
          </form>
          <div className="flex items-center gap-3">
            <Helmet lamp={lamp} className="size-8 shrink-0" />
            <div className="h-1.5 flex-1 bg-muted" role="presentation">
              <div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${lamp * 100}%` }} />
            </div>
            <p className="w-14 text-right font-display text-2xl font-bold tabular-nums" aria-live="polite">
              {SECONDS_LEFT}&nbsp;s
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
