import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetId, team, lanes } = await req.json();
    if (!meetId || !team || !lanes?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "meetId, team, and lanes are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get meet info
    const { data: meet } = await supabase
      .from("meets")
      .select("file_name")
      .eq("id", meetId)
      .single();
    const meetName = meet?.file_name?.replace(".pdf", "") || "Swim Meet";

    // Get events
    const { data: events } = await supabase
      .from("events")
      .select("event_name, event_number, athletes")
      .eq("meet_id", meetId)
      .order("event_number", { ascending: true });

    // Filter to matching athletes
    interface MatchedEntry {
      eventNumber: number | null;
      eventName: string;
      athleteName: string;
      heat: number | null;
      lane: number | null;
      seedTime: string;
    }

    const matched: MatchedEntry[] = [];
    for (const event of events || []) {
      const athletes = (event.athletes as any[]) || [];
      for (const a of athletes) {
        if (
          a.team &&
          a.team.toLowerCase() === team.toLowerCase() &&
          a.lane &&
          lanes.includes(a.lane)
        ) {
          matched.push({
            eventNumber: event.event_number,
            eventName: event.event_name,
            athleteName: a.name || "Unknown",
            heat: a.heat || null,
            lane: a.lane || null,
            seedTime: a.seedTime || "",
          });
        }
      }
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const margin = 50;
    const lineHeight = 16;
    const colEventX = margin;
    const colAthleteX = 250;
    const colHeatX = 400;
    const colLaneX = 445;
    const colSeedX = 490;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Title
    page.drawText(meetName, {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.2),
    });
    y -= 24;

    page.drawText(`Team: ${team}  |  Lanes: ${lanes.join(", ")}`, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.4, 0.4, 0.5),
    });
    y -= 8;

    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.6),
    });
    y -= 24;

    // Divider
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.85),
    });
    y -= 20;

    // Table header
    const drawHeader = (p: typeof page, yPos: number) => {
      p.drawText("Event", { x: colEventX, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      p.drawText("Athlete", { x: colAthleteX, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      p.drawText("Heat", { x: colHeatX, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      p.drawText("Lane", { x: colLaneX, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      p.drawText("Seed", { x: colSeedX, y: yPos, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      return yPos - lineHeight - 4;
    };

    y = drawHeader(page, y);

    // Draw line under header
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: pageWidth - margin, y: y + 2 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 4;

    if (matched.length === 0) {
      y -= lineHeight;
      page.drawText("No athletes found matching the selected team and lanes.", {
        x: margin,
        y,
        size: 11,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      for (const entry of matched) {
        if (y < margin + 40) {
          // New page
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
          y = drawHeader(page, y);
          page.drawLine({
            start: { x: margin, y: y + 2 },
            end: { x: pageWidth - margin, y: y + 2 },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.9),
          });
          y -= 4;
        }

        const eventLabel = entry.eventNumber ? `#${entry.eventNumber} ${entry.eventName}` : entry.eventName;
        // Truncate long event names
        const truncEvent = eventLabel.length > 30 ? eventLabel.substring(0, 28) + "…" : eventLabel;

        page.drawText(truncEvent, { x: colEventX, y, size: 9, font, color: rgb(0.15, 0.15, 0.2) });
        page.drawText(entry.athleteName, { x: colAthleteX, y, size: 9, font, color: rgb(0.15, 0.15, 0.2) });
        page.drawText(entry.heat?.toString() || "—", { x: colHeatX, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) });
        page.drawText(entry.lane?.toString() || "—", { x: colLaneX, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) });
        page.drawText(entry.seedTime || "—", { x: colSeedX, y, size: 9, font, color: rgb(0.4, 0.4, 0.5) });

        y -= lineHeight;

        // Light row divider
        page.drawLine({
          start: { x: margin, y: y + 4 },
          end: { x: pageWidth - margin, y: y + 4 },
          thickness: 0.25,
          color: rgb(0.9, 0.9, 0.92),
        });
      }
    }

    // Footer
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawText("Generated by RaceReady", {
      x: margin,
      y: 30,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.65),
    });

    const pdfResultBytes = await pdfDoc.save();

    // Convert to base64
    let resultBinary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < pdfResultBytes.length; i += chunkSize) {
      resultBinary += String.fromCharCode(...pdfResultBytes.subarray(i, i + chunkSize));
    }
    const resultBase64 = btoa(resultBinary);

    return new Response(
      JSON.stringify({ success: true, pdfBase64: resultBase64, entriesCount: matched.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-summary-pdf error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
