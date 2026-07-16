import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type SafetyDecision = {
  decision: "SAFE" | "BORDERLINE" | "UNSAFE";
  confidence: number;
  reason: string;
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function maxModerationScore(scores: Record<string, number>): number {
  return Math.max(
    0,
    ...Object.values(scores || {}).map((value) => Number(value || 0)),
  );
}

function parseSafetyDecision(raw: string): SafetyDecision | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(cleaned);

    if (!["SAFE", "BORDERLINE", "UNSAFE"].includes(parsed?.decision)) {
      return null;
    }

    return {
      decision: parsed.decision,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
      reason: cleanText(parsed.reason || "", 300),
    };
  } catch {
    return null;
  }
}

async function classifyArgument(
  openAiKey: string,
  argumentText: string,
  authorName: string,
): Promise<SafetyDecision | null> {
  const prompt = `
You are the safety moderator for a public sports debate website.

Classify the user-generated Sports Court argument as exactly one of:

SAFE:
A normal sports opinion, criticism, disagreement, tactical argument, historical argument,
or strongly worded but non-abusive discussion focused on sports.

BORDERLINE:
Possibly insulting, hostile, ambiguous, provocative, politically inflammatory,
targeted at a person or group, or otherwise uncertain enough that a human moderator should review it.

UNSAFE:
Hate or dehumanization based on protected traits; racism; antisemitism; targeted harassment;
credible threats; encouragement of violence; celebration of real-world violence against a person;
sexual content; sexual content involving minors; self-harm encouragement; graphic gore;
extremist praise; doxxing; or instructions for serious wrongdoing.

Important:
- Criticism of a coach, player, team, referee, or decision is allowed.
- Sports descriptions may legitimately mention hits, fights, injuries, attacks, or violence in historical context.
- Do not mark ordinary sports language unsafe merely because it contains words such as "kill",
  "destroy", "attack", or "fight" metaphorically.
- Judge both the argument and nickname.
- When genuinely uncertain, choose BORDERLINE rather than SAFE.

Return only JSON:
{"decision":"SAFE|BORDERLINE|UNSAFE","confidence":0.0,"reason":"brief reason"}

Nickname: ${authorName}
Argument: ${argumentText}
`.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 180,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Argument classifier failed:", data);
    return null;
  }

  const outputText =
    data?.output_text ||
    data?.output
      ?.flatMap((item: any) => item?.content || [])
      ?.map((part: any) => part?.text || "")
      ?.join("") ||
    "";

  return parseSafetyDecision(outputText);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { success: false, error: "Method not allowed." });
  }

  try {
    const body = await req.json();

    const mistakeId = cleanText(body?.mistake_id, 50);
    const side = cleanText(body?.side, 20);
    const argumentText = cleanText(body?.argument_text, 800);
    const authorName = cleanText(body?.author_name || "Anonymous fan", 60);

    if (!isUuid(mistakeId)) {
      return respond(400, {
        success: false,
        message: "This Sports Court entry is missing a valid mistake.",
      });
    }

    if (!["prosecution", "defense"].includes(side)) {
      return respond(400, {
        success: false,
        message: "Please choose a valid side.",
      });
    }

    if (argumentText.length < 20) {
      return respond(400, {
        success: false,
        message: "Please write a constructive argument of at least 20 characters.",
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openAiKey || !supabaseUrl || !serviceRoleKey) {
      console.error("Missing required Edge Function secrets.");
      return respond(500, {
        success: false,
        error: "The safety service is not configured.",
      });
    }

    const moderationInput = [
      "SportsMistakes Sports Court user argument",
      `Nickname: ${authorName}`,
      `Argument: ${argumentText}`,
    ].join("\n");

    const [moderationResponse, classifierDecision] = await Promise.all([
      fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: moderationInput,
        }),
      }),
      classifyArgument(openAiKey, argumentText, authorName),
    ]);

    const moderationData = await moderationResponse.json();

    if (!moderationResponse.ok) {
      console.error("OpenAI moderation failed:", moderationData);
      return respond(503, {
        success: false,
        message: "The safety check is temporarily unavailable. Please try again.",
      });
    }

    const moderationResult = moderationData?.results?.[0] || {};
    const categoryScores = moderationResult?.category_scores || {};
    const highestModerationScore = maxModerationScore(categoryScores);

    // Fail safely: classifier failure means human review, not automatic publishing.
    const decision: SafetyDecision = classifierDecision || {
      decision: "BORDERLINE",
      confidence: 0,
      reason: "The secondary safety classifier was unavailable.",
    };

    const rejectUnsafe =
      Boolean(moderationResult?.flagged) ||
      decision.decision === "UNSAFE" ||
      highestModerationScore >= 0.55;

    if (rejectUnsafe) {
      console.warn("Rejected unsafe Sports Court argument:", {
        mistakeId,
        decision,
        highestModerationScore,
        categories: moderationResult?.categories,
      });

      return respond(400, {
        success: false,
        code: "unsafe_argument",
        message:
          "This argument appears to violate the Sports Court safety rules. Please focus respectfully on the play, decision, referee call, strategy, or historical context.",
      });
    }

    const publishAutomatically =
      decision.decision === "SAFE" &&
      decision.confidence >= 0.90 &&
      highestModerationScore < 0.12;

    const status = publishAutomatically ? "approved" : "pending";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: mistake, error: mistakeError } = await supabase
      .from("mistakes")
      .select("id")
      .eq("id", mistakeId)
      .maybeSingle();

    if (mistakeError || !mistake) {
      console.error("Mistake lookup failed:", mistakeError);
      return respond(404, {
        success: false,
        message: "This sports mistake could not be found.",
      });
    }

    const { data, error } = await supabase
      .from("sports_court_arguments")
      .insert({
        mistake_id: mistakeId,
        side,
        argument_text: argumentText,
        author_name: authorName,
        status,
        upvotes: 0,
      })
      .select("id,status")
      .single();

    if (error) {
      console.error("Sports Court insert failed:", error);
      return respond(500, {
        success: false,
        message: "The argument could not be saved. Please try again.",
      });
    }

    return respond(200, {
      success: true,
      argument_id: data.id,
      status: data.status,
      message:
        status === "approved"
          ? "Argument added to Sports Court."
          : "Argument submitted for moderator review.",
    });
  } catch (error) {
    console.error("submit-court-argument error:", error);

    return respond(500, {
      success: false,
      message: "The argument could not be checked. Please try again.",
    });
  }
});
