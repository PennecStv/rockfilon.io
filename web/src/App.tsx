import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { api, type Daily } from "@/api";
import { Game } from "@/game/Game";
import { End } from "@/screens/End";
import { Home } from "@/screens/Home";
import { Message } from "@/screens/Message";

type Screen = "home" | "game" | "end";

export default function App() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.daily().then(
      (d) => {
        setDaily(d);
        if (d.progress.every((p) => p.status === "done")) setScreen("end");
      },
      (e: Error) => setError(e.message),
    );
  }, []);

  if (error) return <Message title="La mine est fermée" text={error} />;
  if (!daily) return <Message title="Descente…" />;
  return (
    <MotionConfig reducedMotion="user">
      {screen === "home" && <Home daily={daily} onStart={() => setScreen("game")} />}
      {screen === "game" && <Game daily={daily} onFinished={() => setScreen("end")} />}
      {screen === "end" && <End daily={daily} />}
    </MotionConfig>
  );
}
