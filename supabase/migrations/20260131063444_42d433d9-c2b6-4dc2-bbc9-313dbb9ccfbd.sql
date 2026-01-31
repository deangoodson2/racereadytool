-- Create table for storing uploaded meets and their parsed data
CREATE TABLE public.meets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT,
  raw_content TEXT,
  parsed_events JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing individual events from parsed meets
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meet_id UUID NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE,
  event_number INTEGER,
  event_name TEXT NOT NULL,
  athletes JSONB DEFAULT '[]'::jsonb,
  raw_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_meets_status ON public.meets(status);
CREATE INDEX idx_events_meet_id ON public.events(meet_id);

-- Enable RLS but allow public access for MVP (no auth yet)
ALTER TABLE public.meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for MVP
CREATE POLICY "Allow public read on meets" ON public.meets FOR SELECT USING (true);
CREATE POLICY "Allow public insert on meets" ON public.meets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on meets" ON public.meets FOR UPDATE USING (true);

CREATE POLICY "Allow public read on events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow public insert on events" ON public.events FOR INSERT WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meets_updated_at
BEFORE UPDATE ON public.meets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();