import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetId, team, lanes, color = "#FFFF00", style = "row" } = await req.json();
    if (!meetId || !team || !lanes?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "meetId, team, and lanes are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the meet to find the PDF URL
    const { data: meet, error: meetErr } = await supabase
      .from("meets")
      .select("file_url")
      .eq("id", meetId)
      .single();
    if (meetErr || !meet?.file_url) {
      return new Response(
        JSON.stringify({ success: false, error: "Meet or PDF not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get events for this meet filtered by team + lanes
    const { data: events } = await supabase
      .from("events")
      .select("event_name, event_number, athletes")
      .eq("meet_id", meetId)
      .order("event_number", { ascending: true });

    // Build search terms: athlete names from matching team+lanes
    const searchNames: string[] = [];
    for (const event of events || []) {
      const athletes = (event.athletes as any[]) || [];
      for (const a of athletes) {
        if (
          a.team &&
          a.team.toLowerCase() === team.toLowerCase() &&
          a.lane &&
          lanes.includes(a.lane)
        ) {
          if (a.name) searchNames.push(a.name);
        }
      }
    }

    const uniqueNames = [...new Set(searchNames)];
    console.log(`Found ${uniqueNames.length} athletes matching team=${team}, lanes=${lanes}`);

    if (uniqueNames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No athletes found matching team and lane criteria" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the original PDF
    console.log("Fetching PDF from:", meet.file_url);
    const pdfResponse = await fetch(meet.file_url);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());

    // Use AI to find text positions for the athlete names
    // Convert PDF to base64 for AI
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    const aiPrompt = `Analyze this swim meet heat sheet PDF. I need to find the EXACT positions of specific athlete entries so I can highlight them.

Athletes to find: ${uniqueNames.join(", ")}

For EACH athlete found, return the page number (1-indexed) and the approximate vertical position as a percentage from the TOP of the page (0% = top, 100% = bottom).

Return ONLY a JSON object like this:
{
  "highlights": [
    {"name": "Athlete Name", "page": 1, "yPercent": 45.5, "found": true},
    {"name": "Other Athlete", "page": 2, "yPercent": 30.0, "found": true}
  ]
}

If an athlete appears in MULTIPLE events, include a separate entry for each occurrence.
Return ONLY valid JSON. No markdown, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: aiPrompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ],
        }],
        temperature: 0,
        max_tokens: 50000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI processing failed");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    // Strip code fences
    content = content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    else if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    let highlights: Array<{ name: string; page: number; yPercent: number; found: boolean }> = [];
    try {
      const parsed = JSON.parse(content);
      highlights = parsed.highlights || [];
    } catch (e) {
      console.error("Failed to parse AI highlight positions:", e, content.substring(0, 500));
      // Fallback: no highlights, but still return the PDF
    }

    console.log(`AI identified ${highlights.filter(h => h.found).length} highlight positions`);

    // Load PDF with pdf-lib and draw highlights
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const { r, g, b: blue } = hexToRgb(color);

    for (const h of highlights) {
      if (!h.found || h.page < 1 || h.page > pages.length) continue;
      const page = pages[h.page - 1];
      const { width, height } = page.getSize();

      const yFromTop = (h.yPercent / 100) * height;
      // PDF coordinates are from bottom-left
      const yPos = height - yFromTop;
      const rowHeight = 14;

      if (style === "row") {
        page.drawRectangle({
          x: 10,
          y: yPos - rowHeight / 2,
          width: width - 20,
          height: rowHeight,
          color: rgb(r, g, blue),
          opacity: 0.35,
        });
      } else if (style === "name") {
        // Highlight a smaller region around where the name would be
        page.drawRectangle({
          x: 30,
          y: yPos - rowHeight / 2,
          width: 180,
          height: rowHeight,
          color: rgb(r, g, blue),
          opacity: 0.4,
        });
      } else if (style === "margin") {
        // Draw a colored dot/circle in the margin
        page.drawCircle({
          x: 12,
          y: yPos,
          size: 5,
          color: rgb(r, g, blue),
          opacity: 0.9,
        });
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    // Convert to base64 for response
    let resultBinary = "";
    for (let i = 0; i < modifiedPdfBytes.length; i += chunkSize) {
      resultBinary += String.fromCharCode(...modifiedPdfBytes.subarray(i, i + chunkSize));
    }
    const resultBase64 = btoa(resultBinary);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: resultBase64,
        highlightsFound: highlights.filter((h) => h.found).length,
        athletesSearched: uniqueNames.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("highlight-meet-pdf error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
