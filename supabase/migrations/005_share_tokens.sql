-- Share tokens for embeddable widgets
CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(21) UNIQUE NOT NULL,  -- nanoid
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('milestones', 'timeline', 'recap', 'story')),
    config JSONB DEFAULT '{"theme": "light", "showBranding": true}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up share tokens by token (for widget rendering)
CREATE INDEX share_tokens_token_idx ON share_tokens(token) WHERE is_active = true;

-- Index for looking up user's share tokens
CREATE INDEX share_tokens_user_id_idx ON share_tokens(user_id);

-- Index for looking up share tokens by repository
CREATE INDEX share_tokens_repository_id_idx ON share_tokens(repository_id);

-- Enable Row Level Security
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own tokens
CREATE POLICY "Users can read own share tokens" ON share_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read active tokens (for widget rendering via service role or anon)
CREATE POLICY "Anyone can read active share tokens" ON share_tokens
    FOR SELECT USING (is_active = true);

-- Users can insert their own share tokens
CREATE POLICY "Users can insert own share tokens" ON share_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own share tokens
CREATE POLICY "Users can update own share tokens" ON share_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own share tokens
CREATE POLICY "Users can delete own share tokens" ON share_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_share_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER share_tokens_updated_at
    BEFORE UPDATE ON share_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_share_tokens_updated_at();
