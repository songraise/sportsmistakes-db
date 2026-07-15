import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_LENGTHS: Record<string, number> = {
  submitter_name: 80,
  submitter_email: 254,
  title: 180,
  sport: 60,
  league: 80,
  category: 80,
  teams_people: 300,
  key_people: 300,
  description: 2500,
  why_it_matters: 1800,
  source_url: 1200,
};

const BLOCKED_MODERATION_CATEGORIES = [
  "sexual",
  "sexual/minors",
  "hate",
  "hate/threatening",
  "harassment",
  "harassment/threatening",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "illicit",
  "illicit/violent",
  "violence/graphic",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ success: true }, 200);
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const payload = sanitizePayload(body);

    const validationError = validatePayload(payload);
    if (validationError) {
      return json({ success: false, error: validationError }, 400);
    }

    // Honeypot: real visitors never fill this hidden field.
    if (String(body.website || "").trim()) {
      return json({ success: true, message: "Submission received." }, 200);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error("OPENAI_API_KEY is missing");
      return json({ success: false, error: "Safety check is temporarily unavailable. Please try again shortly." }, 503);
    }

    const moderationResult = await moderateAllText(payload, openAiKey);

    if (!moderationResult.safe) {
      console.warn("Blocked unsafe submission", {
        categories: moderationResult.blockedCategories,
        titlePreview: payload.title.slice(0, 60),
      });

      return json(
        {
          success: false,
          blocked: true,
          error: "This submission could not be accepted because it appears to violate the SportsMistakes safety rules.",
        },
        422,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase server credentials are missing");
      return json({ success: false, error: "Submission service is temporarily unavailable." }, 503);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("mistake_submissions").insert({
      title: payload.title,
      sport: payload.sport,
      year: payload.year,
      league: payload.league || null,
      category: payload.category,
      description: payload.description,
      source_url: payload.source_url,
      summary: payload.description,
      why_it_matters: payload.why_it_matters || payload.description,
      source_1: payload.source_url,
      source_2: null,
      teams_people: payload.teams_people || null,
      key_people: payload.key_people || null,
      completeness_score: payload.completeness_score,
      submitter_name: payload.submitter_name || null,
      submitter_email: payload.submitter_email || null,
      submitter_trust_score: 50,
      status: "pending",
    });

    if (error) {
      console.error("Submission insert failed", error);
      return json({ success: false, error: "Submission failed. Please try again." }, 500);
    }

    return json({ success: true, message: "Submission received. Thank you! It will be reviewed before publishing." }, 200);
  } catch (error) {
    console.error("submit-mistake failed", error);
    return json({ success: false, error: "Submission failed. Please try again." }, 500);
  }
});

function sanitizePayload(body: Record<string, unknown>) {
  const clean = (key: string) => String(body[key] ?? "").trim().slice(0, MAX_LENGTHS[key] || 1000);
  const yearValue = Number(body.year);
  const completenessValue = Number(body.completeness_score);

  return {
    submitter_name: clean("submitter_name"),
    submitter_email: clean("submitter_email").toLowerCase(),
    title: clean("title"),
    sport: clean("sport"),
    year: Number.isInteger(yearValue) ? yearValue : null,
    league: clean("league"),
    category: clean("category"),
    teams_people: clean("teams_people"),
    key_people: clean("key_people"),
    description: clean("description"),
    why_it_matters: clean("why_it_matters"),
    source_url: clean("source_url"),
    completeness_score: Number.isFinite(completenessValue)
      ? Math.max(0, Math.min(100, Math.round(completenessValue)))
      : 0,
  };
}

function validatePayload(payload: ReturnType<typeof sanitizePayload>): string | null {
  if (!payload.title || !payload.description || !payload.source_url) {
    return "Please add a title, description, and source URL.";
  }

  if (!payload.sport || !payload.category) {
    return "Please select a sport and category.";
  }

  if (payload.submitter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.submitter_email)) {
    return "Please enter a valid email address, or leave the email field blank.";
  }

  if (payload.year !== null) {
    const currentYear = new Date().getUTCFullYear() + 1;
    if (payload.year < 1800 || payload.year > currentYear) {
      return "Please enter a valid year.";
    }
  }

  try {
    const url = new URL(payload.source_url);
    if (url.protocol !== "https:") return "Please use a secure source URL beginning with https://";
    if (url.username || url.password) return "That source URL is not allowed.";

    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return "That source URL is not allowed.";
    }
  } catch {
    return "Please enter a valid source URL.";
  }

  return null;
}

async function moderateAllText(
  payload: ReturnType<typeof sanitizePayload>,
  openAiKey: string,
): Promise<{ safe: boolean; blockedCategories: string[] }> {
  const fields = [
    ["Title", payload.title],
    ["Sport", payload.sport],
    ["League", payload.league],
    ["Category", payload.category],
    ["Teams and people", payload.teams_people],
    ["Key people", payload.key_people],
    ["Description", payload.description],
    ["Why it matters", payload.why_it_matters],
    ["Submitter name", payload.submitter_name],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: fields,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenAI moderation failed", data);
    throw new Error("OpenAI moderation failed");
  }

  const blocked = new Set<string>();

  for (const result of data.results || []) {
    const categories = result.categories || {};
    for (const category of BLOCKED_MODERATION_CATEGORIES) {
      if (categories[category] === true) blocked.add(category);
    }
  }

  return {
    safe: blocked.size === 0,
    blockedCategories: [...blocked],
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
