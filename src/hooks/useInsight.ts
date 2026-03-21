"use client";

import { useState, useCallback } from "react";

export function useInsight() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestInsight = useCallback(
    async (metric: string, data: unknown[], timeScale: string, context?: string) => {
      setResponse("");
      setError(null);
      setLoading(true);

      try {
        const res = await fetch("/api/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metric, data, timeScale, context }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) {
                setResponse((prev) => prev + parsed.text);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResponse("");
    setError(null);
    setLoading(false);
  }, []);

  return { requestInsight, response, loading, error, reset };
}
