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

    // Get events for this meet
    const { data: events } = await supabase
      .from("events")
      .select("event_name, event_number, athletes")
      .eq("meet_id", meetId)
      .order("event_number", { ascending: true });

    // Build detailed search entries with event/heat/lane context
    const searchEntries: Array<{ name: string; team: string; lane: number; heat: number; event: string }> = [];
    for (const event of events || []) {
      const athletes = (event.athletes as any[]) || [];
      for (const a of athletes) {
        if (
          a.team &&
          a.team.toLowerCase() === team.toLowerCase() &&
          a.lane &&
          lanes.includes(a.lane)
        ) {
          if (a.name) searchEntries.push({ name: a.name, team: a.team, lane: a.lane, heat: a.heat || 0, event: event.event_name });
        }
      }
    }

    console.log(`Found ${searchEntries.length} athlete entries matching team=${team}, lanes=${lanes}`);

    if (searchEntries.length === 0) {
      const teamLanes = new Set<number>();
      for (const event of events || []) {
        for (const a of (event.athletes as any[]) || []) {
          if (a.team && a.team.toLowerCase() === team.toLowerCase() && a.lane) {
            teamLanes.add(a.lane);
          }
        }
      }
      const availableLanes = [...teamLanes].sort((a, b) => a - b);
      const msg = availableLanes.length > 0
        ? `No ${team} athletes found in lane(s) ${lanes.join(", ")}. ${team} athletes are in lane(s): ${availableLanes.join(", ")}`
        : `No athletes found for team "${team}" in this meet.`;
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the original PDF
    console.log("Fetching PDF from:", meet.file_url);
    const pdfResponse = await fetch(meet.file_url);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());

    // Convert PDF to base64 for AI
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    // Build detailed list for AI with context to avoid misses
    const entryList = searchEntries.map(e =>
      `"${e.name}" (${e.team}, Heat ${e.heat}, Lane ${e.lane}) in ${e.event}`
    ).join("\n");

    const aiPrompt = `You are analyzing a swim meet heat sheet PDF. I need the EXACT positions of specific athlete rows so I can draw highlights on them.

Here are ALL the entries to find — do NOT miss any:
${entryList}

For EACH entry above, find the row in the PDF where that athlete appears and return:
- page: 1-indexed page number
- yPercent: vertical position as percentage from TOP of page (0=top, 100=bottom). Must be precise to the CENTER of the text row.
- xStartPercent: horizontal start of the athlete's row content as percentage from LEFT (typically where the lane number starts)
- xEndPercent: horizontal end of the athlete's row content as percentage from LEFT (typically where the seed time ends)

IMPORTANT:
- Each entry listed above MUST appear in your response. There are ${searchEntries.length} entries total.
- Heat sheets list athletes in rows like: "Lane Name Team SeedTime"
- The same athlete may appear in multiple events on different pages — include EACH occurrence.
- Be very precise with yPercent — it should land exactly on the text row.

Return ONLY valid JSON, no markdown:
{
  "highlights": [
    {"name": "Athlete Name", "event": "Event Name", "page": 1, "yPercent": 45.5, "xStartPercent": 5, "xEndPercent": 95, "found": true}
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
    content = content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    else if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    let highlights: Array<{ name: string; page: number; yPercent: number; xStartPercent?: number; xEndPercent?: number; found: boolean }> = [];
    try {
      const parsed = JSON.parse(content);
      highlights = parsed.highlights || [];
    } catch (e) {
      console.error("Failed to parse AI highlight positions:", e, content.substring(0, 500));
    }

    const foundCount = highlights.filter(h => h.found).length;
    console.log(`AI identified ${foundCount}/${searchEntries.length} highlight positions`);

    // Load PDF with pdf-lib and draw highlights
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const { r, g, b: blue } = hexToRgb(color);

    for (const h of highlights) {
      if (!h.found || h.page < 1 || h.page > pages.length) continue;
      const page = pages[h.page - 1];
      const { width, height } = page.getSize();

      const yFromTop = (h.yPercent / 100) * height;
      const yPos = height - yFromTop;
      const rowHeight = 12;

      // Use AI-provided x bounds, with sensible defaults
      const xStart = ((h.xStartPercent || 3) / 100) * width;
      const xEnd = ((h.xEndPercent || 97) / 100) * width;
      const highlightWidth = xEnd - xStart;

      if (style === "row") {
        page.drawRectangle({
          x: xStart,
          y: yPos - rowHeight / 2,
          width: highlightWidth,
          height: rowHeight,
          color: rgb(r, g, blue),
          opacity: 0.3,
        });
      } else if (style === "name") {
        page.drawRectangle({
          x: xStart,
          y: yPos - rowHeight / 2,
          width: Math.min(highlightWidth, 200),
          height: rowHeight,
          color: rgb(r, g, blue),
          opacity: 0.35,
        });
      } else if (style === "margin") {
        page.drawCircle({
          x: 8,
          y: yPos,
          size: 4,
          color: rgb(r, g, blue),
          opacity: 0.9,
        });
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    let resultBinary = "";
    for (let i = 0; i < modifiedPdfBytes.length; i += chunkSize) {
      resultBinary += String.fromCharCode(...modifiedPdfBytes.subarray(i, i + chunkSize));
    }
    const resultBase64 = btoa(resultBinary);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: resultBase64,
        highlightsFound: foundCount,
        athletesSearched: searchEntries.length,
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
