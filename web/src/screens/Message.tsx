/** Écran d'attente ou d'erreur, dans le noir de la mine. */
export function Message({ title, text }: { title: string; text?: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-background p-10">
      <div className="max-w-2xl">
        <h1 className="pixel-shadow font-display text-[80px] leading-[0.9] text-primary">{title}</h1>
        {text && <p className="mt-6 text-xl">{text}</p>}
      </div>
    </main>
  );
}
