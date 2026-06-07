import { NextRequest } from "next/server";
import { loadModel, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";
import type { ModelProgressUpdate } from "@qvac/sdk";

// ── Model singleton ──────────────────────────────────────────────────────────
// Using globalThis so the loaded model survives Next.js hot-reloads in dev.
const g = globalThis as typeof globalThis & {
  _qvacModelId?: string;
  _qvacLoadingPromise?: Promise<string>;
  _qvacProgress?: number;
  _qvacError?: string;
};

export async function GET() {
  if (g._qvacModelId) {
    return Response.json({ status: "ready", modelId: g._qvacModelId, progress: 100 });
  }
  if (g._qvacLoadingPromise) {
    return Response.json({ status: "loading", progress: g._qvacProgress ?? 0 });
  }
  return Response.json({ status: "idle", progress: 0 });
}

// POST — triggers model load and streams progress as Server-Sent Events.
export async function POST(_req: NextRequest) {
  // Already loaded.
  if (g._qvacModelId) {
    return new Response(
      `data: ${JSON.stringify({ status: "ready", progress: 100 })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        // If already loading in another tab/request, wait for it.
        if (g._qvacLoadingPromise) {
          send({ status: "loading", progress: g._qvacProgress ?? 0 });
          await g._qvacLoadingPromise;
          send({ status: "ready", progress: 100 });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        g._qvacProgress = 0;
        g._qvacError = undefined;

        g._qvacLoadingPromise = loadModel({
          modelSrc: LLAMA_3_2_1B_INST_Q4_0,
          onProgress: (progress: ModelProgressUpdate) => {
            g._qvacProgress = Math.round(progress.percentage);
            send({ status: "loading", progress: g._qvacProgress });
          },
        });

        send({ status: "loading", progress: 0 });

        const modelId = await g._qvacLoadingPromise;
        g._qvacModelId = modelId;
        g._qvacLoadingPromise = undefined;
        g._qvacProgress = 100;

        send({ status: "ready", progress: 100 });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err: unknown) {
        g._qvacLoadingPromise = undefined;
        g._qvacProgress = 0;
        const message = err instanceof Error ? err.message : "Failed to load model";
        g._qvacError = message;
        send({ status: "error", error: message });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
