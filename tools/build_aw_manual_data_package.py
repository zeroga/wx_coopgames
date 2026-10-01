#!/usr/bin/env python3
"""Build a manually imported AW data ZIP. No database or network access."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


def ident(value):
    if not re.fullmatch(r'[a-z_][a-z_0-9]*', value):
        raise ValueError(f'Invalid identifier: {value}')
    return '"' + value + '"'


def sql_value(value, kind):
    if value is None:
        return 'NULL'
    if kind == 'jsonb':
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        return "'" + value.replace("'", "''") + "'::jsonb"
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return json.dumps(value, allow_nan=False)
    if not isinstance(value, str):
        raise ValueError(f'Unsupported value for {kind}: {type(value)}')
    return "'" + value.replace("'", "''") + "'"


def key_columns(definition):
    match = re.search(r'\(([^)]+)\)', definition)
    if not match:
        raise ValueError(f'Unsupported key: {definition}')
    return [x.strip().strip('"') for x in match.group(1).split(',')]


def build(source, contract, output, batch_size):
    snapshot = json.loads(source.read_text())
    schema = json.loads(contract.read_text())
    tables = snapshot['public_tables']
    primary = {}
    dependencies = {name: set() for name in tables}
    foreign_keys = []
    for constraint in schema['constraints']:
        table = constraint['table'].removeprefix('public.')
        if table not in tables:
            continue
        definition = constraint['definition']
        if constraint['type'] in ('p', 'u'):
            cols = key_columns(definition)
            seen = set()
            for row in tables[table]:
                key = tuple(row.get(c) for c in cols)
                if any(x is None for x in key):
                    continue
                if key in seen:
                    raise ValueError(f'Duplicate {table}.{constraint["name"]}: {key}')
                seen.add(key)
            if constraint['type'] == 'p':
                primary[table] = cols
        if constraint['type'] == 'f':
            match = re.fullmatch(
                r'FOREIGN KEY \(([^)]+)\) REFERENCES ([a-z_.]+)\(([^)]+)\).*',
                definition,
            )
            if not match:
                raise ValueError(f'Unsupported FK: {definition}')
            columns = [x.strip() for x in match[1].split(',')]
            target = match[2].removeprefix('public.')
            target_columns = [x.strip() for x in match[3].split(',')]
            if target not in tables:
                raise ValueError(f'External data dependency: {table} -> {target}')
            target_keys = {tuple(r.get(c) for c in target_columns) for r in tables[target]}
            for row in tables[table]:
                key = tuple(row.get(c) for c in columns)
                if all(x is not None for x in key) and key not in target_keys:
                    raise ValueError(f'Orphan FK in {table}: {key}')
            foreign_keys.append(constraint['name'])
            if target != table:
                dependencies[table].add(target)
    order = []
    remaining = set(tables)
    while remaining:
        ready = sorted(t for t in remaining if dependencies[t].issubset(order))
        if not ready:
            raise ValueError(f'Unresolved table dependency cycle: {sorted(remaining)}')
        order.extend(ready)
        remaining.difference_update(ready)

    # Parent capabilities must precede children; the schema has a cycle guard.
    capabilities = {r['code']: r for r in tables['capabilities']}
    def depth(code, trail=()):
        if code in trail:
            raise ValueError('Capability parent cycle')
        parent = capabilities[code].get('parent_code')
        return 0 if parent is None else 1 + depth(parent, trail + (code,))
    tables['capabilities'] = sorted(capabilities.values(), key=lambda r: (depth(r['code']), r['code']))

    entries = []
    sql_files = {}
    for table_number, table in enumerate(order, 1):
        columns = [c for c in schema['columns'] if c['table'] == 'public.' + table and not c['generated']]
        names = [c['column'] for c in columns]
        rows = tables[table]
        if table != 'capabilities':
            rows = sorted(rows, key=lambda row: tuple(str(row.get(c)) for c in primary[table]))
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            for row in batch:
                if any(name not in row for name in names):
                    raise ValueError(f'Incomplete exported row in {table}')
            values = []
            for row in batch:
                values.append('(' + ', '.join(sql_value(row[c['column']], c['type']) for c in columns) + ')')
            path = f'sql/{table_number:02d}_{table}_{start // batch_size + 1:03d}.sql'
            sql = (
                '-- MANUAL DATA IMPORT ONLY. No DDL and no automatic execution.\n'
                '-- Existing primary keys are kept; different natural-key/ID collisions fail.\n'
                'begin;\n'
                "set local lock_timeout='3s';\n"
                "set local statement_timeout='20s';\n"
                "set local idle_in_transaction_session_timeout='30s';\n"
                'set local standard_conforming_strings=on;\n'
                f'insert into public.{ident(table)} (' + ', '.join(map(ident, names)) + ')\nvalues\n'
                + ',\n'.join(values)
                + '\non conflict (' + ', '.join(map(ident, primary[table])) + ') do nothing;\ncommit;\n'
            )
            raw = sql.encode()
            sql_files[path] = raw
            entries.append({'file': path, 'table': table, 'rows': len(batch), 'sha256': hashlib.sha256(raw).hexdigest()})
    manifest = {
        'format_version': 1,
        'snapshot_at': snapshot['checked_at'],
        'automatic_import': False,
        'conflict_policy': 'primary_key_do_nothing',
        'batch_size': batch_size,
        'table_order': order,
        'table_counts': {table: len(tables[table]) for table in order},
        'excluded': ['private team data', 'team codes', 'generated columns', 'schema changes'],
        'offline_validation': {'unique_and_primary_keys': 'passed', 'foreign_keys': len(foreign_keys), 'capability_cycles': 'passed'},
        'database_execution_tested': False,
        'batches': entries,
    }
    readme = '''# AW 数据文件包（手动导入）

先在目标环境审查并执行仓库的 003_aw_empty_schema_idempotent.sql。该文件只建立空表结构，不导入本包。
本包只包含公开车辆资料，不含团队、成员、团队码或服务端凭证。
数据为 manifest.json 的 snapshot_at 时间点导出，不代表导入时的最新游戏数据。

按 manifest.json 的 batches 顺序逐个打开 SQL，在维护角色的 SQL Editor 中手动执行。
每个文件最多 50 行，是独立短事务；失败只回滚该文件，修正后重新执行该文件，再继续下一批。
出现错误后应确保客户端已经回滚/结束失败事务；不要把全包拼为一个长事务。
不提供自动导入脚本、不使用 migration 触发导入、不关闭 RLS/外键/Trigger。

SQL 使用 ON CONFLICT (主键) DO NOTHING；重复执行同一包不会覆盖已存在的同主键记录。
如果同 slug 等自然键已有不同 ID，唯一约束会阻止导入，需人工确认映射，不能重置或覆盖目标库。
本包 UUID 是导出时的真实实体标识，保持外键一致。不要单独生成新 UUID。
生成列 power_to_weight_hp_t 不导入，由数据库根据重量与功率计算。
没有执行 UPDATE，现有同主键记录的内容不会被本包修正；修正应另作明确的数据变更。
对已导好数据的现有库无需再次导入；按实际缺口决定是否执行某批。

数据含待核实/NULL 字段和仅公布的车辆，不要把未知当作没有该能力。
source/catalog_snapshot.json 保留原始公开资料，可用于审查与再生成本包。
manifest.json 记录各批数量和 SHA256。只完成了离线唯一键、外键与层级检查，未进行数据库执行测试。
仅在独立隔离数据库及合成数据上测试导入程序，不能拿现有正式数据做事务试验。
'''
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        def write(path, raw):
            item = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o644 << 16
            archive.writestr(item, raw)
        for path, raw in sql_files.items():
            write(path, raw)
        write('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        write('README.md', readme)
        write('source/catalog_snapshot.json', source.read_bytes())
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
    output.with_suffix('.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--contract', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    manifest = build(args.source, args.contract, args.output, 50)
    print(json.dumps({'tables': len(manifest['table_order']), 'batches': len(manifest['batches']), 'rows': sum(manifest['table_counts'].values()), 'offline_checks': manifest['offline_validation']}))
