-- Create the scores table
create table scores (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null unique,
  score integer not null check (score >= 0 and score <= 1000000),
  username text
);

-- Enable Row Level Security (RLS)
alter table scores enable row level security;

-- Policy: Allow public read access (for rankings)
create policy "Enable read access for all users"
  on scores for select
  using ( true );

-- Score writes are allowed only through this function. This prevents a client
-- from bypassing the best-score comparison with a direct insert or update.
create or replace function public.submit_high_score(p_score integer)
returns public.scores
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_score public.scores;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_score < 0 or p_score > 1000000 then
    raise exception 'Score is outside the allowed range';
  end if;

  insert into public.scores (user_id, score)
  values (auth.uid(), p_score)
  on conflict (user_id) do update
    set score = greatest(scores.score, excluded.score),
        created_at = case
          when excluded.score > scores.score then excluded.created_at
          else scores.created_at
        end
  returning * into saved_score;

  return saved_score;
end;
$$;

revoke all on function public.submit_high_score(integer) from public;
revoke all on function public.submit_high_score(integer) from anon;
grant execute on function public.submit_high_score(integer) to authenticated;

-- Create the profiles table
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  updated_at timestamp with time zone,
  constraint username_length check (char_length(username) >= 3)
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- Policy: Public profiles are viewable by everyone.
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

-- Policy: Users can insert their own profile.
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

-- Policy: Users can update own profile.
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
