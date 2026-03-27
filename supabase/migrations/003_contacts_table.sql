create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  company text,
  source text default 'manual',
  created_at timestamptz default now()
);

alter table contacts enable row level security;

create policy "Users can manage own contacts" on contacts
  for all using (auth.uid() = user_id);

create unique index if not exists contacts_user_email_unique on contacts(user_id, email) where email is not null;
