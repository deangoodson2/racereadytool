import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize "Last, First" or "First Last" into sorted lowercase parts for comparison
function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "") // remove commas, parens, etc.
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function namesMatch(inputName: string, sheetName: string): boolean {
  const inputParts = normalizeName(inputName);
  const sheetParts = normalizeName(sheetName);

  if (inputParts.length === 0 || sheetParts.length === 0) return false;

  // Check if all parts from the shorter name exist in the longer name
  const shorter = inputParts.length <= sheetParts.length ? inputParts : sheetParts;
  const longer = inputParts.length <= sheetParts.length ? sheetParts : inputParts;

  return shorter.every((part) =>
    longer.some((lp) => lp.startsWith(part) || part.startsWith(lp))
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(RESEND_API_KEY);

  try {
    const { meetId } = await req.json();
    if (!meetId) throw new Error("meetId is required");

    const { data: meet, error: meetErr } = await supabase
      .from("meets")
      .select("*")
      .eq("id", meetId)
      .single();
    if (meetErr || !meet) throw new Error("Meet not found");

    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("*")
      .eq("meet_id", meetId)
      .order("event_number", { ascending: true });
    if (eventsErr) throw new Error("Failed to load events");

    const { data: subscribers, error: subErr } = await supabase
      .from("meet_subscribers")
      .select("*")
      .eq("meet_id", meetId);
    if (subErr) throw new Error("Failed to load subscribers");

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, failed: 0, message: "No subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group subscribers by email
    const byEmail = new Map<string, string[]>();
    for (const sub of subscribers) {
      const names = byEmail.get(sub.email) || [];
      names.push(sub.swimmer_name);
      byEmail.set(sub.email, names);
    }

    let sent = 0;
    let failed = 0;
    const meetName = meet.file_name?.replace(".pdf", "") || "Swim Meet";

    for (const [email, swimmerNames] of byEmail) {
      const swimmerSections: string[] = [];

      for (const swimmerName of swimmerNames) {
        const matchingEvents = (events || []).filter((event: any) => {
          const athletes = event.athletes || [];
          return athletes.some((a: any) => namesMatch(swimmerName, a.name || ""));
        });

        if (matchingEvents.length > 0) {
          let html = `<h2 style="color:#3b82f6;margin:20px 0 10px;">🏊 ${swimmerName}</h2>`;
          html += `<table style="width:100%;border-collapse:collapse;font-size:14px;">`;
          html += `<tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Event</th><th style="padding:8px;">Heat</th><th style="padding:8px;">Lane</th><th style="padding:8px;">Seed Time</th></tr>`;

          for (const event of matchingEvents) {
            const athletes = event.athletes || [];
            const athlete = athletes.find((a: any) => namesMatch(swimmerName, a.name || ""));
            const eventLabel = event.event_number ? `#${event.event_number} ${event.event_name}` : event.event_name;
            html += `<tr style="border-bottom:1px solid #e5e7eb;">`;
            html += `<td style="padding:8px;">${eventLabel}</td>`;
            html += `<td style="padding:8px;text-align:center;">${athlete?.heat || "—"}</td>`;
            html += `<td style="padding:8px;text-align:center;">${athlete?.lane || "—"}</td>`;
            html += `<td style="padding:8px;text-align:center;">${athlete?.seedTime || "—"}</td>`;
            html += `</tr>`;
          }
          html += `</table>`;
          swimmerSections.push(html);
        } else {
          swimmerSections.push(
            `<h2 style="color:#3b82f6;margin:20px 0 10px;">🏊 ${swimmerName}</h2>
             <p style="color:#6b7280;">No matching events found for this swimmer. The name may not exactly match the meet sheet.</p>`
          );
        }
      }

      const emailHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h1 style="color:#1e293b;margin-bottom:4px;">${meetName}</h1>
          <p style="color:#6b7280;margin-top:0;">Here's the schedule for your swimmer(s):</p>
          ${swimmerSections.join("")}
          <hr style="margin:30px 0;border:none;border-top:1px solid #e5e7eb;" />
          <p style="color:#9ca3af;font-size:12px;">Sent by RaceReady</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: "RaceReady <onboarding@resend.dev>",
          to: [email],
          subject: `${meetName} — Swim Schedule`,
          html: emailHtml,
        });
        sent++;
      } catch (emailErr) {
        console.error(`Failed to send to ${email}:`, emailErr);
        failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-meet-emails error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
