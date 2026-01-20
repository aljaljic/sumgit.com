-- Security Hardening Migration
-- Addresses: RPC Function Enumeration, Memory Exhaustion, Rate Limiting

-- ============================================================================
-- RATE LIMITING
-- ============================================================================

-- Create rate_limits table for tracking request counts
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, operation, window_start)
);

-- Index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_operation ON rate_limits(user_id, operation, window_start DESC);

-- Enable RLS on rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service_role can access rate_limits directly
CREATE POLICY "Service role can manage rate limits"
    ON rate_limits FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Function to check and update rate limit
-- Returns TRUE if request is allowed, FALSE if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_operation TEXT,
    p_max_requests INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INTEGER;
BEGIN
    -- Calculate the start of the current window
    v_window_start := date_trunc('minute', NOW()) - (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute';

    -- Try to get existing count for this window
    SELECT request_count INTO v_current_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND operation = p_operation
      AND window_start = v_window_start
    FOR UPDATE;

    IF FOUND THEN
        -- Check if limit exceeded
        IF v_current_count >= p_max_requests THEN
            RETURN FALSE;
        END IF;

        -- Increment counter
        UPDATE rate_limits
        SET request_count = request_count + 1
        WHERE user_id = p_user_id
          AND operation = p_operation
          AND window_start = v_window_start;
    ELSE
        -- Create new rate limit record
        INSERT INTO rate_limits (user_id, operation, window_start, request_count)
        VALUES (p_user_id, p_operation, v_window_start, 1)
        ON CONFLICT (user_id, operation, window_start)
        DO UPDATE SET request_count = rate_limits.request_count + 1;
    END IF;

    RETURN TRUE;
END;
$$;

-- Cleanup old rate limit records (run periodically via cron or trigger)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- ============================================================================
-- SECURE RPC FUNCTIONS (with search_path and input validation)
-- ============================================================================

-- Drop and recreate deduct_credits with security hardening
DROP FUNCTION IF EXISTS deduct_credits(UUID, INTEGER, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_operation_type TEXT,
    p_repository_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_valid_operations TEXT[] := ARRAY['quick_analyze', 'timeline_analyze', 'generate_story', 'generate_recap'];
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User ID is required'::TEXT;
        RETURN;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 'Amount must be a positive integer'::TEXT;
        RETURN;
    END IF;

    -- Validate amount limits (prevent abuse)
    IF p_amount > 100 THEN
        RETURN QUERY SELECT FALSE, 0, 'Amount exceeds maximum allowed (100)'::TEXT;
        RETURN;
    END IF;

    -- Validate operation type
    IF p_operation_type IS NULL OR NOT (p_operation_type = ANY(v_valid_operations)) THEN
        RETURN QUERY SELECT FALSE, 0, 'Invalid operation type'::TEXT;
        RETURN;
    END IF;

    -- Check rate limit (max 60 operations per hour)
    IF NOT check_rate_limit(p_user_id, 'deduct_credits', 60, 60) THEN
        RETURN QUERY SELECT FALSE, 0, 'Rate limit exceeded'::TEXT;
        RETURN;
    END IF;

    -- Lock the row for update to prevent race conditions
    SELECT balance INTO v_current_balance
    FROM credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- If no balance record exists, return error
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 'No credit balance found for user'::TEXT;
        RETURN;
    END IF;

    -- Check if sufficient balance
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance - p_amount;

    -- Update balance
    UPDATE credit_balances
    SET balance = v_new_balance,
        lifetime_used = lifetime_used + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Record transaction
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type,
        operation_type, repository_id, description
    ) VALUES (
        p_user_id, -p_amount, v_new_balance, 'usage',
        p_operation_type, p_repository_id, p_description
    );

    RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Drop and recreate add_credits with security hardening
DROP FUNCTION IF EXISTS add_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type TEXT,
    p_stripe_session_id TEXT DEFAULT NULL,
    p_stripe_payment_intent_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_balance INTEGER;
    v_is_purchase BOOLEAN;
    v_valid_types TEXT[] := ARRAY['welcome_bonus', 'purchase', 'refund', 'admin_adjustment'];
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User ID is required'::TEXT;
        RETURN;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 'Amount must be a positive integer'::TEXT;
        RETURN;
    END IF;

    -- Validate amount limits (prevent abuse - max 10000 credits per transaction)
    IF p_amount > 10000 THEN
        RETURN QUERY SELECT FALSE, 0, 'Amount exceeds maximum allowed (10000)'::TEXT;
        RETURN;
    END IF;

    -- Validate transaction type
    IF p_transaction_type IS NULL OR NOT (p_transaction_type = ANY(v_valid_types)) THEN
        RETURN QUERY SELECT FALSE, 0, 'Invalid transaction type'::TEXT;
        RETURN;
    END IF;

    v_is_purchase := p_transaction_type IN ('purchase', 'welcome_bonus');

    -- Upsert balance record
    INSERT INTO credit_balances (user_id, balance, lifetime_purchased)
    VALUES (p_user_id, p_amount, CASE WHEN v_is_purchase THEN p_amount ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = credit_balances.balance + p_amount,
        lifetime_purchased = credit_balances.lifetime_purchased + CASE WHEN v_is_purchase THEN p_amount ELSE 0 END,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- Record transaction
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type,
        stripe_session_id, stripe_payment_intent_id, description
    ) VALUES (
        p_user_id, p_amount, v_new_balance, p_transaction_type,
        p_stripe_session_id, p_stripe_payment_intent_id, p_description
    );

    RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Drop and recreate refund_credits with security hardening
DROP FUNCTION IF EXISTS refund_credits(UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION refund_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_operation_type TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_balance INTEGER;
    v_valid_operations TEXT[] := ARRAY['quick_analyze', 'timeline_analyze', 'generate_story', 'generate_recap'];
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User ID is required'::TEXT;
        RETURN;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 'Amount must be a positive integer'::TEXT;
        RETURN;
    END IF;

    -- Validate amount limits
    IF p_amount > 100 THEN
        RETURN QUERY SELECT FALSE, 0, 'Refund amount exceeds maximum allowed (100)'::TEXT;
        RETURN;
    END IF;

    -- Validate operation type
    IF p_operation_type IS NULL OR NOT (p_operation_type = ANY(v_valid_operations)) THEN
        RETURN QUERY SELECT FALSE, 0, 'Invalid operation type'::TEXT;
        RETURN;
    END IF;

    -- Update balance
    UPDATE credit_balances
    SET balance = balance + p_amount,
        lifetime_used = GREATEST(0, lifetime_used - p_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 'No credit balance found for user'::TEXT;
        RETURN;
    END IF;

    -- Record transaction
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type,
        operation_type, description
    ) VALUES (
        p_user_id, p_amount, v_new_balance, 'refund',
        p_operation_type, COALESCE(p_description, 'Refund for failed ' || p_operation_type)
    );

    RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Recreate give_welcome_credits with search_path
DROP FUNCTION IF EXISTS give_welcome_credits();

CREATE OR REPLACE FUNCTION give_welcome_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Insert initial credit balance with 10 free credits
    INSERT INTO credit_balances (user_id, balance, lifetime_purchased)
    VALUES (NEW.id, 10, 10);

    -- Record the welcome bonus transaction
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, description
    ) VALUES (
        NEW.id, 10, 10, 'welcome_bonus', 'Welcome bonus - 10 free credits'
    );

    RETURN NEW;
END;
$$;

-- ============================================================================
-- ROW COUNT LIMITS (prevent enumeration/abuse)
-- ============================================================================

-- Trigger function to limit repositories per user (max 100)
CREATE OR REPLACE FUNCTION check_repository_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM repositories
    WHERE user_id = NEW.user_id;

    IF v_count >= 100 THEN
        RAISE EXCEPTION 'Maximum repository limit (100) reached for user';
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for repository limit
DROP TRIGGER IF EXISTS enforce_repository_limit ON repositories;
CREATE TRIGGER enforce_repository_limit
    BEFORE INSERT ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION check_repository_limit();

-- Trigger function to limit milestones per repository (max 1000)
CREATE OR REPLACE FUNCTION check_milestone_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM milestones
    WHERE repository_id = NEW.repository_id;

    IF v_count >= 1000 THEN
        RAISE EXCEPTION 'Maximum milestone limit (1000) reached for repository';
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for milestone limit
DROP TRIGGER IF EXISTS enforce_milestone_limit ON milestones;
CREATE TRIGGER enforce_milestone_limit
    BEFORE INSERT ON milestones
    FOR EACH ROW
    EXECUTE FUNCTION check_milestone_limit();

-- ============================================================================
-- REVOKE PUBLIC PERMISSIONS & RE-GRANT APPROPRIATELY
-- ============================================================================

-- Revoke execute from public and anon on all functions
REVOKE EXECUTE ON FUNCTION check_rate_limit FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cleanup_old_rate_limits FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION deduct_credits FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION add_credits FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION refund_credits FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION give_welcome_credits FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION check_repository_limit FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION check_milestone_limit FROM PUBLIC, anon;

-- Grant execute permissions appropriately
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO service_role;
GRANT EXECUTE ON FUNCTION refund_credits TO service_role;

-- Trigger functions don't need explicit grants (they run as definer)
