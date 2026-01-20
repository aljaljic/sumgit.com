-- Stories table for persisting generated storybooks
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    narrative_style TEXT NOT NULL,
    chapters JSONB NOT NULL,
    share_token TEXT UNIQUE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up stories by share token (only for public stories)
CREATE INDEX stories_share_token_idx ON stories(share_token) WHERE share_token IS NOT NULL;

-- Index for looking up user's stories
CREATE INDEX stories_repository_id_idx ON stories(repository_id);
CREATE INDEX stories_user_id_idx ON stories(user_id);

-- Enable Row Level Security
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Users can read their own stories
CREATE POLICY "Users can read own stories" ON stories
    FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read public stories via share_token
CREATE POLICY "Anyone can read public stories" ON stories
    FOR SELECT USING (is_public = true AND share_token IS NOT NULL);

-- Users can insert their own stories
CREATE POLICY "Users can insert own stories" ON stories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own stories
CREATE POLICY "Users can update own stories" ON stories
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own stories
CREATE POLICY "Users can delete own stories" ON stories
    FOR DELETE USING (auth.uid() = user_id);
