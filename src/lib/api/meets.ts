import { supabase } from "@/integrations/supabase/client";

export interface MeetEvent {
  id: string;
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

export interface Meet {
  id: string;
  fileName: string;
  fileUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  events: MeetEvent[];
  createdAt: string;
}

export async function uploadMeetPdf(file: File): Promise<{ meetId: string; fileUrl: string }> {
  const fileName = `${Date.now()}-${file.name}`;
  
  // Upload file to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('meet-pdfs')
    .upload(fileName, file, {
      contentType: 'application/pdf',
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('meet-pdfs')
    .getPublicUrl(fileName);

  const fileUrl = urlData.publicUrl;

  // Create meet record
  const { data: meetData, error: meetError } = await supabase
    .from('meets')
    .insert({
      file_name: file.name,
      file_url: fileUrl,
      status: 'processing',
    })
    .select('id')
    .single();

  if (meetError) {
    throw new Error(`Failed to create meet record: ${meetError.message}`);
  }

  return { meetId: meetData.id, fileUrl };
}

export async function parseMeetPdf(meetId: string, fileUrl: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('parse-meet-pdf', {
    body: { pdfUrl: fileUrl, meetId },
  });

  if (error) {
    // Update meet status to failed
    await supabase
      .from('meets')
      .update({ status: 'failed', error_message: error.message })
      .eq('id', meetId);
    throw new Error(`Parsing failed: ${error.message}`);
  }

  if (!data.success) {
    await supabase
      .from('meets')
      .update({ status: 'failed', error_message: data.error })
      .eq('id', meetId);
    throw new Error(data.error || 'Parsing failed');
  }

  // Store the parsed content
  await supabase
    .from('meets')
    .update({
      raw_content: data.rawContent,
      parsed_events: data.events,
      status: 'completed',
    })
    .eq('id', meetId);

  // Store individual events
  if (data.events && data.events.length > 0) {
    const eventsToInsert = data.events.map((event: any, index: number) => ({
      meet_id: meetId,
      event_number: event.eventNumber,
      event_name: event.eventName,
      athletes: event.athletes,
      raw_text: event.rawText,
    }));

    await supabase.from('events').insert(eventsToInsert);
  }
}

export async function getMeet(meetId: string): Promise<Meet | null> {
  const { data: meetData, error: meetError } = await supabase
    .from('meets')
    .select('*')
    .eq('id', meetId)
    .single();

  if (meetError || !meetData) {
    return null;
  }

  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('meet_id', meetId)
    .order('event_number', { ascending: true });

  return {
    id: meetData.id,
    fileName: meetData.file_name,
    fileUrl: meetData.file_url,
    status: meetData.status as Meet['status'],
    errorMessage: meetData.error_message,
    events: (eventsData || []).map((e) => ({
      id: e.id,
      eventNumber: e.event_number,
      eventName: e.event_name,
      athletes: (e.athletes as any[]) || [],
      rawText: e.raw_text || '',
    })),
    createdAt: meetData.created_at,
  };
}

export async function getLatestMeet(): Promise<Meet | null> {
  const { data: meetData, error: meetError } = await supabase
    .from('meets')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (meetError || !meetData) {
    return null;
  }

  return getMeet(meetData.id);
}
