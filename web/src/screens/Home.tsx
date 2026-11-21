import type { CSSProperties } from "react";
import type { Daily } from "@/api";
import { sceneLayout, SoundButton, useViewport } from "@/game/hud";
import { PixelWorld } from "@/game/PixelWorld";
import { Sprite } from "@/game/Sprite";
import { HELMET, ORES, PICKAXE } from "@/game/sprites";

/** Accueil : la surface, la plongée du jour et les règles en trois temps. */
export function Home({ daily, onStart }: { daily: Daily; onStart: () => void }) {
  const { w, h } = useViewport();
  const surface = Math.round(h * 0.52);
  const { px, panelTop, scale } = sceneLayout(w, h, 0, 0.72, surface);
  const started = daily.progress.some((p) => p.status !== "todo");
  const date = new Date(`${daily.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="relative h-dvh overflow-hidden" style={{ "--px": `${px}px` } as CSSProperties}>
      <PixelWorld w={w} h={h} px={px} surface={surface} scale={scale} depth={0} finds={[]} lamp={1} panelTop={panelTop} labels={w >= 1100} />

      <div className="absolute inset-x-0 top-0 flex items-center justify-end px-5 pt-4 md:px-10 md:pt-6">
        <SoundButton />
      </div>

      <section className="absolute top-16 left-5 max-w-[46rem] md:left-10 md:top-14">
        <h1 className="pixel-shadow font-display text-[100px] leading-[0.8] text-primary md:text-[160px]">rockfilon</h1>
        <p className="mt-6 max-w-xl text-xl">
          Chaque jour, 7 questions. Les réponses évidentes grattent la surface, les réponses rares creusent profond.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            onClick={onStart}
            autoFocus
            className="pixel-button flex h-14 items-center gap-3 bg-primary px-5 font-display text-[30px] leading-none text-primary-foreground"
          >
            <Sprite def={PICKAXE} px={2} />
            {started ? "Reprendre la plongée" : "Descendre dans la mine"}
          </button>
          <p className="font-display text-[30px] leading-none text-muted-foreground">
            Plongée n°{daily.number}, {date}
          </p>
        </div>
      </section>

      <section className="absolute inset-x-0 bottom-0 px-5 pb-8 md:px-10" style={{ top: panelTop + 24 }} aria-label="Règles">
        <ol className="mx-auto grid h-full max-w-6xl items-center gap-8 md:grid-cols-3">
          <li className="flex items-start gap-4">
            <Sprite def={HELMET} px={4} className="shrink-0" style={{ "--lamp-fill": "#ffc65c" } as CSSProperties} />
            <p className="text-xl">
              <strong className="block font-display text-[30px] leading-none font-normal">7 questions, 25 secondes</strong>
              Une seule réponse par question : ta lampe s'éteint quand le temps est écoulé.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="flex shrink-0">
              {([1, 3, 5] as const).map((t) => (
                <Sprite key={t} def={ORES[t]} px={3} />
              ))}
            </span>
            <p className="text-xl">
              <strong className="block font-display text-[30px] leading-none font-normal">Plus c'est rare, plus tu creuses</strong>
              Du charbon (5 points) pour une réponse évidente au diamant (85 points) pour celle que personne ne trouve.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <Sprite def={ORES[6]} px={4} className="beryl-blink shrink-0" />
            <p className="text-xl">
              <strong className="block font-display text-[30px] leading-none font-normal">Le béryl rouge</strong>
              Chaque question cache une pépite choisie à la main : 100 points pour qui la touche.
            </p>
          </li>
        </ol>
      </section>
    </main>
  );
}
