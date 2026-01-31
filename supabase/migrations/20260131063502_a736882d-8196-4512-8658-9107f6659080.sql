-- Create storage bucket for meet PDF uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('meet-pdfs', 'meet-pdfs', true);

-- Allow public upload and read for MVP
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meet-pdfs');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'meet-pdfs');