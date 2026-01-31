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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping PDF URL:', pdfUrl);

    // Use Firecrawl to extract content from the PDF
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pdfUrl,
        formats: ['markdown'],
        onlyMainContent: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Firecrawl request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    console.log('Extracted content length:', markdown.length);

    // Parse the markdown to extract events and athletes
    const events = parseSwimMeetContent(markdown);
    console.log('Parsed events count:', events.length);

    return new Response(
      JSON.stringify({
        success: true,
        rawContent: markdown,
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

function parseSwimMeetContent(content: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = content.split('\n');
  
  let currentEvent: ParsedEvent | null = null;
  
  // Common patterns for swim meet events
  const eventHeaderPatterns = [
    /^#*\s*Event\s+(\d+)\s+(.+)/i,
    /^(\d+)\s*[-–]\s*(.+)/,
    /^Event\s+#?(\d+)\s*[-–:]\s*(.+)/i,
    /^#*\s*(\d+)\s+(.+?\s+(?:Freestyle|Backstroke|Breaststroke|Butterfly|IM|Individual Medley|Relay|Medley Relay))/i,
  ];
  
  // Athlete/heat patterns
  const athletePatterns = [
    /^\s*(\d+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(\d+)\s+([A-Z0-9\-]+)\s*([\d:.]+)?/i,
    /^\s*Lane\s+(\d+)\s*[-–:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /^\|?\s*(\d+)\s*\|?\s*([A-Za-z\s]+)\s*\|?\s*([A-Z0-9\-]+)?\s*\|?\s*([\d:.]+)?\s*\|?/,
  ];
  
  const heatPattern = /Heat\s+(\d+)/i;
  let currentHeat = 1;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check for heat number
    const heatMatch = trimmedLine.match(heatPattern);
    if (heatMatch) {
      currentHeat = parseInt(heatMatch[1], 10);
      continue;
    }
    
    // Check for event header
    let eventMatch = null;
    for (const pattern of eventHeaderPatterns) {
      eventMatch = trimmedLine.match(pattern);
      if (eventMatch) break;
    }
    
    if (eventMatch) {
      if (currentEvent && currentEvent.eventName) {
        events.push(currentEvent);
      }
      currentEvent = {
        eventNumber: eventMatch[1] ? parseInt(eventMatch[1], 10) : null,
        eventName: eventMatch[2]?.trim() || trimmedLine,
        athletes: [],
        rawText: trimmedLine,
      };
      currentHeat = 1;
      continue;
    }
    
    // If we have a current event, try to parse athletes
    if (currentEvent) {
      for (const pattern of athletePatterns) {
        const athleteMatch = trimmedLine.match(pattern);
        if (athleteMatch) {
          const athlete = {
            lane: athleteMatch[1] ? parseInt(athleteMatch[1], 10) : undefined,
            name: athleteMatch[2]?.trim() || '',
            team: athleteMatch[3]?.trim(),
            heat: currentHeat,
            seedTime: athleteMatch[4]?.trim(),
          };
          if (athlete.name && athlete.name.length > 2) {
            currentEvent.athletes.push(athlete);
          }
          break;
        }
      }
      currentEvent.rawText += '\n' + trimmedLine;
    }
  }
  
  // Don't forget the last event
  if (currentEvent && currentEvent.eventName) {
    events.push(currentEvent);
  }
  
  // If no events were parsed with the patterns, create a single "unparsed" event
  if (events.length === 0 && content.length > 100) {
    events.push({
      eventNumber: null,
      eventName: 'Meet Content (Manual Review Required)',
      athletes: [],
      rawText: content.substring(0, 5000),
    });
  }
  
  return events;
}
