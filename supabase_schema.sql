-- Create the scores table
create table scores (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  score integer not null,
  username text
);

-- Enable Row Level Security (RLS)
alter table scores enable row level security;

-- Policy: Allow public read access (for rankings)
create policy "Enable read access for all users"
  on scores for select
  using ( true );

-- Policy: Allow authenticated users to insert their own scores
create policy "Enable insert for users based on user_id"
  on scores for insert
  to authenticated
  with check ( auth.uid() = user_id );
