-- GitHub App installations table
-- Stores installation IDs when users install the GitHub App on their accounts/orgs
create table if not exists public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  installation_id bigint not null unique,
  account_login text not null,  -- GitHub username or org name
  account_type text not null,   -- 'User' or 'Organization'
  created_at timestamptz default now() not null
);

-- Index for faster lookups
create index if not exists idx_github_installations_user_id on public.github_installations(user_id);
create index if not exists idx_github_installations_installation_id on public.github_installations(installation_id);

-- Enable RLS
alter table public.github_installations enable row level security;

-- RLS policies
create policy "Users can view their own installations"
  on public.github_installations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own installations"
  on public.github_installations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own installations"
  on public.github_installations for delete
  using (auth.uid() = user_id);

-- Remove github_access_token from profiles (no longer needed with GitHub App)
-- We'll keep it for now in case of rollback, but it won't be used
