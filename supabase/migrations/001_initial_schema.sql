-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users profiles table (extends Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  github_username text,
  github_access_token text,
  created_at timestamptz default now() not null
);

-- Connected repositories
create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  github_repo_url text not null,
  repo_name text not null,
  repo_owner text not null,
  last_analyzed_at timestamptz,
  created_at timestamptz default now() not null
);

-- Milestones extracted by OpenAI
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.repositories(id) on delete cascade not null,
  title text not null,
  description text,
  commit_sha text,
  milestone_date date not null,
  x_post_suggestion text,
  created_at timestamptz default now() not null
);

-- Create indexes for better query performance
create index if not exists idx_repositories_user_id on public.repositories(user_id);
create index if not exists idx_milestones_repository_id on public.milestones(repository_id);
create index if not exists idx_milestones_date on public.milestones(milestone_date desc);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.repositories enable row level security;
alter table public.milestones enable row level security;

-- Profiles RLS policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Repositories RLS policies
create policy "Users can view their own repositories"
  on public.repositories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own repositories"
  on public.repositories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own repositories"
  on public.repositories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own repositories"
  on public.repositories for delete
  using (auth.uid() = user_id);

-- Milestones RLS policies
create policy "Users can view milestones of their repositories"
  on public.milestones for select
  using (
    exists (
      select 1 from public.repositories
      where repositories.id = milestones.repository_id
      and repositories.user_id = auth.uid()
    )
  );

create policy "Users can insert milestones to their repositories"
  on public.milestones for insert
  with check (
    exists (
      select 1 from public.repositories
      where repositories.id = milestones.repository_id
      and repositories.user_id = auth.uid()
    )
  );

create policy "Users can delete milestones of their repositories"
  on public.milestones for delete
  using (
    exists (
      select 1 from public.repositories
      where repositories.id = milestones.repository_id
      and repositories.user_id = auth.uid()
    )
  );

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, github_username)
  values (new.id, new.raw_user_meta_data->>'user_name');
  return new;
end;
$$;

-- Trigger to create profile on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
