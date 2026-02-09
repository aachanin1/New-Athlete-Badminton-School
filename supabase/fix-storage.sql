-- Run this in Supabase SQL Editor to fix payment slip upload
-- ─── Create storage bucket if not exists ──────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ─── Storage RLS policies ─────────────────────────────────
-- Allow authenticated users to upload slips
CREATE POLICY "Users can upload payment slips" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-slips' AND auth.uid() IS NOT NULL);

-- Allow anyone to view slips (for admin review)
CREATE POLICY "Users can view payment slips" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-slips');

-- Allow users to update their own slips
CREATE POLICY "Users can update own payment slips" ON storage.objects
  FOR UPDATE USING (bucket_id = 'payment-slips' AND auth.uid() IS NOT NULL);
