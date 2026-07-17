import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanText(
  value: unknown,
  maxLength: number,
): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond(405, {
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing required Supabase secrets.",
      );

      return respond(500, {
        success: false,
        error:
          "The upvote service is not configured.",
      });
    }

    const body = await req.json();

    const argumentId = cleanText(
      body?.argument_id,
      50,
    );

    const voterId = cleanText(
      body?.voter_id,
      50,
    );

    if (!isUuid(argumentId)) {
      return respond(400, {
        success: false,
        error:
          "A valid Sports Court argument is required.",
      });
    }

    if (!isUuid(voterId)) {
      return respond(400, {
        success: false,
        error:
          "A valid voter identifier is required.",
      });
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await admin.rpc(
      "register_sports_court_upvote",
      {
        p_argument_id: argumentId,
        p_voter_id: voterId,
      },
    );

    if (error) {
      console.error(
        "Sports Court upvote failed:",
        error,
      );

      const message = String(
        error.message || "",
      );

      if (
        message.includes("already_upvoted")
      ) {
        return respond(409, {
          success: false,
          code: "already_upvoted",
          message:
            "You already upvoted this argument.",
        });
      }

      if (
        message.includes("argument_not_found")
      ) {
        return respond(404, {
          success: false,
          code: "argument_not_found",
          message:
            "This Sports Court argument is no longer available.",
        });
      }

      return respond(500, {
        success: false,
        error:
          "The argument could not be upvoted.",
      });
    }

    return respond(200, {
      success: true,
      upvotes: Number(data || 0),
      message: "Upvote recorded.",
    });
  } catch (error) {
    console.error(
      "upvote-court-argument error:",
      error,
    );

    return respond(500, {
      success: false,
      error:
        "The upvote request could not be completed.",
    });
  }
});
