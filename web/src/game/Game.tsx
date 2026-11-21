import { animate, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api, type AnswerResult, type Daily } from "@/api";
import { play } from "@/sound";
import type { Tier } from "./geology";
import { meters, replay, sceneLayout, Slots, SoundButton, useViewport } from "./hud";
import { PixelWorld, type Find } from "./PixelWorld";
import { Sprite } from "./Sprite";
import { HELMET, MISS, ORES, PICKAXE } from "./sprites";

const HEADLINES: Record<Tier, string> = {
  1: "Du charbon. Tout le monde y a pensé.",
  2: "Du fer. Solide, mais courant.",
  3: "De l'or ! Bien creusé.",
  4: "Une émeraude ! Peu y ont pensé.",
  5: "Un diamant ! Presque personne.",
  6: "Tu as touché le béryl rouge !",
};

type Phase = "loading" | "playing" | "sending" | "result";

export function Game({ daily, onFinished }: { daily: Daily; onFinished: () => void }) {
  const { w, h } = useViewport();
  const reduce = useReducedMotion();
  const initial = useMemo(() => replay(daily), [daily]);
  const [finds, setFinds] = useState<Find[]>(initial.finds);
  const [slots, setSlots] = useState(initial.slots);
  const [depth, setDepth] = useState(initial.depth); // profondeur atteinte
  const [shown, setShown] = useState(initial.depth); // profondeur affichée, animée vers depth
  const [idx, setIdx] = useState(initial.next);
  const [question, setQuestion] = useState<{ prompt: string; deadline: number } | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [text, setText] = useState("");
  const [sent, setSent] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ key: number; tier: Tier } | null>(null);
  const [flash, setFlash] = useState(0);
  const [scope, animateEl] = useAnimate();
  const input = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  // chaque question : le serveur lance le chrono ; recharger la page ne le remet pas à zéro
  useEffect(() => {
    if (idx >= daily.questions) {
      finished.current();
      return;
    }
    let live = true;
    setPhase("loading");
    setResult(null);
    setText("");
    api
      .start(idx)
      .then((s) => {
        if (!live) return;
        setQuestion({ prompt: s.prompt, deadline: Date.now() + Date.parse(s.deadline) - Date.parse(s.now) });
        setNow(Date.now());
        setPhase("playing");
        requestAnimationFrame(() => input.current?.focus());
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [idx, daily.questions]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "result") nextButton.current?.focus();
  }, [phase]);

  const remaining = question ? Math.max(0, (question.deadline - now) / 1000) : daily.seconds;

  async function submit(answer: string) {
    if (phase !== "playing") return;
    setPhase("sending");
    setSent(answer.trim());
    try {
      const r = await api.answer(idx, answer);
      setResult(r);
      setSlots((s) => s.map((v, i) => (i === idx ? (r.valid ? (r.tier as Tier) : null) : v)));
      setPhase("result");
      if (!r.valid || !r.tier) return play("miss");
      const tier = r.tier as Tier;
      const target = depth + r.meters;
      setDepth(target);
      setFinds((f) => [...f, { depth: target, tier, label: r.canonical ?? answer }]);
      play("pick");
      const strike = () => {
        setBurst({ key: idx, tier });
        if (tier >= 3) play(tier === 6 ? "beryl" : "gem");
        if (reduce) return;
        if (tier === 6) setFlash((n) => n + 1);
        animateEl(scope.current, { x: [0, -6, 6, -4, 4, 0], y: [0, 3, -3, 2, 0, 0] }, { duration: 0.35 });
      };
      if (reduce) {
        setShown(target);
        strike();
      } else animate(shown, target, { duration: 1, ease: "easeInOut", onUpdate: setShown, onComplete: strike });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // temps écoulé : on envoie une réponse vide, comptée 0 par le serveur
  useEffect(() => {
    if (phase === "playing" && question && remaining <= 0) submit("");
  });

  const { wide, px, surface, panelTop, scale } = sceneLayout(w, h, shown);
  const lamp = phase === "playing" || phase === "sending" ? remaining / daily.seconds : 1;
  const last = idx + 1 >= daily.questions;

  return (
    <motion.main ref={scope} className="relative h-dvh overflow-hidden" style={{ "--px": `${px}px` } as CSSProperties}>
      <PixelWorld
        w={w}
        h={h}
        px={px}
        surface={surface}
        scale={scale}
        depth={shown}
        finds={finds.filter((f) => f.depth <= shown + 0.5)}
        lamp={lamp}
        panelTop={panelTop}
        labels={w >= 1100}
        burst={burst}
      />
      {flash > 0 && (
        <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-[#ff2e63]" initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} transition={{ duration: 1.2 }} />
      )}

      <header className="absolute inset-x-0 top-0 px-5 pt-4 md:px-10 md:pt-6">
        <div className="flex items-center justify-between">
          <p className="pixel-shadow font-display text-[30px] leading-none text-primary md:text-[40px]">rockfilon</p>
          <div className="flex items-center gap-2">
            <p className="text-xl text-muted-foreground">Plongée n°{daily.number}</p>
            <SoundButton />
          </div>
        </div>
        <p className="pixel-shadow mt-6 flex items-baseline font-display text-[100px] leading-[0.8] md:mt-10 md:text-[200px]">
          <span className="tabular-nums">{meters(shown)}</span>
          <span className="ml-3 text-[40px] text-muted-foreground md:text-[80px]">m</span>
        </p>
        <div className="mt-4">
          <Slots slots={slots} current={idx} />
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-0 px-5 pb-6 md:px-10" style={{ top: panelTop }} aria-labelledby="question">
        <div className="mx-auto flex h-full max-w-4xl flex-col justify-center gap-5">
          {error ? (
            <div className="flex flex-col items-start gap-4">
              <p className="font-display text-[40px] leading-none">Éboulement : {error}</p>
              <button type="button" onClick={() => location.reload()} className="pixel-button h-14 bg-primary px-5 font-display text-[30px] text-primary-foreground">
                Recharger
              </button>
            </div>
          ) : (
            <>
              <h1 id="question" className="pixel-shadow min-h-[1em] font-display text-[40px] leading-[0.9] text-balance md:text-[80px]">
                {question?.prompt ?? "…"}
              </h1>
              {phase === "result" && result ? (
                <motion.div
                  key={idx}
                  className="flex flex-wrap items-center gap-x-5 gap-y-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={result.valid ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }}
                  transition={{ duration: 0.35 }}
                >
                  <Sprite def={result.valid && result.tier ? ORES[result.tier as Tier] : MISS} px={wide ? 5 : 4} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[40px] leading-none">
                      {result.valid && result.tier ? HEADLINES[result.tier as Tier] : result.late || !sent ? "Ta lampe s'est éteinte." : "Filon épuisé."}
                    </p>
                    <p className="mt-2 text-xl text-muted-foreground">
                      {result.valid
                        ? `« ${result.canonical} » · +${result.points} points · +${meters(result.meters)} m · ${result.share} % des mineurs`
                        : sent
                          ? `« ${sent} » n'est pas dans le filon. 0 point, tu restes sur place.`
                          : "Temps écoulé : 0 point, tu restes sur place."}
                    </p>
                  </div>
                  <button
                    ref={nextButton}
                    type="button"
                    onClick={() => setIdx((i) => i + 1)}
                    className="pixel-button flex h-14 items-center gap-2 bg-primary px-4 font-display text-[30px] leading-none text-primary-foreground"
                  >
                    {last ? "Remonter à la surface" : "Creuser plus profond"}
                  </button>
                </motion.div>
              ) : (
                <>
                  <form
                    className="flex gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (text.trim()) submit(text);
                    }}
                  >
                    <label htmlFor="answer" className="sr-only">
                      Ta réponse
                    </label>
                    <input
                      ref={input}
                      id="answer"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={phase !== "playing"}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="send"
                      maxLength={100}
                      placeholder="Ta réponse…"
                      className="pixel-frame pixel-input h-14 min-w-0 flex-1 bg-muted px-4 text-xl text-foreground caret-primary placeholder:text-muted-foreground disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={phase !== "playing" || !text.trim()}
                      className="pixel-button flex h-14 items-center gap-2 bg-primary px-4 font-display text-[30px] leading-none text-primary-foreground disabled:opacity-60"
                    >
                      <Sprite def={PICKAXE} px={2} />
                      Creuser
                    </button>
                  </form>
                  <div className="flex items-center gap-3">
                    <Sprite def={HELMET} px={wide ? 3 : 2} style={{ "--lamp-fill": `rgba(255,198,92,${0.3 + 0.7 * lamp})` } as CSSProperties} />
                    <div className="flex flex-1 gap-[2px]" role="presentation">
                      {Array.from({ length: daily.seconds }, (_, i) => (
                        <span
                          key={i}
                          className={`h-[calc(var(--px)*3)] flex-1 ${i < Math.ceil(remaining) ? (remaining <= 5 ? "bg-destructive" : "bg-primary") : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    {/* annonce aux lecteurs d'écran seulement à 10 s et 5 s */}
                    <p className="w-14 text-right font-display text-[30px] leading-none tabular-nums">{Math.ceil(remaining)}&nbsp;s</p>
                    <p className="sr-only" aria-live="polite">
                      {Math.ceil(remaining) === 10 ? "10 secondes" : Math.ceil(remaining) === 5 ? "5 secondes" : ""}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </motion.main>
  );
}
