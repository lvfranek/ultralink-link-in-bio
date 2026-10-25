-- Public user count for the portfolio (franekkaminski.dev), which shows
-- "N registered users" on the Ultralink project. RLS only lets a user read
-- their own profile, so the portfolio can't count rows with the publishable
-- key. This function runs as its owner and returns nothing but the number —
-- no usernames, emails or other profile data.
--
-- Same number as getUserCount() in src/lib/admin/stats.ts.

create or replace function public.user_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles;
$$;

revoke all on function public.user_count() from public;
grant execute on function public.user_count() to anon, authenticated;
