create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  blog_url text,
  selected_drive_folders text[], -- JSON array of folder IDs
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "Users can manage own profile" on user_profiles
  for all using (auth.uid() = id);
