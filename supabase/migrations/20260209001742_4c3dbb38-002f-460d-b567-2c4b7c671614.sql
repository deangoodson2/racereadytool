
CREATE TABLE public.meet_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meet_id UUID NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  swimmer_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meet_id, email, swimmer_name)
);

ALTER TABLE public.meet_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert on meet_subscribers"
  ON public.meet_subscribers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read on meet_subscribers"
  ON public.meet_subscribers FOR SELECT
  USING (true);

CREATE POLICY "Allow public delete on meet_subscribers"
  ON public.meet_subscribers FOR DELETE
  USING (true);
