const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ParsedEvent {
  eventNumber: number | null;
  eventName: string;
  athletes: Array<{
    name: string;
    team?: string;
    heat?: number;
    lane?: number;
    seedTime?: string;
  }>;
  rawText: string;
}

function stripCodeFences(input: string): string {
  let out = input.trim();
  if (out.startsWith("```json")) out = out.slice(7);
  else if (out.startsWith("```")) out = out.slice(3);
  if (out.endsWith("```")) out = out.slice(0, -3);
  return out.trim();
}

function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Removes common invalid trailing commas (e.g. {"a":1,} or [1,2,])
function removeTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, "$1");
}

function normalizeEventShape(maybeEvent: any): ParsedEvent | null {
  if (!maybeEvent || typeof maybeEvent !== "object") return null;
  const eventNumber =
    typeof maybeEvent.eventNumber === "number"
      ? maybeEvent.eventNumber
      : maybeEvent.eventNumber === null
        ? null
        : null;
  const eventName = typeof maybeEvent.eventName === "string" ? maybeEvent.eventName : "";
  const athletes = Array.isArray(maybeEvent.athletes) ? maybeEvent.athletes : [];
  if (!eventName) return null;

  return {
    eventNumber,
    eventName,
    athletes: athletes
      .map((a: any) => {
        if (!a || typeof a !== "object") return null;
        if (typeof a.name !== "string" || !a.name) return null;
        return {
          name: a.name,
          team: typeof a.team === "string" && a.team ? a.team : undefined,
          heat: typeof a.heat === "number" ? a.heat : undefined,
          lane: typeof a.lane === "number" ? a.lane : undefined,
          seedTime: typeof a.seedTime === "string" && a.seedTime ? a.seedTime : undefined,
        };
      })
      .filter(Boolean),
    rawText: typeof maybeEvent.rawText === "string" && maybeEvent.rawText ? maybeEvent.rawText : "",
  };
}

function extractEventsFromPossiblyTruncatedResponse(rawContent: string): ParsedEvent[] {
  const content = stripCodeFences(rawContent);

  // Best case: valid JSON already.
  const direct = tryParseJson<{ events?: any[] }>(removeTrailingCommas(content));
  if (direct?.events && Array.isArray(direct.events)) {
    return direct.events.map(normalizeEventShape).filter(Boolean) as ParsedEvent[];
  }

  // Fallback: scan out *complete* event objects within the "events" array.
  const keyIdx = content.indexOf('"events"');
  if (keyIdx === -1) return [];

  const arrStart = content.indexOf("[", keyIdx);
  if (arrStart === -1) return [];

  const events: ParsedEvent[] = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let objStart = -1;

  for (let i = arrStart + 1; i < content.length; i++) {
    const ch = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && objStart !== -1) {
        const objRaw = content.slice(objStart, i + 1);
        const parsed = tryParseJson<any>(removeTrailingCommas(objRaw));
        const normalized = normalizeEventShape(parsed);
        if (normalized) events.push(normalized);
        objStart = -1;
      }
      continue;
    }

    // End of array: we're done.
    if (ch === "]" && depth === 0) break;
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, meetId } = await req.json();

    if (!pdfUrl || !meetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF URL and meet ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching PDF from:', pdfUrl);

    // Fetch the PDF directly
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      console.error('Failed to fetch PDF:', pdfResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch PDF: ${pdfResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert PDF to base64
    const pdfBuffer = await pdfResponse.arrayBuffer();
    // Avoid stack overflows for larger PDFs by chunking.
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);
    
    console.log('PDF fetched, size:', pdfBuffer.byteLength, 'bytes');

    // Use Lovable AI to extract content from the PDF
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Parse this swim meet heat sheet PDF. Extract ONLY structured data, NO raw text.

Return a JSON object with this EXACT structure:
{
  "events": [
    {
      "eventNumber": 1,
      "eventName": "Girls 11-12 50 Yard Freestyle",
      "athletes": [
        {"name": "Jane Smith", "team": "ABCD", "heat": 1, "lane": 4, "seedTime": "32.45"}
      ]
    }
  ]
}

Rules:
- Extract ALL events and ALL athletes
- eventNumber: integer or null
- eventName: string (e.g., "Boys 8 & Under 25 Yard Freestyle")
- athletes: array of {name, team, heat, lane, seedTime}
- team: club abbreviation (e.g., "CTS-GA", "JEFF-GA")
- seedTime: string (e.g., "32.45", "NT", "1:02.35 INV")
- Return ONLY valid JSON, no markdown, no explanation`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 64000,
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorData);
      return new Response(
        JSON.stringify({ success: false, error: `AI processing failed: ${aiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, length:', content.length);

    // Parse the AI response with robust extraction
    const extractedEvents = extractEventsFromPossiblyTruncatedResponse(content);

    if (!extractedEvents || extractedEvents.length === 0) {
      console.error('Failed to extract events from AI response');
      console.log('Response preview:', content.substring(0, 500));
      
      // Create a fallback with raw content for debugging
      const fallbackEvents: ParsedEvent[] = [{
          eventNumber: null,
          eventName: 'Parse Error - Manual Review Required',
          athletes: [],
          rawText: content.substring(0, 2000),
        }];

      return new Response(
        JSON.stringify({
          success: true,
          rawContent: `Parsed 0 events (fallback)` ,
          events: fallbackEvents,
          meetId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure events have rawText
    const events = (extractedEvents || []).map((event, index) => ({
      ...event,
      rawText: event.rawText || `Event ${event.eventNumber || index + 1}: ${event.eventName}`,
    }));

    console.log('Parsed events count:', events.length);
    if (events.length > 0) {
      console.log('Sample event:', JSON.stringify(events[0]).substring(0, 200));
    }

    return new Response(
      JSON.stringify({
        success: true,
        rawContent: `Parsed ${events.length} events`,
        events,
        meetId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse PDF';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
