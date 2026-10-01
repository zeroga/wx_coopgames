-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
create or replace function private.aw_validate_capability_parent() returns trigger language plpgsql set search_path=pg_catalog as $fn$
begin
 if new.parent_code is not null and exists(
 with recursive ancestry as (
  select code,parent_code from public.capabilities where code=new.parent_code
  union
  select c.code,c.parent_code from public.capabilities c join ancestry a on c.code=a.parent_code
 ) select 1 from ancestry where code=new.code
 ) then raise exception 'CAPABILITY_PARENT_CYCLE';end if;
 return new;
end $fn$;
create trigger aw_capability_parent_check before insert or update of parent_code on public.capabilities for each row execute function private.aw_validate_capability_parent();
revoke all on function private.aw_validate_capability_parent() from public,anon,authenticated;


