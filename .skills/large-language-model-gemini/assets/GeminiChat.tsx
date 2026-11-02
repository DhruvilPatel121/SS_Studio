import { useEffect, useRef, useState } from "react";
import { generateGemini, type Content, type State } from "./gemini-client.mjs";
type Props = {
  endpoint: string;
  anonKey: string;
  modelName: string;
  getAccessToken?: () => Promise<string | null>;
  onSignIn?: () => void;
  userId?: string | null;
};
export function GeminiChat({
  endpoint,
  anonKey,
  modelName,
  getAccessToken,
  onSignIn,
  userId = null,
}: Props) {
  const [input, setInput] = useState(""),
    [answer, setAnswer] = useState(""),
    [notice, setNotice] = useState(""),
    [state, setState] = useState<State | "idle">("idle");
  const history = useRef<Content[]>([]),
    controller = useRef<AbortController | null>(null),
    serial = useRef(0),
    busy = useRef(false);
  useEffect(() => {
    serial.current++;
    controller.current?.abort();
    busy.current = false;
    history.current = [];
    setAnswer("");
    setState("idle");
    setNotice("");
    return () => {
      serial.current++;
      controller.current?.abort();
      busy.current = false;
    };
  }, [userId]);
  const active = state === "waiting" || state === "streaming";
  async function send() {
    if (busy.current || !input.trim()) return;
    busy.current = true;
    const run = ++serial.current;
    const abort = new AbortController();
    controller.current = abort;
    const prompt = input.trim();
    setNotice("");
    setAnswer("");
    setState("waiting");
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Stateless apps need no session lookup. Account-based apps must not silently
      // fall back to an anon request when their selected user's session expires.
      const token = userId
        ? await Promise.race([
            getAccessToken?.() ?? Promise.resolve(null),
            new Promise<never>((_, reject) => {
              authTimer = setTimeout(
                () => reject(new Error("authentication_timeout")),
                10000,
              );
              abort.signal.addEventListener(
                "abort",
                () => reject(new Error("cancelled")),
                { once: true },
              );
            }),
          ])
        : null;
      clearTimeout(authTimer);
      if (run !== serial.current || abort.signal.aborted) return;
      if (userId && !token) throw new Error("authentication_required");
      const contents: Content[] = [
        ...history.current,
        { role: "user", parts: [{ text: prompt }] },
      ];
      const result = await generateGemini({
        endpoint,
        anonKey,
        accessToken: token,
        contents,
        model: modelName,
        signal: abort.signal,
        onText: (_delta, full) => {
          if (run === serial.current) setAnswer(full);
        },
        onState: (s) => {
          if (run === serial.current) setState(s);
        },
      });
      if (run !== serial.current) return;
      history.current = [
        ...contents,
        { role: "model", parts: [{ text: result.text }] },
      ];
      setInput("");
    } catch (error) {
      if (run === serial.current) {
        const e = error as Error & { partialText?: string };
        if (e.partialText) setAnswer(e.partialText);
        setNotice(e.message + " — No automatic retry was sent");
        setState(abort.signal.aborted ? "cancelled" : "failed");
      }
    } finally {
      clearTimeout(authTimer);
      if (run === serial.current) {
        busy.current = false;
        controller.current = null;
        if (abort.signal.aborted) setState("cancelled");
      }
    }
  }
  return (
    <section aria-label="Gemini text generation">
      <p>Model: {modelName}</p>
      {!userId && onSignIn && <button onClick={onSignIn}>Sign in</button>}
      <textarea
        aria-label="Your request"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={active}
      />
      <button onClick={send} disabled={active || !input.trim()}>
        Generate
      </button>
      <button onClick={() => controller.current?.abort()} disabled={!active}>
        Stop
      </button>
      <p role="status">
        {state === "waiting"
          ? "Waiting for reply"
          : state === "streaming"
            ? "LIVE"
            : state}
      </p>
      {notice && <p role="alert">{notice}</p>}
      <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
    </section>
  );
}
