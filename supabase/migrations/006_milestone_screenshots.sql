-- Add milestone type and screenshot fields to milestones table
ALTER TABLE public.milestones
ADD COLUMN IF NOT EXISTS milestone_type text DEFAULT 'other',
ADD COLUMN IF NOT EXISTS screenshot_url text,
ADD COLUMN IF NOT EXISTS screenshot_target jsonb;

-- Add site_url to repositories for caching
ALTER TABLE public.repositories
ADD COLUMN IF NOT EXISTS site_url text,
ADD COLUMN IF NOT EXISTS site_url_source text;

-- Create storage bucket for milestone screenshots (run manually in Supabase dashboard or via CLI)
-- This is informational - storage buckets are created via the Supabase dashboard or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('milestone-screenshots', 'milestone-screenshots', true);

-- Note: RLS policies for storage bucket should be configured in Supabase dashboard:
-- - Allow public read access to all files
-- - Allow authenticated users to upload files

COMMENT ON COLUMN milestones.milestone_type IS 'Type of milestone: feature, bugfix, refactor, docs, config, other';
COMMENT ON COLUMN milestones.screenshot_url IS 'URL to the captured screenshot in Supabase Storage';
COMMENT ON COLUMN milestones.screenshot_target IS 'JSON config for screenshot capture: url_path, element_selector, viewport, full_page';
COMMENT ON COLUMN repositories.site_url IS 'Deployed site URL extracted from repository metadata';
COMMENT ON COLUMN repositories.site_url_source IS 'Source of site_url: homepage, readme, package_json';
