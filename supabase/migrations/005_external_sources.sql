create table if not exists external_sources (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('blog', 'website', 'rss', 'sitemap')),
  url text not null,
  title text,
  last_fetched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_external_sources_user_id on external_sources(user_id);

alter table external_sources enable row level security;

create policy "Users can manage own sources" on external_sources
  for all using (auth.uid() = user_id);
