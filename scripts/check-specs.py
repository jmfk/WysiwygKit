#!/usr/bin/env python3
"""Check this repository's local spec links, IDs and lifecycle conventions."""
from pathlib import Path
import re
specs=Path(__file__).resolve().parents[1]/'specs'
errors=[];known=set()
for file in specs.rglob('*.md'):
    text=file.read_text()
    for target in re.findall(r'\]\(([^)]+)\)',text):
        if '://' not in target and not target.startswith('#') and not (file.parent/target.split('#')[0]).exists():errors.append(f'{file.name}: missing {target}')
    if file.name=='index.md':continue
    if not text.startswith('---\n'):errors.append(f'{file.name}: missing frontmatter');continue
    fields=dict(re.findall(r'^([a-z_]+): (.+)$',text.split('---',2)[1],re.M))
    identifier=fields.get('id')
    if not identifier or identifier in known:errors.append(f'{file.name}: duplicate/missing ID')
    known.add(identifier)
    status=fields.get('status')
    if '/prds/' in str(file):
        if status not in {'draft','started','in-progress','completed'}:errors.append(f'{file.name}: invalid PRD status')
        if status!='draft' and fields.get('locked')!='true':errors.append(f'{file.name}: started PRD is unlocked')
    elif status not in ({'accepted'} if file.parent.name=='active' else {'rejected','superseded','withdrawn'}):errors.append(f'{file.name}: invalid ADR location/status')
    index=(file.parent.parent if file.parent.name in {'active','archive'} else file.parent)/'index.md'
    if file.name not in index.read_text():errors.append(f'{file.name}: absent from index')
if errors:raise SystemExit('\n'.join(errors))
print(f'PASS: {len(known)} indexed PRDs/ADRs and their local links.')
