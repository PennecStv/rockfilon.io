import { useEffect, useState, type CSSProperties } from "react";
import { api, type Daily, type Results } from "@/api";
import type { Tier } from "@/game/geology";
import { meters, sceneLayout, Slots, SoundButton, useViewport } from "@/game/hud";
import { PixelWorld, type Find } from "@/game/PixelWorld";
import { Sprite } from "@/game/Sprite";
import { MISS, ORES } from "@/game/sprites";
import { Message } from "./Message";

/** Texte de partage façon Wordle : la profondeur et un carré par question, sans dévoiler les réponses. */
export function shareText(res: Results, daily: Daily, host: string) {
  const emoji = Object.fromEntries(daily.tiers.map((t) => [t.tier, t.emoji]));
  const line = res.questions.map((q) => (q.mine?.valid && q.mine.tier ? emoji[q.mine.tier] : daily.miss_emoji)).join("");
  return `rockfilon #${res.number} — ${new Intl.NumberFormat("fr-FR").format(res.meters)} m ⛏️\n${line}\n${host}`;
}

export function End({ daily }: { daily: Daily }) {
  const { w, h } = useViewport();
  const [res, setRes] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.results().then(setRes, (e: Error) => setError(e.message));
  }, []);

  if (error) return <Message title="Éboulement" text={error} />;
  if (!res) return <Message title="Remontée à la surface…" />;

  let depth = 0;
  const finds: Find[] = [];
  const slots = res.questions.map((q) => {
    if (!q.mine) return null;
    depth += q.mine.points * daily.meters_per_point;
    if (!q.mine.valid || !q.mine.tier) return null;
    finds.push({ depth, tier: q.mine.tier as Tier, label: q.mine.canonical ?? "" });
    return q.mine.tier as Tier;
  });
  const wide = w >= 1100;
  const { px, surface, scale } = sceneLayout(w, h, Math.max(res.meters, 1), 0.96);

  async function copy() {
    const text = shareText(res!, daily, location.host);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copie ton résultat :", text);
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden" style={{ "--px": `${px}px` } as CSSProperties}>
      <PixelWorld w={w} h={h} px={px} surface={surface} scale={scale} depth={res.meters} finds={finds} lamp={1} panelTop={h + 40} labels={false} cxRatio={wide ? 0.24 : 0.5} />

      <header className="absolute top-0 left-0 flex items-center gap-4 px-5 pt-4 md:px-10 md:pt-6">
        <p className="pixel-shadow font-display text-[40px] leading-none text-primary">rockfilon</p>
        <SoundButton />
      </header>

      <section
        className="pixel-frame absolute top-6 right-5 bottom-6 overflow-y-auto bg-face/95 p-8 md:right-10"
        style={{ width: wide ? "min(46rem, 52vw)" : "calc(100% - 40px)" }}
        aria-labelledby="bilan"
      >
        <h1 id="bilan" className="pixel-shadow flex items-baseline font-display text-[100px] leading-[0.8]">
          {meters(res.meters)}
          <span className="ml-3 text-[40px] text-muted-foreground">m</span>
        </h1>
        <p className="mt-4 text-xl">
          Plongée n°{res.number} terminée : {res.points} points. Prochaine plongée demain, dès minuit.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <Slots slots={slots} />
          <button type="button" onClick={copy} className="pixel-button h-12 bg-primary px-4 font-display text-[30px] leading-none text-primary-foreground">
            Partager mon résultat
          </button>
          <p className="text-xl text-primary" aria-live="polite">
            {copied ? "Copié ! Colle-le à tes amis." : ""}
          </p>
        </div>

        <ol className="mt-10 flex flex-col gap-8">
          {res.questions.map((q, i) => {
            const mine = q.mine;
            return (
              <li key={i}>
                <h2 className="font-display text-[40px] leading-[0.9]">{q.prompt}</h2>
                <div className="mt-3 flex items-center gap-3 text-xl">
                  <Sprite def={mine?.valid && mine.tier ? ORES[mine.tier as Tier] : MISS} px={3} className="shrink-0" />
                  <p>
                    {mine?.valid
                      ? `« ${mine.canonical} » : +${mine.points} points, ${mine.share} % des mineurs l'ont trouvé.`
                      : mine?.raw
                        ? `« ${mine.raw} » : filon épuisé.`
                        : "Temps écoulé : ta lampe s'est éteinte."}
                  </p>
                </div>
                {q.pepite && (
                  <p className="mt-2 text-xl text-muted-foreground">
                    Béryl rouge : <span className="text-[#ff7aa2]">{q.pepite.display}</span>, touché par {q.pepite.share} % des mineurs.
                  </p>
                )}
                {q.rare_finds.length > 0 && (
                  <p className="mt-1 text-xl text-muted-foreground">
                    Les autres ont trouvé : {q.rare_finds.map((f) => `${f.display} (${f.share} %)`).join(", ")}.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
