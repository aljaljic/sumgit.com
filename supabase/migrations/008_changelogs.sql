-- Changelogs table for persisting generated repository changelogs
CREATE TABLE changelogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    grouping TEXT NOT NULL DEFAULT 'date',
    changelog_data JSONB NOT NULL,
    markdown TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(repository_id, user_id)
);

-- Index for looking up changelogs by user
CREATE INDEX changelogs_user_id_idx ON changelogs(user_id);

-- Enable Row Level Security
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;

-- Users can read their own changelogs
CREATE POLICY "Users can read own changelogs" ON changelogs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own changelogs
CREATE POLICY "Users can insert own changelogs" ON changelogs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own changelogs
CREATE POLICY "Users can update own changelogs" ON changelogs
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own changelogs
CREATE POLICY "Users can delete own changelogs" ON changelogs
    FOR DELETE USING (auth.uid() = user_id);
