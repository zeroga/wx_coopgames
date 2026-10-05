"""Static structural and reproducibility checks; not a native WeChat compiler."""
import json, re, subprocess, zipfile
from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET
root = Path(__file__).resolve().parent.parent
mini = root / 'miniprogram'
for p in mini.rglob('*.js'):
    subprocess.run(['node', '--check', str(p)], check=True, capture_output=True)
for p in list((mini / 'pages').glob('aw-*/index.wxml')) + list((mini / 'components').glob('aw-*/index.wxml')):
    markup = p.read_text()
    for binding in re.finditer(r'{{([\s\S]*?)}}', markup):
        assert not re.search(r'&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);', binding[1]), f'{p}: WXML expressions must use raw operators, not XML entities: {binding[0]}'
    # WXML preserves operators in bindings. Escape them only for our XML
    # structure check, after validating the original source above.
    xml_markup = re.sub(r'{{([\s\S]*?)}}', lambda m: '{{' + escape(m[1], quote=False) + '}}', markup)
    tree = ET.fromstring('<root xmlns:wx="urn:wx" xmlns:bind="urn:bind">' + xml_markup + '</root>')
    for node in tree.iter():
        for directive in ['if', 'elif']:
            condition = node.get('{urn:wx}' + directive)
            if condition is not None:
                assert condition.strip().startswith('{{') and condition.strip().endswith('}}'), f'{p}: wx:{directive} must bind an expression: {condition}'
    for imp in re.findall(r'@import "([^"]+)"', p.with_suffix('.wxss').read_text()):
        assert (p.parent / imp).exists(), imp
    if p.parent.parent.name == 'components':
        styles = p.with_suffix('.wxss').read_text()
        # Shared class-only style modules are valid in isolated components.
        # Imports were checked above; inspect the selectors defined here only.
        styles = re.sub(r'@import\s+"[^"]+"\s*;', '', styles)
        styles = re.sub(r'/\*[\s\S]*?\*/', '', styles)
        for selector in re.findall(r'([^{}]+)\{', styles):
            for part in selector.strip().split(','):
                assert all(token.startswith('.') for token in part.strip().split()), f'{p}: component selector must use classes: {part}'
app = json.loads((mini / 'app.json').read_text())
for route in app['pages']:
    for suffix in ['.js', '.json', '.wxml', '.wxss']:
        assert (mini / (route + suffix)).is_file(), route + suffix
with zipfile.ZipFile(root / 'data/aw/AW_catalog_manual_data.zip') as z:
    original = json.loads(z.read('source/catalog_snapshot.json'))
source = (mini / 'data/aw/catalog.js').read_text().split('module.exports = ', 1)[1]
pack = json.loads(source)
override = json.loads((root / 'data/aw/tech_tree_ingame_overrides.json').read_text())
vehicles = {r['slug']: r['id'] for r in original['public_tables']['vehicles']}
decoded_tables = {}
for name, table in pack['tables'].items():
    decoded = [{key: pack['strings'][int(value[1:])] if isinstance(value, str) and value.startswith('@') else value for key, value in zip(table['columns'], row)} for row in table['rows']]
    decoded_tables[name] = decoded
    if name not in ('vehicle_progression_edges', 'unlock_requirements'):
        assert decoded == original['public_tables'][name], name
edges = decoded_tables['vehicle_progression_edges']
assert len(edges) == len(original['public_tables']['vehicle_progression_edges']) == 270
assert sum(e['verification_status'] == 'ingame_verified' for e in edges) == len(override['verified_edges']) == 158
assert len({(e['from_vehicle_id'], e['to_vehicle_id'], e['edge_type']) for e in edges}) == 270
for spec in override['edge_replacements']:
    assert not any(e['from_vehicle_id'] == vehicles[spec['from']] and e['to_vehicle_id'] == vehicles[spec['to']] for e in edges)
    assert sum(e['from_vehicle_id'] == vehicles[spec['new_from']] and e['to_vehicle_id'] == vehicles[spec['new_to']] for e in edges) == 1
original_reqs = {r['id']: r for r in original['public_tables']['unlock_requirements']}
assert len(decoded_tables['unlock_requirements']) == len(original_reqs)
changes = [r for r in decoded_tables['unlock_requirements'] if r != original_reqs[r['id']]]
assert len(changes) == 1
changed = changes[0]
assert changed['source_vehicle_id'] == vehicles['m113_acav']
assert changed['verification_status'] == 'needs_ingame_check' and changed['required_value'] is None
assert {k: v for k, v in changed.items() if k not in ('source_vehicle_id', 'source_note')} == {k: v for k, v in original_reqs[changed['id']].items() if k not in ('source_vehicle_id', 'source_note')}
before = (mini / 'data/aw/catalog.js').read_bytes()
subprocess.run(['python', str(root / 'tools/build_aw_miniprogram_catalog.py')], cwd=root, check=True, capture_output=True)
assert (mini / 'data/aw/catalog.js').read_bytes() == before
size = sum(p.stat().st_size for p in mini.rglob('*') if p.is_file())
assert size < 2 * 1024 * 1024, size
print(f'JS syntax, AW WXML, routes, styles, catalog round trip/rebuild passed; source bytes: {size}')
