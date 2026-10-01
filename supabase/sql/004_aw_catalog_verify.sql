-- Read-only maintenance queries. Run with a database maintenance role.
-- Do not terminate any backend automatically. Inspect each result first.

select clock_timestamp() as checked_at, pid, usename, application_name,
       client_addr, backend_type, state, xact_start, query_start,
       clock_timestamp()-xact_start as transaction_age,
       clock_timestamp()-query_start as query_age,
       wait_event_type, wait_event, pg_blocking_pids(pid) as blocking_pids,
       left(query,600) as sql_preview
from pg_stat_activity
where datname=current_database() and pid<>pg_backend_pid()
order by xact_start nulls last, query_start nulls last;

select a.pid,a.usename,a.application_name,a.state,l.locktype,l.mode,l.granted,
       n.nspname,c.relname,a.wait_event_type,a.wait_event
from pg_locks l left join pg_stat_activity a on a.pid=l.pid
left join pg_class c on c.oid=l.relation
left join pg_namespace n on n.oid=c.relnamespace
where a.datname=current_database()
  and (not l.granted or (a.pid<>pg_backend_pid() and a.xact_start is not null))
order by l.granted,a.xact_start;

select version,name from supabase_migrations.schema_migrations order by version;

select batch_key,status,started_at,completed_at,row_counts,note
from private.aw_import_batches order by started_at;

select issue_key,entity_type,entity_id,severity,description,created_at
from private.aw_data_issues where resolved_at is null
order by severity,issue_key;

select * from public.aw_catalog_quality
where not has_ammo_records or not has_weapon_records
   or not has_complete_unlock_path or not basic_performance_present
order by release_status,name;

select 'vehicles' as entity,count(*) from public.vehicles
union all select 'weapons',count(*) from public.vehicle_weapons
union all select 'ammo',count(*) from public.vehicle_ammo
union all select 'upgrades',count(*) from public.vehicle_upgrades
union all select 'capabilities',count(*) from public.vehicle_capabilities
union all select 'unlock_paths',count(*) from public.unlock_paths
union all select 'unlock_requirements',count(*) from public.unlock_requirements
union all select 'tokens',count(*) from public.tokens
union all select 'team_plans',count(*) from private.aw_fleet_plan_items;

select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind='r'
order by n.nspname,c.relname;

select * from pg_policies where schemaname in ('public','private')
order by schemaname,tablename,policyname;

-- Team sharing permits multiple members to plan the same vehicle.
-- Use the code-checked public RPC for client access, not this administrative table.
select workspace_id,vehicle_id,status,count(*) as members
from private.aw_fleet_plan_items group by workspace_id,vehicle_id,status;

-- Inspect schema_inventory_after.json for the audited schema, but query the
-- catalog again if a later session has applied additional migrations.

