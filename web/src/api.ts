// Client de l'API. Le serveur garde les réponses et le chrono : ici, on ne fait que demander.

export type TierInfo = { tier: number; name: string; points: number; emoji: string };
export type Progress =
  | { status: "todo" }
  | { status: "started" }
  | { status: "done"; valid: boolean; canonical: string | null; tier: number | null; points: number };
export type Daily = {
  number: number;
  date: string;
  questions: number;
  seconds: number;
  meters_per_point: number;
  tiers: TierInfo[];
  miss_emoji: string;
  progress: Progress[];
};
export type Started = { idx: number; prompt: string; deadline: string; now: string };
export type AnswerResult = {
  valid: boolean;
  late: boolean;
  canonical: string | null;
  tier: number | null;
  points: number;
  meters: number;
  share: number | null;
};
export type Find = { display: string; tier: number; share: number };
export type QuestionResult = {
  prompt: string;
  players: number;
  mine: (Extract<Progress, { status: "done" }> & { raw: string | null; tier_now: number | null; share: number | null }) | null;
  rare_finds: Find[];
  pepite: { display: string; share: number } | null;
};
export type Results = { number: number; date: string; points: number; meters: number; questions: QuestionResult[] };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Identifiant anonyme du joueur : une partie par jour et par navigateur. */
function playerId() {
  let id = localStorage.getItem("rockfilon.player");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("rockfilon.player", id);
  }
  return id;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "X-Player-Id": playerId(), "Content-Type": "application/json" } });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new ApiError(r.status, typeof body.detail === "string" ? body.detail : "La mine ne répond pas.");
  }
  return r.json();
}

export const api = {
  daily: () => call<Daily>("/api/daily"),
  start: (idx: number) => call<Started>(`/api/daily/question/${idx}/start`, { method: "POST" }),
  answer: (idx: number, text: string) => call<AnswerResult>("/api/answer", { method: "POST", body: JSON.stringify({ idx, text }) }),
  results: () => call<Results>("/api/daily/results"),
};
