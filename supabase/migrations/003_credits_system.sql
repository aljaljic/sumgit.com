-- Credits System Migration
-- Adds tables for credit balances, transactions, and Stripe customer mapping

-- Create credit_balances table
CREATE TABLE IF NOT EXISTS credit_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_purchased INTEGER NOT NULL DEFAULT 0,
    lifetime_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create credit_transactions table for audit log
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for additions, negative for deductions
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('welcome_bonus', 'purchase', 'usage', 'refund', 'admin_adjustment')),
    operation_type TEXT, -- 'quick_analyze', 'timeline_analyze', 'generate_story'
    repository_id UUID REFERENCES repositories(id) ON DELETE SET NULL,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(stripe_customer_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_balances_user_id ON credit_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- Enable RLS
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_balances
CREATE POLICY "Users can view their own credit balance"
    ON credit_balances FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view their own credit transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policies for stripe_customers
CREATE POLICY "Users can view their own stripe customer record"
    ON stripe_customers FOR SELECT
    USING (auth.uid() = user_id);

-- Function to deduct credits atomically with row locking
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
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
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

-- Function to add credits
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
AS $$
DECLARE
    v_new_balance INTEGER;
    v_is_purchase BOOLEAN;
BEGIN
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

-- Function to refund credits (for failed operations)
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
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
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

-- Trigger function to give new users welcome bonus
CREATE OR REPLACE FUNCTION give_welcome_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger on profiles table (assuming profiles are created on signup)
DROP TRIGGER IF EXISTS on_profile_created_give_credits ON profiles;
CREATE TRIGGER on_profile_created_give_credits
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION give_welcome_credits();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO service_role;
GRANT EXECUTE ON FUNCTION refund_credits TO service_role;
