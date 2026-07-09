import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ success: true, message: "CORS OK" }, 200);
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const adminSecret = req.headers.get("x-admin-secret");

    if (adminSecret !== Deno.env.get("ARTWORK_ADMIN_SECRET")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openAiKey) {
      return json({ success: false, error: "Missing OPENAI_API_KEY secret" }, 500);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Missing Supabase environment secrets" }, 500);
    }

    const body = await req.json().catch(() => ({}));

    const mistake_id = body?.mistake_id || null;
    const submission_id = body?.submission_id || null;

    if (!mistake_id && !submission_id) {
      return json({ success: false, error: "Missing mistake_id or submission_id" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let mode = "mistake";
    let record: any = null;

    if (submission_id) {
      mode = "submission";

      const { data, error } = await supabase
        .from("mistake_submissions")
        .select("*")
        .eq("id", submission_id)
        .single();

      if (error || !data) {
        return json({
          success: false,
          error: "Submission not found",
          details: error,
        }, 404);
      }

      record = data;
    } else {
      const { data, error } = await supabase
        .from("mistakes")
        .select("*")
        .eq("id", mistake_id)
        .single();

      if (error || !data) {
        return json({
          success: false,
          error: "Mistake not found",
          details: error,
        }, 404);
      }

      record = data;
    }

    const prompt = buildArtworkPrompt(record);

    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "medium",
        n: 1,
      }),
    });

    const imageJson = await imageRes.json().catch(() => ({}));

    if (!imageRes.ok) {
      return json({
        success: false,
        error: "OpenAI image generation failed",
        details: imageJson,
      }, 500);
    }

    const b64 = imageJson?.data?.[0]?.b64_json;

    if (!b64) {
      return json({
        success: false,
        error: "No image returned by OpenAI",
        details: imageJson,
      }, 500);
    }

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const recordId = submission_id || mistake_id;
    const fileName = `${mode}-${recordId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("mistake-artwork")
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return json({
        success: false,
        error: "Storage upload failed",
        details: uploadError,
      }, 500);
    }

    const { data: urlData } = supabase.storage
      .from("mistake-artwork")
      .getPublicUrl(fileName);

    const artwork_url = urlData?.publicUrl;

    if (!artwork_url) {
      return json({
        success: false,
        error: "Could not create public artwork URL",
      }, 500);
    }

    if (mode === "submission") {
      const { error: updateError } = await supabase
        .from("mistake_submissions")
        .update({
          ai_artwork_url: artwork_url,
          ai_artwork_prompt: prompt,
          ai_artwork_status: "generated",
          ai_artwork_generated_at: new Date().toISOString(),
        })
        .eq("id", submission_id);

      if (updateError) {
        return json({
          success: false,
          error: "Submission artwork update failed",
          details: updateError,
          artwork_url,
        }, 500);
      }
    } else {
      const { error: updateError } = await supabase
        .from("mistakes")
        .update({
          artwork_url,
          artwork_prompt: prompt,
          artwork_status: "generated",
          artwork_generated_at: new Date().toISOString(),
        })
        .eq("id", mistake_id);

      if (updateError) {
        return json({
          success: false,
          error: "Mistake artwork update failed",
          details: updateError,
          artwork_url,
        }, 500);
      }
    }

    return json({
      success: true,
      mode,
      mistake_id,
      submission_id,
      artwork_url,
      prompt,
    }, 200);
  } catch (err) {
    return json({
      success: false,
      error: String(err?.message || err),
    }, 500);
  }
});

function buildArtworkPrompt(record: any) {
  const title =
    record.ai_generated_title ||
    record.title ||
    "Untitled sports mistake";

  const sport =
    record.ai_generated_sport ||
    record.league ||
    record.sport ||
    "Sports";

  const year =
    record.ai_generated_year ||
    record.year ||
    "";

  const category =
    record.ai_generated_category ||
    record.category ||
    "Sports mistake";

  const teamsPeople =
    record.ai_generated_teams_people ||
    record.teams_people ||
    "";

  const summary =
    record.ai_generated_summary ||
    record.summary ||
    record.description ||
    "";

  const whyItMatters =
    record.ai_generated_why_it_matters ||
    record.why_it_matters ||
    "";

  return `
Create an original dramatic editorial oil painting symbolizing this sports mistake.

Sports mistake:
Title: ${title}
Sport/League: ${sport}
Year: ${year}
Category: ${category}
Teams/People: ${teamsPeople}
Summary: ${summary}
Why it matters: ${whyItMatters}

Visual direction:
- Cinematic sports-history oil painting.
- Dramatic lighting.
- Painterly brush strokes.
- Emotional, tense, consequential composition.
- Strong thumbnail readability.
- Symbolic and editorial, not documentary exactness.
- Generic uniforms and generic sports setting.

Important restrictions:
- No readable words.
- No readable letters.
- No readable initials.
- No jersey names.
- No team marks.
- No logos.
- No scoreboard text.
- No signage.
- No cap letters.
- No trademarked team logos.
- Do not copy a broadcast frame or known photograph.
- Do not depict exact real-person likenesses.
- Focus on emotion, consequence, and symbolism rather than exact branding.
`.trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
