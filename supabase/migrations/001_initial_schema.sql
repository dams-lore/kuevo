-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Pages table
create table if not exists pages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  slug text unique not null,
  prospect_name text not null,
  company text not null,
  intro_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Page blocks (content items)
create table if not exists page_blocks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references pages(id) on delete cascade,
  title text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Visits tracking
create table if not exists visits (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references pages(id) on delete cascade,
  visitor_id text, -- anonymous fingerprint
  ip text,
  user_agent text,
  referrer text,
  time_spent_seconds integer default 0,
  created_at timestamptz default now()
);

-- Block events (link clicks)
create table if not exists block_events (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid references pages(id) on delete cascade,
  block_id uuid references page_blocks(id) on delete cascade,
  visitor_id text,
  event_type text not null, -- 'click'
  created_at timestamptz default now()
);

-- Google OAuth integrations
create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  provider text not null default 'google',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table pages enable row level security;
alter table page_blocks enable row level security;
alter table visits enable row level security;
alter table block_events enable row level security;
alter table integrations enable row level security;

-- Pages: users can only see their own
create policy "Users can manage own pages" on pages
  for all using (auth.uid() = user_id);

-- Page blocks: same
create policy "Users can manage own page blocks" on page_blocks
  for all using (
    page_id in (select id from pages where user_id = auth.uid())
  );

-- Visits: public insert, owner can read
create policy "Public can insert visits" on visits
  for insert with check (true);

create policy "Owners can read visits" on visits
  for select using (
    page_id in (select id from pages where user_id = auth.uid())
  );

-- Block events: public insert, owner can read
create policy "Public can insert block_events" on block_events
  for insert with check (true);

create policy "Owners can read block_events" on block_events
  for select using (
    page_id in (select id from pages where user_id = auth.uid())
  );

-- Integrations: users manage their own
create policy "Users can manage own integrations" on integrations
  for all using (auth.uid() = user_id);
