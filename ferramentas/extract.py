import fitz, re, json, warnings, sys
warnings.filterwarnings('ignore')
PDF = '/mnt/user-data/uploads/Françes.pdf'
d = fitz.open(PDF)
toc = d.get_toc()
MOD = [(t[1].split(' — ')[0], t[1].split(' — ', 1)[1], t[2]) for t in toc]  # code,title,startpage

def clean(s):
    s = s.replace('\u00a0', ' ').replace('\uf0b7', '•')
    return re.sub(r'[ \t]+', ' ', s).strip()

def line_text(spans):
    out = []; allb = True; any_t = False
    for s in spans:
        t = s['text']
        if not t.strip():
            out.append(t); continue
        any_t = True
        b = bool(s['flags'] & 16) or 'Bold' in s['font']
        if not b: allb = False
        out.append(('\x01' + t + '\x02') if b else t)
    txt = ''.join(out)
    return txt, allb and any_t

def md(txt):
    txt = txt.replace('\x02\x01', '')
    txt = re.sub(r'\x01(\s+)', lambda m: m.group(1) + '\x01', txt)
    txt = re.sub(r'(\s+)\x02', lambda m: '\x02' + m.group(1), txt)
    txt = txt.replace('\x01\x02', '')
    txt = txt.replace('\x01', '**').replace('\x02', '**')
    return clean(txt)


RX_OPT = re.compile(r'^(\*\*)?[a-e]\)\s')
RX_H3 = re.compile(r'^\d+\.\d+\.?\s+\S')
RX_H2 = re.compile(r'^\d+\.\s+\S')
RX_NUM = re.compile(r'^\d+(\.\d+)?\.?\s+\S|^\d+\s+[—-]\s')
RX_DLG = re.compile(r"^(\*\*)?[A-ZÀ-Ý][\wÀ-ÿ'’\-\. ]{0,24}(\*\*)? ?:(\*\*)? ")

GAP = 6
BARE = re.compile(r'^\d+\.$')
def page_rows(pn):
    p = d[pn]; fr = []
    for b in p.get_text('rawdict')['blocks']:
        if b['type'] != 0: continue
        for l in b['lines']:
            segs = []; cur = None; lastx = None; bullet = False
            for si, sp in enumerate(l['spans']):
                sym = sp['font'].startswith('Symbol')
                for ch in sp['chars']:
                    c = ch['c']; bx = ch['bbox']
                    if sym and not segs and cur is None and c.strip() in ('•', '', '·', 'o', '§', ''):
                        bullet = True; continue
                    if c.strip() == '':
                        if cur is not None: cur['chars'].append((c, sp, bx))
                        continue
                    if cur is None or (lastx is not None and bx[0] - lastx > 7.5):
                        cur = dict(chars=[], x0=bx[0]); segs.append(cur)
                    cur['chars'].append((c, sp, bx)); lastx = bx[2]; cur['x1'] = bx[2]
            for sg in segs:
                spans = []
                for c, sp, bx in sg['chars']:
                    if spans and spans[-1]['font'] == sp['font'] and spans[-1]['flags'] == sp['flags']: spans[-1]['text'] += c
                    else: spans.append(dict(text=c, font=sp['font'], flags=sp['flags']))
                txt, allb = line_text(spans)
                if not clean(txt.replace('\x01', '').replace('\x02', '')): continue
                fr.append(dict(x0=sg['x0'], x1=sg['x1'], y0=l['bbox'][1], y1=l['bbox'][3], t=md(txt), bold=allb, bullet=bullet and sg is segs[0], page=pn + 1))
    fr.sort(key=lambda f: (f['y0'], f['x0']))
    rows = []
    for f in fr:
        if rows and abs(f['y0'] - rows[-1]['y0']) < 3.5: rows[-1]['f'].append(f)
        else: rows.append(dict(y0=f['y0'], y1=f['y1'], page=pn + 1, f=[f]))
    for r in rows:
        r['f'].sort(key=lambda f: f['x0']); m = []
        for f in r['f']:
            if m and f['x0'] - m[-1]['x1'] < GAP and not f['bullet']:
                m[-1]['t'] = (m[-1]['t'] + ' ' + f['t']).strip(); m[-1]['x1'] = f['x1']; m[-1]['bold'] = m[-1]['bold'] and f['bold']
            else: m.append(dict(f))
        r['f'] = m; r['y1'] = max(f['y1'] for f in m)
    return rows

def build_zone(frs, page):
    frs = sorted(frs, key=lambda f: f['y0'])
    clusters = []
    for f in frs:
        if clusters and f['y0'] <= clusters[-1]['y1'] + 3: 
            clusters[-1]['f'].append(f); clusters[-1]['y1'] = max(clusters[-1]['y1'], f['y1'])
        else: clusters.append(dict(f=[f], y1=f['y1']))
    xs = sorted(f['x0'] for f in frs); cols = []
    for x in xs:
        if cols and x - cols[-1][-1] < 7: cols[-1].append(x)
        else: cols.append([x])
    starts = [min(c) for c in cols]
    def col(x):
        k = 0
        for i, st in enumerate(starts):
            if st <= x + 7: k = i
        return k
    rows = []; head = all(f['bold'] for f in clusters[0]['f']); fixed = 0
    for ci, c in enumerate(clusters):
        cells = [''] * len(starts)
        cross = any(f['x0'] < st - 2 < f['x1'] - 8 for f in c['f'] for st in starts)
        if cross:
            y0 = min(f['y0'] for f in c['f']); ws = d[page - 1].get_text('words', clip=fitz.Rect(0, y0 - 1, 700, c['y1'] + 1))
            for w in sorted(ws, key=lambda w: (col(w[0]), w[1], w[0])):
                k = col(w[0]); cells[k] = (cells[k] + ' ' + w[4]).strip()
            if ci == 0 and head: cells = [('**' + x + '**') if x else x for x in cells]
        else:
            for f in sorted(c['f'], key=lambda f: (col(f['x0']), f['y0'])):
                k = col(f['x0']); cells[k] = (cells[k] + ' ' + f['t']).strip()
        rows.append(cells)
    return dict(t='table', rows=rows, head=head, page=page, ncol=len(starts), y0=frs[0]['y0'], y1=max(f['y1'] for f in frs))

def rows_to_items(allrows):
    items = []
    pages = {}
    for r in allrows: pages.setdefault(r['page'], []).append(r)
    for pg in sorted(pages):
        rows = pages[pg]
        T = [any(73 <= f['x0'] <= 76.5 for f in r['f']) for r in rows]
        inz = list(T)
        for i, r in enumerate(rows):
            if T[i] or not all(f['x0'] > 76.5 for f in r['f']): continue
            if any(f['bullet'] for f in r['f']): continue
            if any(T[j] and abs(rows[j]['y0'] - r['y0']) <= 24 for j in range(max(0, i - 4), min(len(rows), i + 5))): inz[i] = True
        i = 0
        while i < len(rows):
            if not inz[i]:
                items.append(dict(k='line', **rows[i]['f'][0]) if len(rows[i]['f']) == 1 else None)
                if items[-1] is None:
                    items.pop()
                    for f in rows[i]['f']: items.append(dict(k='line', **f))
                i += 1; continue
            j = i
            while j < len(rows) and inz[j]: j += 1
            fr = [f for r in rows[i:j] for f in r['f']]
            items.append(build_zone(fr, pg)); i = j
    return items

def assemble(items):
    blocks = []; prev = None
    for it in items:
        if isinstance(it, dict) and it.get('t') == 'table':
            blocks.append(it); prev = None; continue
        txt = it['t']; plain = txt.replace('**', '')
        newp = True
        if prev and prev['page'] == it['page']: newp = (it['y0'] - prev['y1']) > 5
        elif prev:
            newp = bool(re.search(r'[.?!:;)»”…]\**$', prev['t'])) or not txt[:1].islower()
        is_head = it['bold'] and it['x0'] < 80 and len(plain) < 110 and not it['bullet'] and newp
        starter = it['bullet'] or RX_OPT.match(txt) or RX_NUM.match(plain) or (RX_DLG.match(txt) and it['x0'] < 100) or is_head or it['x0'] > 80
        last = blocks[-1] if blocks else None
        if BARE.match(plain) and not it['bullet'] and it['x0'] < 100 and not it['bold']:
            blocks.append(dict(t='n', x=txt, bare=True)); prev = it; continue
        if last and last.get('bare') and not is_head and not it['bullet']:
            last['x'] += ' ' + txt; last['bare'] = False; last['hang'] = it['x0']; prev = it; continue
        if last and last.get('hang') is not None and not newp and abs(it['x0'] - last['hang']) < 4 and not it['bullet'] and not RX_NUM.match(plain) and not RX_OPT.match(txt):
            last['x'] += ' ' + txt; prev = it; continue
        if last and not newp and it['bold'] and last['t'] in ('h2', 'h3', 'h4') and prev is not None:
            last['x'] += ' ' + txt; prev = it; continue
        cont = (not newp) and last and last['t'] in ('p', 'li', 'n', 'opt') and not starter
        if cont:
            last['x'] += ' ' + txt
        elif it['bullet']: blocks.append(dict(t='li', x=txt))
        elif is_head:
            if RX_H3.match(plain): blocks.append(dict(t='h3', x=txt))
            elif RX_H2.match(plain): blocks.append(dict(t='h2', x=txt))
            else: blocks.append(dict(t='h4', x=txt))
        elif RX_OPT.match(txt): blocks.append(dict(t='opt', x=txt))
        elif RX_NUM.match(plain): blocks.append(dict(t='n', x=txt))
        else: blocks.append(dict(t='p', x=txt))
        prev = it
    return blocks

def fix(blocks):
    out = []
    for b in blocks:
        if b['t'] in ('h2', 'h3', 'h4', 'p', 'li', 'n', 'opt'):
            b['x'] = re.sub(r'\*\*\s*\*\*', ' ', b['x']).replace('****', '').strip()
            if b['t'] == 'p':
                b['x'] = re.sub(r'\s+([,.;:!?])(?=\s|$)', r'\1', b['x']) if False else b['x']
        # merge consecutive tables (same header) across page breaks
        if b['t'] == 'table' and out and out[-1]['t'] == 'table' and out[-1]['page'] + 1 == b['page'] and out[-1]['ncol'] == b['ncol']:
            h = out[-1]['rows'][0]
            rows = b['rows'][1:] if b['rows'][0] == h else b['rows']
            out[-1]['rows'] += rows; out[-1]['page'] = b['page']; continue
        out.append(b)
    return out

res = []
for mi, (code, title, sp) in enumerate(MOD):
    ep = MOD[mi + 1][2] - 1 if mi + 1 < len(MOD) else len(d)
    rows = []
    for pn in range(sp - 1, ep): rows += page_rows(pn)
    bl = fix(assemble(rows_to_items(rows)))
    res.append(dict(code=code, title=title, pages=[sp, ep], blocks=bl))
json.dump(res, open('/home/claude/src/raw.json', 'w'), ensure_ascii=False)
for m in res: print(m['code'], len(m['blocks']), sum(1 for b in m['blocks'] if b['t'] == 'table'), sum(1 for b in m['blocks'] if b['t'] == 'h2'))
