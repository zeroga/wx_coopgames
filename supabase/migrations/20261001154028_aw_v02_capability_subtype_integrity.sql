-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
create or replace function private.aw_validate_special_capability() returns trigger
language plpgsql set search_path=pg_catalog as $fn$
declare expected text;actual text;
begin
 expected:=case tg_table_name when 'vehicle_era' then 'era' else 'infantry_squad' end;
 select capability_code into actual from public.vehicle_capabilities where id=new.capability_id;
 if actual is distinct from expected then raise exception 'CAPABILITY_SUBTYPE_MISMATCH';end if;
 return new;
end $fn$;
create trigger era_capability_type before insert or update on public.vehicle_era for each row execute function private.aw_validate_special_capability();
create trigger infantry_capability_type before insert or update on public.vehicle_infantry for each row execute function private.aw_validate_special_capability();
revoke all on function private.aw_validate_special_capability() from public,anon,authenticated;


