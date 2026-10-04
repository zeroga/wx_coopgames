"""Build a deterministic offline read-only catalog; never connects to a database."""
import argparse, json, zipfile
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--package', default='data/aw/AW_catalog_manual_data.zip')
p.add_argument('--output', default='miniprogram/data/aw/catalog.js')
p.add_argument('--tech-tree-override', default='data/aw/tech_tree_ingame_overrides.json')
a = p.parse_args()

with zipfile.ZipFile(a.package) as z:
    source = json.loads(z.read('source/catalog_snapshot.json'))

def apply_tech_tree_override(source_data, override_path):
    path = Path(override_path)
    if not path.exists():
        return
    override = json.loads(path.read_text(encoding='utf-8'))
    tables = source_data['public_tables']
    vehicles = {row['slug']: row for row in tables['vehicles']}
    edges = tables['vehicle_progression_edges']

    def find_edge(spec):
        from_id = vehicles[spec['from']]['id']
        to_id = vehicles[spec['to']]['id']
        edge_type = spec.get('edge_type')
        matches = [
            edge for edge in edges
            if edge.get('from_vehicle_id') == from_id
            and edge.get('to_vehicle_id') == to_id
            and (edge_type is None or edge.get('edge_type') == edge_type)
        ]
        if len(matches) != 1:
            raise ValueError(
                f"tech-tree override expected exactly one edge "
                f"{spec['from']} -> {spec['to']} ({edge_type}), got {len(matches)}"
            )
        return matches[0]

    for spec in override.get('edge_replacements', []):
        edge = find_edge(spec)
        edge['from_vehicle_id'] = vehicles[spec['new_from']]['id']
        edge['to_vehicle_id'] = vehicles[spec['new_to']]['id']

    for spec in override.get('verified_edges', []):
        find_edge(spec)['verification_status'] = 'ingame_verified'

apply_tech_tree_override(source, a.tech_tree_override)

# Column arrays avoid repeated field names, but preserve NULL and all public fields.
data = {'checkedAt': source['checked_at'], 'tables': {}}
for table, rows in source['public_tables'].items():
    cols = sorted({k for row in rows for k in row})
    data['tables'][table] = {'columns': cols, 'rows': [[row.get(k) for k in cols] for row in rows]}

strings, indices = [], {}
for table in data['tables'].values():
    for row in table['rows']:
        for i, value in enumerate(row):
            if isinstance(value, str):
                if value not in indices:
                    indices[value] = len(strings)
                    strings.append(value)
                row[i] = '@' + str(indices[value])
data['strings'] = strings

Path(a.output).parent.mkdir(parents=True, exist_ok=True)
Path(a.output).write_text(
    '// Generated from the public catalog snapshot plus maintained local overrides. '
    'Rebuild with tools/build_aw_miniprogram_catalog.py.\n'
    'module.exports = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n',
    encoding='utf-8'
)
print(f'{a.output}: {Path(a.output).stat().st_size} bytes')
