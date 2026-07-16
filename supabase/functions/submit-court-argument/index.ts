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

    if (argumentText.length > 800 || authorName.length > 60) {
      return respond(400, {
        success: false,
        message: "The argument or nickname is too long.",
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
      `Side: ${side}`,
      `Argument: ${argumentText}`,
    ].join("\n");

    const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: moderationInput,
      }),
    });

    const moderationData = await moderationResponse.json();

    if (!moderationResponse.ok) {
      console.error("OpenAI moderation failed:", moderationData);
      return respond(503, {
        success: false,
        message: "The safety check is temporarily unavailable. Please try again.",
      });
    }

    const result = moderationData?.results?.[0];
    const categories = result?.categories || {};

    const blockedCategories = [
      "harassment",
      "harassment/threatening",
      "hate",
      "hate/threatening",
      "sexual",
      "sexual/minors",
      "self-harm",
      "self-harm/intent",
      "self-harm/instructions",
      "violence",
      "violence/graphic",
      "illicit",
      "illicit/violent",
    ];

    const blocked = Boolean(result?.flagged) ||
      blockedCategories.some((category) => categories[category] === true);

    if (blocked) {
      console.warn("Blocked Sports Court argument:", {
        mistakeId,
        side,
        categories,
      });

      return respond(400, {
        success: false,
        code: "unsafe_argument",
        message:
          "This argument appears to violate the Sports Court safety rules. Please focus respectfully on the play, decision, referee call, strategy, or historical context.",
      });
    }

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
        status: "approved",
        upvotes: 0,
      })
      .select("id")
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
      message: "Argument added to Sports Court.",
    });
  } catch (error) {
    console.error("submit-court-argument error:", error);

    return respond(500, {
      success: false,
      message: "The argument could not be checked. Please try again.",
    });
  }
});
