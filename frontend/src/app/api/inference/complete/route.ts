import { NextRequest } from "next/server";
import { completion } from "@qvac/sdk";

const g = globalThis as typeof globalThis & {
  _qvacModelId?: string;
};

export async function POST(req: NextRequest) {
  if (!g._qvacModelId) {
    return Response.json(
      { error: "Model not loaded. Call POST /api/inference/load first." },
      { status: 400 }
    );
  }

  let systemPrompt: string;
  let userPrompt: string;
  try {
    const body = await req.json() as { systemPrompt?: string; userPrompt?: string };
    systemPrompt = body.systemPrompt ?? "";
    userPrompt = body.userPrompt ?? "";
    if (!systemPrompt || !userPrompt) throw new Error("missing prompts");
  } catch {
    return Response.json(
      { error: "Request body must include systemPrompt and userPrompt" },
      { status: 400 }
    );
  }

  try {
    const run = completion({
      modelId: g._qvacModelId,
      history: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      stream: true,
    });

    const result = await run.final;
    return Response.json({ text: result.contentText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Inference failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
