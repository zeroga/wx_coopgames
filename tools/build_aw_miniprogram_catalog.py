"""Build a deterministic offline read-only catalog; never connects to a database."""
import argparse, json, zipfile
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--package', default='data/aw/AW_catalog_manual_data.zip')
p.add_argument('--output', default='miniprogram/data/aw/catalog.js')
a = p.parse_args()
with zipfile.ZipFile(a.package) as z:
    source = json.loads(z.read('source/catalog_snapshot.json'))
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
Path(a.output).write_text('// Generated from the public catalog snapshot. Rebuild with tools/build_aw_miniprogram_catalog.py.\nmodule.exports = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{a.output}: {Path(a.output).stat().st_size} bytes')
