import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, {
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase Edge Function secrets.");

      return respond(500, {
        success: false,
        error: "Admin moderation service is not configured.",
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return respond(401, {
        success: false,
        error: "Admin login required.",
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } =
      await authClient.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error("Admin token verification failed:", userError);

      return respond(401, {
        success: false,
        error: "Your admin session is invalid or expired. Please log in again.",
      });
    }

    const configuredAdmins = clean(
      Deno.env.get("ADMIN_EMAILS"),
      2000,
    )
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = String(userData.user.email || "").toLowerCase();

    if (
      configuredAdmins.length > 0 &&
      !configuredAdmins.includes(userEmail)
    ) {
      return respond(403, {
        success: false,
        error: "This account is not authorized to moderate Sports Court.",
      });
    }

    const body = await req.json();

    const action = clean(body?.action, 30);
    const argumentId = clean(body?.argument_id, 50);

    if (!isUuid(argumentId)) {
      return respond(400, {
        success: false,
        error: "A valid Sports Court argument ID is required.",
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    if (action === "delete") {
      const { error } = await admin
        .from("sports_court_arguments")
        .delete()
        .eq("id", argumentId);

      if (error) {
        console.error("Sports Court delete failed:", error);

        return respond(500, {
          success: false,
          error: "The argument could not be deleted.",
          details: error.message,
        });
      }

      return respond(200, {
        success: true,
        action: "delete",
      });
    }

    if (action === "set_status") {
      const status = clean(body?.status, 20);

      if (
        !["pending", "approved", "hidden", "rejected"].includes(status)
      ) {
        return respond(400, {
          success: false,
          error: "Invalid moderation status.",
        });
      }

      const { error } = await admin
        .from("sports_court_arguments")
        .update({ status })
        .eq("id", argumentId);

      if (error) {
        console.error("Sports Court status update failed:", error);

        return respond(500, {
          success: false,
          error: "The argument status could not be updated.",
          details: error.message,
        });
      }

      return respond(200, {
        success: true,
        action: "set_status",
        status,
      });
    }

    if (action === "edit") {
      const argumentText = clean(body?.argument_text, 800);
      const authorName = clean(
        body?.author_name || "Anonymous fan",
        60,
      );

      if (argumentText.length < 20) {
        return respond(400, {
          success: false,
          error: "The argument must contain at least 20 characters.",
        });
      }

      const { error } = await admin
        .from("sports_court_arguments")
        .update({
          argument_text: argumentText,
          author_name: authorName || "Anonymous fan",
        })
        .eq("id", argumentId);

      if (error) {
        console.error("Sports Court edit failed:", error);

        return respond(500, {
          success: false,
          error: "The argument could not be edited.",
          details: error.message,
        });
      }

      return respond(200, {
        success: true,
        action: "edit",
      });
    }

    return respond(400, {
      success: false,
      error: "Unknown moderation action.",
    });
  } catch (error) {
    console.error("manage-court-argument error:", error);

    return respond(500, {
      success: false,
      error: "The moderation request failed.",
    });
  }
});
