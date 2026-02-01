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
                text: `You are a swim meet PDF parser. Extract all events and athletes from this swim meet heat sheet PDF.

For each event, extract:
- Event number (if present)
- Event name (e.g., "Girls 11-12 50 Yard Freestyle")
- List of athletes with: name, team/club abbreviation, heat number, lane number, seed time

Return the data as a JSON object with this exact structure:
{
  "events": [
    {
      "eventNumber": 1,
      "eventName": "Girls 11-12 50 Yard Freestyle",
      "athletes": [
        {"name": "Jane Smith", "team": "ABCD", "heat": 1, "lane": 4, "seedTime": "32.45"},
        ...
      ]
    },
    ...
  ],
  "rawText": "The full text content of the PDF for reference"
}

Be thorough and extract ALL events and athletes. If you can't determine a value, omit that field. Return ONLY valid JSON, no markdown or explanation.`
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
        max_tokens: 16000,
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

    // Parse the AI response
    let parsedData: { events: ParsedEvent[]; rawText: string };
    try {
      // Remove markdown code blocks if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();
      
      parsedData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // If parsing fails, create a fallback structure
      parsedData = {
        events: [{
          eventNumber: null,
          eventName: 'Meet Content (Manual Review Required)',
          athletes: [],
          rawText: content.substring(0, 5000),
        }],
        rawText: content,
      };
    }

    // Ensure events have rawText
    const events = (parsedData.events || []).map((event, index) => ({
      ...event,
      rawText: event.rawText || `Event ${event.eventNumber || index + 1}: ${event.eventName}`,
    }));

    console.log('Parsed events count:', events.length);

    return new Response(
      JSON.stringify({
        success: true,
        rawContent: parsedData.rawText || content,
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
