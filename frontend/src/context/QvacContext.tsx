"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModelStatus = "idle" | "loading" | "ready" | "error";

interface QvacContextValue {
  status: ModelStatus;
  progress: number;       // 0-100
  error: string | null;
  loadModel: () => Promise<void>;
  complete: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const QvacContext = createContext<QvacContextValue | null>(null);

export function useQvac(): QvacContextValue {
  const ctx = useContext(QvacContext);
  if (!ctx) throw new Error("useQvac must be used within QvacProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function QvacProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // On mount, check if the model is already loaded on the server
  // (survives page refreshes within the same Node.js process lifetime).
  useEffect(() => {
    fetch("/api/inference/load")
      .then(r => r.json())
      .then((data: { status: string; progress: number }) => {
        if (data.status === "ready") {
          setStatus("ready");
          setProgress(100);
        } else if (data.status === "loading") {
          // Another tab triggered a load — resume tracking it.
          setStatus("loading");
          setProgress(data.progress);
        }
      })
      .catch(() => {});
  }, []);

  const loadModel = useCallback(async () => {
    if (loadingRef.current || status === "ready") return;
    loadingRef.current = true;
    setStatus("loading");
    setProgress(0);
    setError(null);

    try {
      const response = await fetch("/api/inference/load", { method: "POST" });
      if (!response.body) throw new Error("No response body from load endpoint");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const event = JSON.parse(payload) as {
              status: string;
              progress?: number;
              error?: string;
            };
            if (event.progress !== undefined) setProgress(event.progress);
            if (event.status === "ready") {
              setStatus("ready");
              setProgress(100);
            } else if (event.status === "error") {
              throw new Error(event.error ?? "Failed to load model");
            }
          } catch (parseErr) {
            // Ignore non-JSON lines
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load model";
      setStatus("error");
      setError(message);
    } finally {
      loadingRef.current = false;
    }
  }, [status]);

  const complete = useCallback(
    async (systemPrompt: string, userPrompt: string): Promise<string> => {
      if (status !== "ready") throw new Error("Model is not loaded yet");

      const response = await fetch("/api/inference/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userPrompt }),
      });

      const data = await response.json() as { text?: string; error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Inference failed");
      }
      return data.text ?? "";
    },
    [status]
  );

  return (
    <QvacContext.Provider value={{ status, progress, error, loadModel, complete }}>
      {children}
    </QvacContext.Provider>
  );
}
