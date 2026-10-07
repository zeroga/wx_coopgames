#!/usr/bin/env bash
# Reproducible integration test; no production credentials or network on the DB container.
set -euo pipefail
aw_test_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$aw_test_root"
mkdir -p work
aw_test_dir="$(mktemp -d "$aw_test_root/work/aw-maintenance-test.XXXXXX")"
aw_test_container="aw-maintenance-test-$$"
# Explicit local daemon, retaining registry credentials and managed proxy configuration.
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
docker --host=unix:///var/run/docker.sock info >/dev/null
node tools/build_aw_edge_protocol.js --check
node tools/build_aw_catalog_test_fixture.js "$aw_test_dir/fixture.sql"
node tools/build_aw_catalog_bootstrap.js "$aw_test_dir/bootstrap.sql"
cat > "$aw_test_dir/init.sql" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
SQL
trap 'docker --host=unix:///var/run/docker.sock rm -f "$aw_test_container" >/dev/null 2>&1 || true' EXIT
docker --host=unix:///var/run/docker.sock run -d --name "$aw_test_container" --network none \
  -e POSTGRES_PASSWORD=isolated-test-only -v "$aw_test_root:/repo:ro" -v "$aw_test_dir:/work:ro" \
  postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3 >/dev/null
aw_test_ready=false
for aw_test_attempt in {1..30};do
 if docker --host=unix:///var/run/docker.sock exec "$aw_test_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1;then aw_test_ready=true;break;fi
 sleep 1
done
if [[ "$aw_test_ready" != true ]];then echo 'Isolated PostgreSQL failed to start' >&2;exit 1;fi
docker --host=unix:///var/run/docker.sock exec "$aw_test_container" createdb -U postgres aw_catalog_test
docker --host=unix:///var/run/docker.sock exec "$aw_test_container" psql -U postgres -d aw_catalog_test -v ON_ERROR_STOP=1 \
 -f /work/init.sql -f /repo/supabase/sql/001_snowrunner_core_idempotent.sql \
 -f /repo/supabase/sql/003_aw_empty_schema_idempotent.sql \
 -f /repo/supabase/migrations/20261006103635_aw_catalog_maintenance.sql \
 -f /work/fixture.sql -f /work/bootstrap.sql > "$aw_test_dir/setup.log" 2>&1
AW_TEST_CONTAINER="$aw_test_container" AW_TEST_DATABASE=aw_catalog_test node tests/aw-catalog-maintenance.test.js
