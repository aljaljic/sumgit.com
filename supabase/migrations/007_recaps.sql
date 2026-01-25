-- Recaps table for persisting generated repository recaps
CREATE TABLE recaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    recap_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up recaps by repository (one per repo)
CREATE UNIQUE INDEX recaps_repository_id_idx ON recaps(repository_id);
CREATE INDEX recaps_user_id_idx ON recaps(user_id);

-- Enable Row Level Security
ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;

-- Users can read their own recaps
CREATE POLICY "Users can read own recaps" ON recaps
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own recaps
CREATE POLICY "Users can insert own recaps" ON recaps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own recaps
CREATE POLICY "Users can update own recaps" ON recaps
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own recaps
CREATE POLICY "Users can delete own recaps" ON recaps
    FOR DELETE USING (auth.uid() = user_id);
