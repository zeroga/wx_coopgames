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
app = json.loads((mini / 'app.json').read_text())
for route in app['pages']:
    for suffix in ['.js', '.json', '.wxml', '.wxss']:
        assert (mini / (route + suffix)).is_file(), route + suffix
with zipfile.ZipFile(root / 'data/aw/AW_catalog_manual_data.zip') as z:
    original = json.loads(z.read('source/catalog_snapshot.json'))
source = (mini / 'data/aw/catalog.js').read_text().split('module.exports = ', 1)[1]
pack = json.loads(source)
for name, table in pack['tables'].items():
    decoded = [{key: pack['strings'][int(value[1:])] if isinstance(value, str) and value.startswith('@') else value for key, value in zip(table['columns'], row)} for row in table['rows']]
    assert decoded == original['public_tables'][name], name
before = (mini / 'data/aw/catalog.js').read_bytes()
subprocess.run(['python', str(root / 'tools/build_aw_miniprogram_catalog.py')], cwd=root, check=True, capture_output=True)
assert (mini / 'data/aw/catalog.js').read_bytes() == before
size = sum(p.stat().st_size for p in mini.rglob('*') if p.is_file())
assert size < 2 * 1024 * 1024, size
print(f'JS syntax, AW WXML, routes, styles, catalog round trip/rebuild passed; source bytes: {size}')
