import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScoreResult {
  credibility: "high" | "medium" | "low";
  urgency: "critical" | "high" | "medium" | "low";
  reasoning: string;
}

const VALID_URGENCY = ["critical", "high", "medium", "low"];
const VALID_CREDIBILITY = ["high", "medium", "low"];

const GEMINI_MODEL = "gemini-3.6-flash";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function scoreReport(description: string, photoUrl: string | null): Promise<ScoreResult> {
  const prompt = `You are triaging a citizen flood report for emergency responders. Given the report description below, return ONLY a JSON object with three fields:
- credibility: 'high', 'medium', or 'low' (does this sound like a genuine, specific report vs vague/spam/unclear?)
- urgency: 'critical', 'high', 'medium', or 'low' (critical = life-threatening/trapped/injured, high = needs help soon, medium = needs help but not life-threatening, low = informational)
- reasoning: one short sentence explaining the urgency level
Report description: ${description}
Return ONLY the JSON, no other text.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];

    if (photoUrl) {
      try {
        const photoResponse = await fetch(photoUrl, { signal: controller.signal });
        if (photoResponse.ok) {
          const contentType = photoResponse.headers.get("content-type") ?? "image/jpeg";
          const photoBytes = new Uint8Array(await photoResponse.arrayBuffer());
          parts.push({ inlineData: { mimeType: contentType, data: bytesToBase64(photoBytes) } });
        }
      } catch {
        // Continue with the description if the optional photo is unavailable.
      }
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const cleanedText = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const urgency = VALID_URGENCY.includes(parsed.urgency)
      ? parsed.urgency
      : "medium";
    const credibility = VALID_CREDIBILITY.includes(parsed.credibility)
      ? parsed.credibility
      : "medium";
    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : "Unable to determine urgency from description.";

    return { urgency, credibility, reasoning };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { location, description, need_type, photo_url, lat, lng } = body;

    if (!location || !description || !need_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportLat = typeof lat === "number" && !isNaN(lat) ? lat : null;
    const reportLng = typeof lng === "number" && !isNaN(lng) ? lng : null;

    let score: ScoreResult;
    let scoreError: string | null = null;
    try {
      score = await scoreReport(description, photo_url ?? null);
    } catch (err) {
      scoreError = err instanceof Error ? err.message : String(err);
      score = {
        urgency: "medium",
        credibility: "medium",
        reasoning: "Automatic scoring unavailable — manual review needed.",
      };
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("reports")
      .insert({
        location,
        description,
        need_type,
        photo_url: photo_url ?? null,
        status: "pending",
        urgency: score.urgency,
        credibility: score.credibility,
        reasoning: score.reasoning,
        lat: reportLat,
        lng: reportLng,
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to save report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, report: data, scoreError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
