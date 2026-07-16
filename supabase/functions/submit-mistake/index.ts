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

const QUALITY_MODEL = Deno.env.get("OPENAI_QUALITY_MODEL") || "gpt-4.1-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ success: true }, 200);
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const payload = sanitizePayload(body);

    const validationError = validatePayload(payload);
    if (validationError) return json({ success: false, error: validationError }, 400);

    // Honeypot: bots often fill hidden fields. Pretend success without saving.
    if (String(body.website || "").trim()) {
      return json({ success: true, message: "Submission received." }, 200);
    }

    // Fast, free checks before spending an API call.
    const localQualityError = runLocalQualityChecks(payload);
    if (localQualityError) {
      console.warn("Blocked low-quality submission", {
        reason: localQualityError,
        titlePreview: payload.title.slice(0, 60),
      });
      return json({ success: false, blocked: true, error: localQualityError }, 422);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error("OPENAI_API_KEY is missing");
      return json(
        { success: false, error: "Safety check is temporarily unavailable. Please try again shortly." },
        503,
      );
    }

    // Gate 1: safety moderation across every user-editable text field.
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

    // Gate 2: sports relevance, coherence, meaningfulness, consistency, and spam.
    const qualityResult = await assessSubmissionQuality(payload, openAiKey);
    if (!qualityResult.approved) {
      console.warn("Blocked submission by quality gate", {
        reasonCode: qualityResult.reason_code,
        confidence: qualityResult.confidence,
        titlePreview: payload.title.slice(0, 60),
      });

      return json(
        {
          success: false,
          blocked: true,
          error: publicQualityMessage(qualityResult.reason_code),
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

    return json(
      { success: true, message: "Submission received. Thank you! It will be reviewed before publishing." },
      200,
    );
  } catch (error) {
    console.error("submit-mistake failed", error);
    return json({ success: false, error: "Submission failed. Please try again." }, 500);
  }
});

function sanitizePayload(body: Record<string, unknown>) {
  const clean = (key: string) => normalizeWhitespace(String(body[key] ?? "")).slice(0, MAX_LENGTHS[key] || 1000);
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
  if (!payload.sport || !payload.category) return "Please select a sport and category.";
  if (payload.title.length < 8) return "Please use a more descriptive title.";
  if (payload.description.length < 80) return "Please provide a fuller description of what happened.";

  if (payload.submitter_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.submitter_email)) {
    return "Please enter a valid email address, or leave the email field blank.";
  }

  if (payload.year !== null) {
    const currentYear = new Date().getUTCFullYear() + 1;
    if (payload.year < 1800 || payload.year > currentYear) return "Please enter a valid year.";
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
    ) return "That source URL is not allowed.";
  } catch {
    return "Please enter a valid source URL.";
  }

  return null;
}

function runLocalQualityChecks(payload: ReturnType<typeof sanitizePayload>): string | null {
  const combined = [
    payload.title,
    payload.teams_people,
    payload.key_people,
    payload.description,
    payload.why_it_matters,
    payload.submitter_name,
  ].filter(Boolean).join(" ");

  const requiredMeaningfulFields = [
    ["title", payload.title],
    ["description", payload.description],
  ] as const;

  for (const [label, value] of requiredMeaningfulFields) {
    if (looksLikeKeyboardMash(value) || looksLikeSyntheticGibberish(value)) {
      return `Please replace the random or unclear ${label} text with a meaningful description of the sports event.`;
    }
  }

  for (const value of [payload.teams_people, payload.key_people, payload.why_it_matters]) {
    if (value && (looksLikeKeyboardMash(value) || looksLikeSyntheticGibberish(value))) {
      return "One or more fields contain random or unclear text. Please use real teams, people, and a meaningful explanation.";
    }
  }

  if (hasExtremeRepetition(combined)) {
    return "Please remove repeated words or characters and submit a clear description of the sports event.";
  }

  if (containsSpamSignals(combined)) {
    return "This submission appears promotional or spam-like. Please describe only the sports event.";
  }

  if (countWords(payload.title) < 3) {
    return "Please use a specific title naming the play, decision, person, team, or event.";
  }

  if (countWords(payload.description) < 18) {
    return "Please provide a fuller description of what happened and why it may have been a mistake.";
  }

  if (meaningfulSentenceRatio(payload.description) < 0.55) {
    return "The description does not appear to contain enough meaningful, readable language. Please rewrite it clearly.";
  }

  const titleWords = meaningfulWords(payload.title);
  const descriptionWords = meaningfulWords(payload.description);

  if (titleWords.length >= 2 && intersectionSize(titleWords, descriptionWords) === 0) {
    return "The title and description do not appear to describe the same event. Please revise them for consistency.";
  }

  return null;
}

async function moderateAllText(
  payload: ReturnType<typeof sanitizePayload>,
  openAiKey: string,
): Promise<{ safe: boolean; blockedCategories: string[] }> {
  const fields = userTextFields(payload).map(([label, value]) => `${label}: ${value}`);

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "omni-moderation-latest", input: fields }),
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

  return { safe: blocked.size === 0, blockedCategories: [...blocked] };
}

type QualityResult = {
  approved: boolean;
  reason_code:
    | "approved"
    | "not_sports"
    | "gibberish"
    | "spam"
    | "inconsistent"
    | "too_vague"
    | "fabricated_or_unverifiable"
    | "unsafe_evasion";
  confidence: number;
};

async function assessSubmissionQuality(
  payload: ReturnType<typeof sanitizePayload>,
  openAiKey: string,
): Promise<QualityResult> {
  const prompt = `You are the submission gatekeeper for SportsMistakes, a historical database of real sports mistakes and controversies.

Evaluate ONLY whether this submission deserves to enter a human review queue. Do not rewrite it.

Approve only when all of these are true:
1. It clearly concerns a real or plausibly real sports event, decision, play, transaction, rule, officiating call, athlete, team, league, tournament, or sports organization.
2. The title, sport, people/teams, description, and why-it-matters fields are mutually consistent and describe the same event.
3. The description is meaningful, coherent, and specific enough for an editor to understand what allegedly happened.
4. Every free-text field uses normal, meaningful human language. Reject invented words, random pronounceable strings, keyboard mash, nonsense sentences, repeated filler, test data, placeholder text, keyword stuffing, promotion, solicitation, unrelated political/religious propaganda, or attempts to smuggle abusive content through a legitimate source URL.
5. It does not make obviously impossible or fabricated claims. A disputed interpretation may still pass; obvious invention should not.
6. A legitimate source URL does NOT excuse irrelevant, abusive, incoherent, or inconsistent text.

Use reason_code:
- approved
- not_sports
- gibberish
- spam
- inconsistent
- too_vague
- fabricated_or_unverifiable
- unsafe_evasion

A legitimate source URL is only supporting evidence; never use the URL itself as a reason to approve the text.

Reject as gibberish when a normal editor could not clearly explain the event after reading the submitted title and description, even if some individual words look English.

Be conservative about disputed sports interpretations, but be strict about language quality. When the event is coherent, readable, and sports-related, approve it for human review.`;

  const submissionText = userTextFields(payload)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: QUALITY_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: prompt }] },
        { role: "user", content: [{ type: "input_text", text: submissionText }] },
      ],
      temperature: 0,
      max_output_tokens: 180,
      text: {
        format: {
          type: "json_schema",
          name: "sports_submission_quality",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              approved: { type: "boolean" },
              reason_code: {
                type: "string",
                enum: [
                  "approved",
                  "not_sports",
                  "gibberish",
                  "spam",
                  "inconsistent",
                  "too_vague",
                  "fabricated_or_unverifiable",
                  "unsafe_evasion",
                ],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["approved", "reason_code", "confidence"],
          },
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("OpenAI quality check failed", data);
    throw new Error("OpenAI quality check failed");
  }

  const outputText = extractResponseText(data);
  if (!outputText) {
    console.error("OpenAI quality check returned no text", data);
    throw new Error("OpenAI quality check returned no text");
  }

  let parsed: QualityResult;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    console.error("Could not parse OpenAI quality response", outputText);
    throw new Error("Could not parse OpenAI quality response");
  }

  const hardRejectReasons = new Set<QualityResult["reason_code"]>([
    "not_sports",
    "gibberish",
    "spam",
    "inconsistent",
    "too_vague",
    "unsafe_evasion",
  ]);

  // Never turn a quality rejection into an approval merely because confidence is modest.
  // Only a low-confidence factual-verifiability concern may be left for human review.
  if (
    !parsed.approved &&
    parsed.reason_code === "fabricated_or_unverifiable" &&
    parsed.confidence < 0.78
  ) {
    return { approved: true, reason_code: "approved", confidence: parsed.confidence };
  }

  if (!parsed.approved && hardRejectReasons.has(parsed.reason_code)) {
    return parsed;
  }

  if (parsed.approved && parsed.confidence < 0.55) {
    return { approved: false, reason_code: "too_vague", confidence: parsed.confidence };
  }

  return parsed;
}

function userTextFields(payload: ReturnType<typeof sanitizePayload>): Array<[string, string]> {
  return [
    ["Title", payload.title],
    ["Sport", payload.sport],
    ["League", payload.league],
    ["Category", payload.category],
    ["Teams and people", payload.teams_people],
    ["Key people", payload.key_people],
    ["Description", payload.description],
    ["Why it matters", payload.why_it_matters],
    ["Submitter name", payload.submitter_name],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") return content.text.trim();
    }
  }
  return "";
}

function publicQualityMessage(reason: QualityResult["reason_code"]): string {
  switch (reason) {
    case "not_sports":
      return "This submission does not appear to describe a sports event or sports-related mistake.";
    case "gibberish":
      return "Please replace random, placeholder, or unclear text with a meaningful description of the sports event.";
    case "spam":
      return "This submission appears promotional or spam-like. Please describe only the sports event.";
    case "inconsistent":
      return "The title, teams/people, and description do not appear to describe the same sports event.";
    case "too_vague":
      return "Please add enough specific detail for an editor to understand what happened and why it may have been a mistake.";
    case "fabricated_or_unverifiable":
      return "This submission could not be accepted because the event appears implausible or cannot be meaningfully evaluated.";
    case "unsafe_evasion":
      return "This submission appears to contain unrelated or inappropriate material and could not be accepted.";
    default:
      return "This submission did not pass the SportsMistakes quality review. Please revise it and try again.";
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(value: string): number {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length || 0;
}

function meaningfulWords(value: string): Set<string> {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "at", "was", "were", "is", "it", "this", "that"]);
  return new Set(
    (value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || [])
      .filter((word) => word.length >= 3 && !stop.has(word)),
  );
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const value of a) if (b.has(value)) count++;
  return count;
}

function looksLikeKeyboardMash(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length < 6) return false;

  if (/^(asdf|qwer|zxcv|hjkl|test|testing|lorem|ipsum|abc|xyz|abc123)+$/i.test(compact)) return true;
  if (/([a-z0-9])\1{4,}/i.test(compact)) return true;
  if (/(asdf|qwer|zxcv|hjkl|poiuy|lkjhg|mnbvc|qazwsx|wsxedc)/i.test(compact)) return true;

  const letters = compact.replace(/[^a-z]/g, "");
  if (letters.length >= 10) {
    const vowels = (letters.match(/[aeiouy]/g) || []).length;
    const vowelRatio = vowels / letters.length;
    if (vowelRatio < 0.12 || vowelRatio > 0.78) return true;
  }

  return false;
}

function looksLikeSyntheticGibberish(value: string): boolean {
  const tokens = (value.toLowerCase().match(/[a-z][a-z'-]*/g) || [])
    .map(token => token.replace(/['-]/g, ""))
    .filter(Boolean);

  if (tokens.length < 2) return false;

  const suspicious = tokens.filter(token => {
    if (token.length >= 18) return true;
    if (/[^aeiouy]{6,}/.test(token)) return true;
    if (/[aeiouy]{5,}/.test(token)) return true;
    if (/(..)\1{2,}/.test(token)) return true;

    const vowels = (token.match(/[aeiouy]/g) || []).length;
    const ratio = token.length ? vowels / token.length : 0;
    return token.length >= 7 && (ratio < 0.14 || ratio > 0.72);
  }).length;

  if (tokens.length >= 4 && suspicious / tokens.length >= 0.45) return true;

  const normalized = tokens.join(" ");
  const trigrams = new Map<string, number>();

  for (let i = 0; i <= normalized.length - 3; i++) {
    const tri = normalized.slice(i, i + 3);
    trigrams.set(tri, (trigrams.get(tri) || 0) + 1);
  }

  const repeatedTrigrams = [...trigrams.values()].filter(count => count >= 4).length;
  if (normalized.length >= 25 && repeatedTrigrams >= 3) return true;

  return false;
}

function meaningfulSentenceRatio(value: string): number {
  const tokens = value.toLowerCase().match(/[a-z][a-z'-]*/g) || [];
  if (!tokens.length) return 0;

  const commonWords = new Set([
    "a","about","after","against","all","an","and","another","as","at","away",
    "back","ball","because","before","but","by","call","called","came","coach",
    "could","decision","did","during","error","event","fans","final","for","from",
    "game","gave","had","has","have","he","her","his","in","into","is","it",
    "its","league","left","made","match","mistake","not","of","off","official",
    "on","one","or","out","player","play","referee","result","season","she",
    "should","sport","team","than","that","the","their","them","then","there",
    "they","this","through","time","to","tournament","was","were","when","which",
    "who","why","with","won","would","year"
  ]);

  let plausible = 0;

  for (const token of tokens) {
    if (commonWords.has(token)) {
      plausible++;
      continue;
    }

    if (token.length >= 2 && token.length <= 16 && /[aeiouy]/.test(token) && !/[^aeiouy]{6,}/.test(token)) {
      plausible++;
    }
  }

  return plausible / tokens.length;
}

function hasExtremeRepetition(value: string): boolean {
  if (/(.{2,20})\1{4,}/i.test(value.replace(/\s+/g, " "))) return true;
  const words = value.toLowerCase().match(/[a-z0-9']+/g) || [];
  if (words.length < 12) return false;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return Math.max(...counts.values()) / words.length > 0.42;
}

function containsSpamSignals(value: string): boolean {
  const lower = value.toLowerCase();
  const patterns = [
    /\b(?:buy now|click here|limited offer|guaranteed profit|work from home|make money fast)\b/,
    /\b(?:telegram|whatsapp|signal)\b.{0,30}\b(?:contact|message|dm|join)\b/,
    /\b(?:casino|sportsbook|betting bonus|promo code|crypto investment|forex)\b/,
    /\b(?:seo services|guest post|backlinks|sponsored post)\b/,
  ];
  if (patterns.some((pattern) => pattern.test(lower))) return true;

  const urls = value.match(/https?:\/\/\S+/gi) || [];
  return urls.length > 2;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
