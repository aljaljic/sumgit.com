# Supabase Dashboard Security Configuration

This document outlines the manual configuration steps required in the Supabase Dashboard to complete the security hardening for sumgit.com.

## Prerequisites

- Access to the Supabase Dashboard for the sumgit.com project
- Admin privileges on the Supabase project

## Configuration Steps

### 1. Authentication Providers

Navigate to: **Authentication > Providers**

**Actions:**
- Keep **GitHub** enabled (this is the only auth method used)
- **Disable** all other providers:
  - Email
  - Phone
  - Anonymous
  - Any other third-party providers

**Rationale:** This app uses GitHub OAuth exclusively. Disabling unused providers reduces attack surface.

### 2. Rate Limits

Navigate to: **Authentication > Rate Limits**

**Recommended settings:**

| Setting | Value | Notes |
|---------|-------|-------|
| Token refresh | 360/hour | Default, reasonable for active users |
| Email sending | 4/hour | Safety limit (not used with GitHub OAuth) |
| OTP verification | 15/hour | Safety limit (not used with GitHub OAuth) |
| Sign in attempts | 10/hour | Per IP address |
| Sign up attempts | 3/hour | Per IP address (handled by GitHub) |

**Rationale:** Even though we use GitHub OAuth, configuring rate limits provides defense-in-depth against any future auth flow changes.

### 3. URL Configuration

Navigate to: **Authentication > URL Configuration**

**Site URL:**
```
https://sumgit.com
```

**Redirect URLs (Whitelist):**
- `https://sumgit.com/auth/callback`
- `https://sumgit.com/github/callback`
- `http://localhost:5173/*` (development only - consider removing in production)

**Remove any other redirect URLs** that are not in this list.

**Rationale:** Restricting redirect URLs prevents open redirect attacks.

### 4. Auth Settings

Navigate to: **Authentication > Settings**

**Recommended settings:**

| Setting | Value | Notes |
|---------|-------|-------|
| JWT Expiry | 3600 seconds (1 hour) | Balance between security and UX |
| Enable secure email change | Yes | Requires email confirmation |
| Enable manual linking | No | Prevents account linking attacks |
| Minimum password length | 8+ | N/A for GitHub OAuth |
| Double confirm email changes | Yes | Additional security |

### 5. Database Configuration

Navigate to: **Database > Extensions**

**Ensure these extensions are enabled:**
- `uuid-ossp` (for UUID generation)
- `pgcrypto` (for cryptographic functions)

### 6. Apply SQL Migration

Run the security hardening migration:

```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Using the SQL Editor in Dashboard
# Navigate to SQL Editor and run the contents of:
# supabase/migrations/004_security_hardening.sql
```

**What the migration does:**
- Adds rate limiting table and function
- Hardens RPC functions with `SET search_path`
- Adds input validation to all credit functions
- Creates row count limits (100 repos/user, 1000 milestones/repo)
- Revokes public execute permissions on functions

### 7. API Settings

Navigate to: **Settings > API**

**Actions:**
- Regenerate API keys if they've been exposed
- Note: The JWT secret should never be shared or committed to code

### 8. Verify Security Headers

After deploying the updated code, verify security headers are working:

```bash
curl -I https://sumgit.com/api/credits
```

**Expected headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: ...`

**Should NOT see:**
- `x-supabase-api-version` (removed to prevent version disclosure)

## Verification Checklist

After completing all configuration:

- [ ] GitHub OAuth login works correctly
- [ ] Redirect URLs are validated (test with invalid URLs)
- [ ] Security headers are present on all responses
- [ ] Rate limiting is active (test by making many requests)
- [ ] Error messages don't expose internal details
- [ ] Credit operations work correctly with new validation

## Maintenance

### Periodic Tasks

1. **Review rate limit logs** - Check for abuse patterns
2. **Rotate API keys** - Every 90 days or after any suspected exposure
3. **Review access logs** - Check for suspicious activity
4. **Update dependencies** - Keep Supabase client libraries updated

### Rate Limit Cleanup

The database includes a cleanup function for old rate limit records. Consider setting up a scheduled job:

```sql
-- Run daily to clean up old rate limit records
SELECT cron.schedule('cleanup-rate-limits', '0 0 * * *', 'SELECT cleanup_old_rate_limits()');
```

Or call it periodically from your application.

## Security Contact

If you discover a security vulnerability, please report it responsibly by contacting the repository maintainers directly.
