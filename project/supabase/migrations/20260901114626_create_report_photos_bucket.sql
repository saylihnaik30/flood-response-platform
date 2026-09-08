/*
# FloodPulse: Create storage bucket for report photos
- Creates a public storage bucket 'report-photos' for citizen-submitted photos.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon to upload photos
DROP POLICY IF EXISTS "anon_upload_report_photos" ON storage.objects;
CREATE POLICY "anon_upload_report_photos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'report-photos');

-- Allow public read
DROP POLICY IF EXISTS "anon_read_report_photos" ON storage.objects;
CREATE POLICY "anon_read_report_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'report-photos');