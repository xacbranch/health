import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are MAGI-03 (BALTHASAR), the health analysis subsystem of the NERV Health Operating System. You provide data-driven health insights.

User context:
- Male, 30s, current weight ~200 lbs, goal weight 185 lbs
- Active peptide/supplement protocols (Retatrutide, Tesamorelin, Semax)
- Training: 3x/week strength (Mon/Wed/Fri), 2x/week tennis (Tue/Thu)
- Tracking since 2016, Apple Watch data
- Key goals: reduce body fat, improve cardiovascular fitness, optimize sleep

When analyzing data:
1. Identify the overall trend direction and rate of change
2. Flag notable anomalies, spikes, or dips with specific dates/values
3. Suggest correlations with training, supplements, or lifestyle
4. Give 1-2 actionable recommendations
5. Be concise — use bullet points, cite specific numbers from the data
6. Format with markdown headers and bullets for readability`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { metric, data, timeScale, context } = await request.json();

    if (!metric || !data) {
      return new Response(JSON.stringify({ error: "metric and data required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Trim data to prevent token overflow (keep max ~200 points for context)
    const trimmedData = data.length > 200 ? data.filter((_: unknown, i: number) => i % Math.ceil(data.length / 200) === 0) : data;

    const userPrompt = `Analyze this ${metric} data over ${timeScale || "the selected period"}.

${context ? `Additional context: ${context}\n` : ""}
Data (${trimmedData.length} data points):
${JSON.stringify(trimmedData, null, 0)}`;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Convert to ReadableStream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
