-- ChatKit Threads table for storing conversation state
-- Used for authenticated screenshot credential collection

CREATE TABLE chatkit_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE NOT NULL,
  thread_id TEXT UNIQUE NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  encryption_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for fast lookup by thread_id
CREATE INDEX idx_chatkit_threads_thread_id ON chatkit_threads(thread_id);

-- Index for finding threads by user
CREATE INDEX idx_chatkit_threads_user_id ON chatkit_threads(user_id);

-- Index for finding expired threads (for cleanup)
CREATE INDEX idx_chatkit_threads_expires_at ON chatkit_threads(expires_at);

-- Enable Row Level Security
ALTER TABLE chatkit_threads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own threads
CREATE POLICY "Users can view own threads"
  ON chatkit_threads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own threads
CREATE POLICY "Users can insert own threads"
  ON chatkit_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own threads
CREATE POLICY "Users can update own threads"
  ON chatkit_threads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own threads
CREATE POLICY "Users can delete own threads"
  ON chatkit_threads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant service_role access (for server-side operations)
GRANT ALL ON chatkit_threads TO service_role;

-- Function to clean up expired threads (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_chatkit_threads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chatkit_threads
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Comment explaining the table
COMMENT ON TABLE chatkit_threads IS 'Stores conversation threads for ChatKit-based authenticated screenshot credential collection. Threads auto-expire after 1 hour.';
COMMENT ON COLUMN chatkit_threads.state IS 'Encrypted JSON state containing conversation progress and credential data';
COMMENT ON COLUMN chatkit_threads.encryption_key IS 'AES-256-GCM encryption key for credential data (base64 encoded)';
COMMENT ON COLUMN chatkit_threads.expires_at IS 'Thread expiry time - credentials are deleted after this time';
