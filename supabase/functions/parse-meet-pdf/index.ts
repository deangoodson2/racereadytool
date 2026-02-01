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

function extractJsonFromResponse(content: string): { events: ParsedEvent[] } | null {
  // Try to extract JSON from response, handling truncation
  let jsonContent = content.trim();
  
  // Remove markdown code blocks if present
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.slice(7);
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.slice(3);
  }
  if (jsonContent.endsWith('```')) {
    jsonContent = jsonContent.slice(0, -3);
  }
  jsonContent = jsonContent.trim();

  // Try direct parse first
  try {
    return JSON.parse(jsonContent);
  } catch {
    // Response may be truncated, try to fix it
  }

  // Find where events array might have been truncated and try to close it
  const eventsMatch = jsonContent.match(/"events"\s*:\s*\[/);
  if (!eventsMatch) {
    return null;
  }

  // Try to find complete events and construct valid JSON
  const events: ParsedEvent[] = [];
  
  // Match individual event objects
  const eventRegex = /\{\s*"eventNumber"\s*:\s*(\d+|null)\s*,\s*"eventName"\s*:\s*"([^"]+)"\s*,\s*"athletes"\s*:\s*\[([^\]]*)\]/g;
  let match;
  
  while ((match = eventRegex.exec(jsonContent)) !== null) {
    const eventNumber = match[1] === 'null' ? null : parseInt(match[1]);
    const eventName = match[2];
    const athletesStr = match[3];
    
    // Parse athletes array
    const athletes: ParsedEvent['athletes'] = [];
    const athleteRegex = /\{\s*"name"\s*:\s*"([^"]+)"(?:\s*,\s*"team"\s*:\s*"([^"]*)")?(?:\s*,\s*"heat"\s*:\s*(\d+))?(?:\s*,\s*"lane"\s*:\s*(\d+))?(?:\s*,\s*"seedTime"\s*:\s*"([^"]*)")?\s*\}/g;
    let athleteMatch;
    
    while ((athleteMatch = athleteRegex.exec(athletesStr)) !== null) {
      athletes.push({
        name: athleteMatch[1],
        team: athleteMatch[2] || undefined,
        heat: athleteMatch[3] ? parseInt(athleteMatch[3]) : undefined,
        lane: athleteMatch[4] ? parseInt(athleteMatch[4]) : undefined,
        seedTime: athleteMatch[5] || undefined,
      });
    }
    
    events.push({
      eventNumber,
      eventName,
      athletes,
      rawText: `Event ${eventNumber || 'N/A'}: ${eventName}`,
    });
  }

  if (events.length > 0) {
    return { events };
  }

  return null;
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
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
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
    let parsedData = extractJsonFromResponse(content);
    
    if (!parsedData || !parsedData.events || parsedData.events.length === 0) {
      console.error('Failed to extract events from AI response');
      console.log('Response preview:', content.substring(0, 500));
      
      // Create a fallback with raw content for debugging
      parsedData = {
        events: [{
          eventNumber: null,
          eventName: 'Parse Error - Manual Review Required',
          athletes: [],
          rawText: content.substring(0, 2000),
        }],
      };
    }

    // Ensure events have rawText
    const events = (parsedData.events || []).map((event, index) => ({
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
