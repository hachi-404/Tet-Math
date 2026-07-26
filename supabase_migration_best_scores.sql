-- Run this once in the Supabase SQL Editor for an existing deployment.
-- It keeps each user's highest existing score, then changes future writes to
-- one atomic best-score update per authenticated user.

begin;

with ranked_scores as (
  select
    id,
    row_number() over (
      partition by user_id
      order by score desc, created_at asc, id asc
    ) as rank
  from public.scores
)
delete from public.scores as scores
using ranked_scores
where scores.id = ranked_scores.id
  and ranked_scores.rank > 1;

create unique index if not exists scores_user_id_key
  on public.scores (user_id);

-- Remove the old direct-write path. All future writes go through the function.
drop policy if exists "Users can insert own scores" on public.scores;
drop policy if exists "Users can update own scores" on public.scores;

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

commit;
