
CREATE POLICY "feed-images auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'feed-images');
CREATE POLICY "feed-images user upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "feed-images user delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'feed-images' AND auth.uid()::text = (storage.foldername(name))[1]);
