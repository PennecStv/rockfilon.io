import { useEffect, useState, type CSSProperties } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PixelWorld, type Find } from "./PixelWorld";
import { Sprite } from "./Sprite";
import { HELMET, ORES, PICKAXE, SPEAKER } from "./sprites";
import { ORE_NAMES } from "./geology";

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
  const px = wide ? 4 : 3; // un pixel de la scène = 3 ou 4 px écran
  const surface = wide ? 322 : 250;
  const panelTop = Math.round(h * (wide ? 0.66 : 0.6));
  const front = panelTop - (wide ? 64 : 48);
  const scale = Math.min(0.6, (front - surface) / Math.max(DEPTH, 1)); // tout le puits reste visible
  const lamp = SECONDS_LEFT / SECONDS;

  return (
    <main className="relative h-dvh overflow-hidden" style={{ "--px": `${px}px` } as CSSProperties}>
      <PixelWorld w={w} h={h} px={px} surface={surface} scale={scale} depth={DEPTH} finds={FINDS} lamp={lamp} panelTop={panelTop} labels={w >= 1100} />

      <header className="absolute inset-x-0 top-0 px-5 pt-4 md:px-10 md:pt-6">
        <div className="flex items-center justify-between">
          <p className="pixel-shadow font-display text-[30px] leading-none text-primary md:text-[40px]">rockfilon</p>
          <div className="flex items-center gap-2">
            <p className="text-xl text-muted-foreground">Plongée n°12</p>
            <button type="button" aria-label="Couper le son" aria-pressed="false" className="-mr-2.5 grid size-11 place-items-center text-foreground hover:text-primary">
              <Sprite def={SPEAKER} px={2} />
            </button>
          </div>
        </div>
        <p className="pixel-shadow mt-6 flex items-baseline font-display text-[100px] leading-[0.8] md:mt-10 md:text-[200px]">
          <NumberTicker value={DEPTH} startValue={800} />
          <span className="ml-3 text-[40px] text-muted-foreground md:text-[80px]">m</span>
        </p>
        <ol className="mt-4 flex gap-[calc(var(--px)*2)]" aria-label="Minerai de chaque question">
          {FINDS.map((f, i) => (
            <li key={i} className="pixel-frame grid size-7 place-items-center bg-face">
              <Sprite def={ORES[f.tier]} px={2} label={ORE_NAMES[f.tier]} />
            </li>
          ))}
          <li className="pixel-frame grid size-7 place-items-center bg-primary text-primary-foreground">
            <Sprite def={PICKAXE} px={2} />
            <span className="sr-only">Question en cours</span>
          </li>
        </ol>
      </header>

      <section className="absolute inset-x-0 bottom-0 px-5 pb-6 md:px-10" style={{ top: panelTop }} aria-labelledby="question">
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-5">
          <h1 id="question" className="pixel-shadow font-display text-[40px] leading-[0.9] text-balance md:text-[80px]">
            Cite un instrument à&nbsp;cordes
          </h1>
          <form className="flex gap-3" onSubmit={(e) => e.preventDefault()}>
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
              className="pixel-frame pixel-input h-14 min-w-0 flex-1 bg-muted px-4 text-xl text-foreground caret-primary placeholder:text-muted-foreground"
            />
            <button type="submit" className="pixel-button flex h-14 items-center gap-2 bg-primary px-4 font-display text-[30px] leading-none text-primary-foreground">
              <Sprite def={PICKAXE} px={2} />
              Creuser
            </button>
          </form>
          <div className="flex items-center gap-3">
            <Sprite def={HELMET} px={wide ? 3 : 2} style={{ "--lamp-fill": `rgba(255,198,92,${0.3 + 0.7 * lamp})` } as CSSProperties} />
            <div className="flex flex-1 gap-[2px]" role="presentation">
              {Array.from({ length: SECONDS }, (_, i) => (
                <span key={i} className={`h-[calc(var(--px)*3)] flex-1 ${i < SECONDS_LEFT ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <p className="w-14 text-right font-display text-[30px] leading-none tabular-nums" aria-live="polite">
              {SECONDS_LEFT}&nbsp;s
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
