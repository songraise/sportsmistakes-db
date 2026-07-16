import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function clean(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
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

    const argumentId = clean(body?.argument_id, 50);
    const reporterId = clean(body?.reporter_id, 100);
    const reason = clean(body?.reason || "Unsafe or offensive content", 100);
    const details = clean(body?.details || "", 500);

    if (!isUuid(argumentId) || reporterId.length < 10) {
      return respond(400, {
        success: false,
        error: "The report is missing required information.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return respond(500, {
        success: false,
        error: "The reporting service is not configured.",
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: argument, error: argumentError } = await admin
      .from("sports_court_arguments")
      .select("id,status")
      .eq("id", argumentId)
      .maybeSingle();

    if (argumentError || !argument) {
      return respond(404, {
        success: false,
        error: "This Sports Court argument could not be found.",
      });
    }

    const { error: insertError } = await admin
      .from("sports_court_argument_reports")
      .insert({
        argument_id: argumentId,
        reporter_id: reporterId,
        reason,
        details,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return respond(409, {
          success: false,
          error: "You already reported this argument.",
        });
      }

      console.error("Report insert failed:", insertError);
      return respond(500, {
        success: false,
        error: "The report could not be saved.",
      });
    }

    const { count, error: countError } = await admin
      .from("sports_court_argument_reports")
      .select("id", { count: "exact", head: true })
      .eq("argument_id", argumentId);

    if (countError) {
      console.error("Report count failed:", countError);
    }

    const reportCount = count || 1;

    // Three unique reports remove the argument from public view automatically.
    if (reportCount >= 3 && argument.status === "approved") {
      const { error: statusError } = await admin
        .from("sports_court_arguments")
        .update({ status: "pending" })
        .eq("id", argumentId);

      if (statusError) {
        console.error("Auto-hide after reports failed:", statusError);
      }
    }

    return respond(200, {
      success: true,
      report_count: reportCount,
      automatically_hidden: reportCount >= 3,
      message:
        reportCount >= 3
          ? "Report received. This argument has been removed pending moderator review."
          : "Report received. Thank you.",
    });
  } catch (error) {
    console.error("report-court-argument error:", error);

    return respond(500, {
      success: false,
      error: "The report could not be processed.",
    });
  }
});
