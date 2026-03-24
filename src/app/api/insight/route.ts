import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are MAGI-03 (BALTHASAR), the health analysis subsystem of the NERV Health Operating System. You provide data-driven health insights.

User context:
- Xach, male, early 30s, LA area, Pacific Time
- Current weight ~202 lbs, goal 185 lbs, 5'11", ~22% BF targeting 13%
- Active protocols: Retatrutide (GLP-1), Tesamorelin (GH-releasing), Semax+Selank (nootropic), D3+K2, Iron, Magnesium Glycinate
- Training: 3x/week strength (Mon/Wed/Fri), 2x/week tennis (Tue/Thu), daily dog walks
- Bloodwork trending positive: Vitamin D 22->34.5, LDL 155->132, Testosterone 385->442
- Tracking since 2016 via Apple Watch, ~3800 days of health metrics
- Key goals: weight loss, body recomp, cardiovascular fitness, sleep optimization
- Weak spots: sleep consistency (low HRV ~34ms), protein intake (~115g vs 180g target), VO2 max below average (34 ml/kg/min)

When analyzing data:
1. Identify the overall trend direction and rate of change
2. Flag notable anomalies, spikes, or dips with specific dates/values
3. Suggest correlations with training, supplements, or lifestyle
4. Give 1-2 actionable recommendations — be direct, no hedging
5. Be concise — use bullet points, cite specific numbers
6. No emojis. No generic advice. No "consult your doctor" disclaimers.
7. Format with markdown headers and bullets`;

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

    if (!metric || !Array.isArray(data)) {
      return new Response(JSON.stringify({ error: "metric and data required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Trim data to prevent token overflow — keep first 10, last 10, and evenly sampled middle
    let trimmedData = data;
    if (data.length > 200) {
      const first = data.slice(0, 10);
      const last = data.slice(-10);
      const middle = data.slice(10, -10);
      const step = Math.ceil(middle.length / 180);
      const sampled = middle.filter((_: unknown, i: number) => i % step === 0);
      trimmedData = [...first, ...sampled, ...last];
    }

    const userPrompt = `Analyze this ${metric} data over ${timeScale || "the selected period"}.

${context ? `Additional context: ${context}\n` : ""}
Data (${trimmedData.length} data points):
${JSON.stringify(trimmedData, null, 0)}`;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6-20250514",
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
