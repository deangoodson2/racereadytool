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
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function removeTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, "$1");
}

function normalizeEventShape(maybeEvent: any): ParsedEvent | null {
  if (!maybeEvent || typeof maybeEvent !== "object") return null;
  const eventNumber = typeof maybeEvent.eventNumber === "number" ? maybeEvent.eventNumber : null;
  const eventName = typeof maybeEvent.eventName === "string" ? maybeEvent.eventName : "";
  const athletes = Array.isArray(maybeEvent.athletes) ? maybeEvent.athletes : [];
  if (!eventName) return null;

  return {
    eventNumber,
    eventName,
    athletes: athletes
      .map((a: any) => {
        if (!a || typeof a !== "object" || typeof a.name !== "string" || !a.name) return null;
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

function extractEventsFromResponse(rawContent: string): ParsedEvent[] {
  const content = stripCodeFences(rawContent);

  const direct = tryParseJson<{ events?: any[] }>(removeTrailingCommas(content));
  if (direct?.events && Array.isArray(direct.events)) {
    return direct.events.map(normalizeEventShape).filter(Boolean) as ParsedEvent[];
  }

  // Fallback: scan out complete event objects
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
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{") { if (depth === 0) objStart = i; depth++; continue; }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && objStart !== -1) {
        const parsed = tryParseJson<any>(removeTrailingCommas(content.slice(objStart, i + 1)));
        const normalized = normalizeEventShape(parsed);
        if (normalized) events.push(normalized);
        objStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }

  return events;
}

const AI_PROMPT = `Parse this swim meet heat sheet PDF. Extract ONLY structured data, NO raw text.

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
- Return ONLY valid JSON, no markdown, no explanation`;

async function callAI(apiKey: string, pdfBase64: string, pageHint?: string): Promise<ParsedEvent[]> {
  const promptText = pageHint ? `${AI_PROMPT}\n\nNote: This is ${pageHint} of the document.` : AI_PROMPT;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
        ],
      }],
      temperature: 0,
      max_tokens: 32000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('AI API error:', response.status, errText);
    throw new Error(`AI processing failed: ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || '';
  console.log('AI chunk response length:', content.length);
  return extractEventsFromResponse(content);
}

// Split a PDF (as Uint8Array) into N roughly-equal byte chunks for parallel processing.
// Since we can't split pages without a full PDF library, we send the full PDF but ask
// the AI to focus on different page ranges. For very large PDFs (>2MB) we split into
// parallel requests on the same base64 but with different page-range hints.
const CHUNK_THRESHOLD = 2 * 1024 * 1024; // 2MB
const MAX_CHUNKS = 3;

function estimatePageCount(sizeBytes: number): number {
  // Rough heuristic: ~30KB per page for a typical heat sheet PDF
  return Math.max(1, Math.round(sizeBytes / 30000));
}

function buildPageRanges(estimatedPages: number, numChunks: number): string[] {
  const pagesPerChunk = Math.ceil(estimatedPages / numChunks);
  const ranges: string[] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * pagesPerChunk + 1;
    const end = Math.min((i + 1) * pagesPerChunk, estimatedPages);
    ranges.push(`pages ${start}-${end}`);
  }
  return ranges;
}

function deduplicateEvents(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Map<string, ParsedEvent>();
  for (const e of events) {
    // Key by event number + name to deduplicate across chunks
    const key = `${e.eventNumber ?? 'null'}_${e.eventName}`;
    const existing = seen.get(key);
    if (!existing || (e.athletes.length > existing.athletes.length)) {
      seen.set(key, e);
    }
  }
  return Array.from(seen.values()).sort((a, b) => (a.eventNumber ?? 999) - (b.eventNumber ?? 999));
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
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching PDF from:', pdfUrl);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch PDF: ${pdfResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    console.log('PDF size:', pdfBuffer.byteLength, 'bytes');

    let allEvents: ParsedEvent[];

    if (pdfBuffer.byteLength > CHUNK_THRESHOLD) {
      // Large PDF: send parallel requests with page-range hints
      const estimatedPages = estimatePageCount(pdfBuffer.byteLength);
      const numChunks = Math.min(MAX_CHUNKS, Math.max(2, Math.ceil(estimatedPages / 15)));
      const pageRanges = buildPageRanges(estimatedPages, numChunks);

      console.log(`Large PDF detected. Estimated ${estimatedPages} pages, splitting into ${numChunks} parallel requests`);

      const results = await Promise.allSettled(
        pageRanges.map(range => callAI(apiKey, pdfBase64, range))
      );

      allEvents = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        } else {
          console.error('Chunk failed:', result.reason);
        }
      }

      allEvents = deduplicateEvents(allEvents);
    } else {
      // Small PDF: single request
      allEvents = await callAI(apiKey, pdfBase64);
    }

    if (!allEvents || allEvents.length === 0) {
      console.error('No events extracted');
      return new Response(
        JSON.stringify({
          success: true,
          rawContent: 'Parsed 0 events (fallback)',
          events: [{ eventNumber: null, eventName: 'Parse Error - Manual Review Required', athletes: [], rawText: '' }],
          meetId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const events = allEvents.map((event, index) => ({
      ...event,
      rawText: event.rawText || `Event ${event.eventNumber || index + 1}: ${event.eventName}`,
    }));

    console.log('Total parsed events:', events.length);

    return new Response(
      JSON.stringify({ success: true, rawContent: `Parsed ${events.length} events`, events, meetId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to parse PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
