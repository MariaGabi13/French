import json, re, os, collections
R = json.load(open('/home/claude/src/raw.json'))
OUT = '/mnt/user-data/outputs/apostila-frances'
os.makedirs(OUT + '/data/modulos', exist_ok=True)

def pl(b):
    if b['t'] == 'table': return ' '.join(' '.join(r) for r in b['rows']).replace('**', '')
    return b.get('x', '').replace('**', '')

for m_ in R:
    for b_ in m_['blocks']:
        b_.pop('bare', None); b_.pop('hang', None)

# ---------- 1. regrupar caudas que vazaram para o módulo seguinte ----------
for i in range(len(R)):
    code = R[i]['code']
    idx = next((k for k, b in enumerate(R[i]['blocks']) if b['t'] == 'p' and pl(b).startswith(code)), 0)
    if idx > 0 and i > 0 and not any(b['t'] == 'h4' and 'Françes' in pl(b) for b in R[i]['blocks'][:idx]):
        R[i - 1]['blocks'] += R[i]['blocks'][:idx]; R[i]['blocks'] = R[i]['blocks'][idx:]
    elif idx > 0 and i == 0:
        R[i]['blocks'] = R[i]['blocks'][idx:]

# ---------- 2. h2 só se a numeração for sequencial ----------
for m in R:
    exp = 1
    for b in m['blocks']:
        if b['t'] == 'h2':
            n = int(re.match(r'\D*(\d+)', pl(b)).group(1))
            if n == exp: exp += 1
            else: b['t'] = 'h4'

KINDS = [('exercises', r'^\d+\.\s*(exerc[ií]cios|etapa [abc])'), ('gabarito', r'gabarito|respostas dos exerc'),
         ('checklist', r'checklist'), ('editorial', r'controle de qualidade|valida[cç][aã]o editorial|^\d+\.\s*refer[eê]ncias? |descritor(es)? do qecr|coer[eê]ncia curricular|pontos de aten[cç][aã]o|refer[eê]ncia ao qecr|refer[eê]ncias ao qecr|refer[eê]ncia aos descritores'),
         ('summary', r'resumo'), ('activity', r'atividade integradora'), ('pronunciation', r'pron[uú]ncia'),
         ('vocab', r'vocabul[aá]rio|express[oõ]es-alvo'), ('reading', r'di[aá]logo|textos|compreens[aã]o de'), ('evaluation', r'avalia[cç][aã]o final|feedback'),
         ('errors', r'erros frequentes'), ('intro', r'apresenta[cç][aã]o|objetivos'), ('closing', r'encerramento|resumo geral')]
def kind_of(title):
    t = title.lower()
    for k, rx in KINDS:
        if re.search(rx, t): return k
    return 'content'

def norm(s):
    s = s.lower().replace('’', "'").replace('‘', "'")
    s = re.sub(r'\s+([?!:;])', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip(' .,!?«»“”"')

RX_LET = re.compile(r'^([a-f])\)\s*(.*)$', re.I)
RX_EXSTART = re.compile(r'^Exerc[ií]cio\s+(\d+)\s*[—-]\s*\S')
RX_EXGAB = re.compile(r'^Exerc[ií]cio\s+(\d+)\b')

def strip_lbl(t):
    t = t.replace('**', '').strip()
    m = re.match(r'^(?:\d+\.)?(\d+)\.?\s+(.*)$', t)
    return (m.group(1), m.group(2)) if m else (None, t)

# ---------- gabarito: grupos por exercício ----------
def gab_groups(blocks):
    gi = next((k for k, b in enumerate(blocks) if b['t'] == 'h2' and re.search(r'gabarito comentado|respostas dos exerc|gabarito', pl(b).lower())), None)
    if gi is None: return {}, None
    ge = next((k for k in range(gi + 1, len(blocks)) if blocks[k]['t'] == 'h2'), len(blocks))
    groups = {}; cur = None
    for b in blocks[gi + 1:ge]:
        t = pl(b)
        m = RX_EXGAB.match(t) if b['t'] in ('h4', 'p', 'h3') and len(t) < 130 else None
        if m: cur = m.group(1); groups.setdefault(cur, []); groups[cur].append(b); continue
        if b['t'] in ('h3',) and re.search(r'etapa|compreens|revis', t.lower()) and not t.lower().startswith('exerc'): cur = None; continue
        if b['t'] == 'h4' and re.match(r'ETAPA', t): cur = None; continue
        if cur: groups[cur].append(b)
    return groups, (gi, ge)

RX_TFI = re.compile(r'\bV\b.*\bF\b|verdadeiro.*falso|vrai.*faux', re.I)
def parse_answers(gb):
    ent = []; expl = []; pend = None
    for b in gb[1:]:
        if b['t'] == 'table':
            for r in (b['rows'][1:] if b['head'] else b['rows']):
                k, tx = strip_lbl(r[0])
                if k and len(r) > 1 and r[1]: ent.append((k, ' — '.join(c for c in r[1:] if c)))
            pend = None; continue
        t = pl(b).strip()
        if re.match(r'^Explica[cç][aã]o|^Coment[aá]rio', t): expl.append(t); pend = None; continue
        if b['t'] == 'opt':
            m = RX_LET.match(t)
            if pend is not None and m: ent[pend] = (ent[pend][0], t); pend = None
            elif m: ent.append((m.group(1).lower(), m.group(2).strip()))
            continue
        m = re.match(r'^([A-Z]|\d+)\s*[—-]\s*(.+)$', t)
        if m and len(t) < 70: ent.append((m.group(1), m.group(2).strip(' .'))); pend = None; continue
        m = re.match(r'^(?:\d+\.)?(\d+)\.?\s*(.*)$', t)
        if m and b['t'] in ('n', 'p') and len(t) < 420 and not re.match(r'^\d+\s+(de|a|às|h|horas?)\b', t):
            ent.append((m.group(1), m.group(2).strip()))
            pend = len(ent) - 1 if not m.group(2).strip() else None; continue
        if pend is not None and b['t'] == 'p' and len(t) < 300: ent[pend] = (ent[pend][0], t); pend = None; continue
        expl.append(t)
    return ent, expl

def letter_of(a, opts):
    a = a.strip(); m = re.match(r'^([A-Ea-e])\s*(?:[\)\.—-]|$)', a)
    if m and any(l == m.group(1).lower() for l, _ in opts): return m.group(1).lower()
    m = RX_LET.match(a)
    if m and any(l == m.group(1).lower() for l, _ in opts): return m.group(1).lower()
    body = norm(m.group(2) if m else a)
    hit = [l for l, tx in opts if norm(tx) == body]
    return hit[0] if hit else None

def build_exercise(num, title, blocks, ent, gexp):
    els = []; i = 0; pend = 0; instr = ' '.join(pl(b) for b in blocks[:2] if b['t'] == 'p')
    tfmode = bool(RX_TFI.search(instr))
    def add_q(lab, q, opts):
        typ = 'mc' if len(opts) >= 2 else ('fill' if re.search(r'_{3,}', q) else ('tf' if tfmode else 'open'))
        els.append(dict(k='q', id=lab, q=q, type=typ, opts=opts))
    while i < len(blocks):
        b = blocks[i]; t = pl(b)
        if b['t'] == 'table':
            rows = b['rows'][1:] if b['head'] else b['rows']
            if b['ncol'] == 2 and rows and sum(1 for r in rows if re.match(r'^\d+[\.\)]', r[0])) >= max(2, len(rows) - 1) and sum(1 for r in rows if re.match(r'^[A-H][\.\)]\s', r[1])) >= 2:
                rr = [r for r in rows if re.match(r'^\d+[\.\)]', r[0])]
                els.append(dict(k='match', keys=[re.match(r'^(\d+)', r[0]).group(1) for r in rr], left=[re.sub(r'^\d+[\.\)]\s*', '', r[0]) for r in rr],
                                right=[(re.match(r'^([A-H])', r[1]).group(1), re.sub(r'^[A-H][\.\)]\s*', '', r[1])) for r in rows if re.match(r'^[A-H][\.\)]', r[1])],
                                head=[c.replace('**', '') for c in b['rows'][0]] if b['head'] else None))
                i += 1; continue
            els.append(dict(k='raw', b=b)); i += 1; continue
        if b['t'] == 'n' and not re.match(r'^\d+\.\s*$', t):
            lab, q = strip_lbl(b['x'])
            if lab is not None:
                opts = []; j = i + 1
                while j < len(blocks) and blocks[j]['t'] == 'opt':
                    mm = RX_LET.match(pl(blocks[j])); opts.append((mm.group(1).lower(), mm.group(2)) if mm else ('', pl(blocks[j]))); j += 1
                if not opts and j < len(blocks) and blocks[j]['t'] == 'p' and blocks[j]['x'][:1].islower() and len(blocks[j]['x']) < 60 and '_' not in blocks[j]['x']:
                    q += ' ' + blocks[j]['x']; j += 1
                add_q(lab, q, opts); i = j; continue
        if b['t'] == 'opt' or (b['t'] == 'p' and re.match(r'^[a-f]\)\s', t) and els and els[-1]['k'] == 'q' and not els[-1]['opts']):
            mm = RX_LET.match(t); lab = mm.group(1).lower(); q = mm.group(2); j = i + 1; po = []
            while j < len(blocks) and blocks[j]['t'] == 'p' and re.match(r'^[A-E]\.\s', pl(blocks[j])): po.append((pl(blocks[j])[0].lower(), pl(blocks[j])[3:].strip())); j += 1
            add_q(lab, q, po if len(po) >= 2 else []); i = j; continue
        if b['t'] == 'p' and re.search(r'_{4,}', t) and len(t) < 160:
            pend += 1; add_q('u%d' % pend, b['x'], []); els[-1]['type'] = 'fill'; i += 1; continue
        els.append(dict(k='raw', b=b)); i += 1
    qs = [e for e in els if e['k'] == 'q']; ms = [e for e in els if e['k'] == 'match']
    bylab = {}
    for k, v in ent: bylab.setdefault(k, v)
    pos = len(ent) == len(qs) and not ms
    for n, e in enumerate(qs):
        a = ent[n][1] if pos else bylab.get(e['id'].lstrip('u'))
        if a is None: continue
        a = a.strip(); e['ansRaw'] = a
        if e['type'] == 'mc':
            l = letter_of(a, e['opts'])
            if l: e['ans'] = l
            else: e['type'] = 'open'; e['opts'] = []; e['ans'] = a
        elif e['type'] == 'tf' or norm(re.sub(r'^[a-e]\)\s*', '', a)).split(' ')[0] in ('vrai', 'faux', 'verdadeiro', 'falso', 'v', 'f'):
            w = norm(re.sub(r'^[a-e]\)\s*', '', a)).split(' ')[0]
            if w in ('vrai', 'verdadeiro', 'v'): e['type'] = 'tf'; e['ans'] = 'v'
            elif w in ('faux', 'falso', 'f'): e['type'] = 'tf'; e['ans'] = 'f'
            else: e['ans'] = re.sub(r'^[a-e]\)\s*', '', a)
        else:
            body = re.sub(r'^[a-e]\)\s*', '', a) if not re.match(r'^\d', e['id']) or RX_LET.match(a) else a
            e['ans'] = body.strip()
            if e['type'] == 'fill':
                parts = re.split(r'_{3,}', e['q'])
                blank = None
                if len(parts) == 2:
                    pre, post = parts[0].replace('**', '').strip(), parts[1].replace('**', '').strip(); ab = body.strip()
                    if pre and ab.lower().startswith(pre.lower()):
                        mid = ab[len(pre):]
                        if post and mid.lower().rstrip(' .?!').endswith(post.lower().rstrip(' .?!')): mid = mid[:len(mid.rstrip(' .?!')) - len(post.rstrip(' .?!'))]
                        blank = mid.strip(' .')
                    elif not pre and post and ab.lower().rstrip(' .?!').endswith(post.lower().rstrip(' .?!')):
                        blank = ab[:len(ab.rstrip(' .?!')) - len(post.rstrip(' .?!'))].strip(' .')
                    elif len(ab.split()) <= 4 and len(ab) < len(e['q']) - 3: blank = ab.strip(' .')
                if blank: e['blank'] = blank
    for e in ms:
        ans = {}
        for k, v in ent:
            v = v.strip(' .')
            if re.fullmatch(r'\d+', k) and re.fullmatch(r'[A-H]', v.upper()): ans[k] = v.upper()
            elif re.fullmatch(r'[A-H]', k.upper()) and re.fullmatch(r'\d+', v): ans[v] = k.upper()
        e['ans'] = ans
    nq = len(qs) + sum(len(e['keys']) for e in ms); nans = sum(1 for e in qs if 'ans' in e) + sum(len(e['ans']) for e in ms)
    return dict(t='ex', num=num, title=title, els=els, expl=gexp, nq=nq, nans=nans)

def gabify(out, titles):
    gi = next((k for k, b in enumerate(out) if b['t'] == 'h2' and re.search(r'gabarito|respostas dos exerc', pl(b).lower())), None)
    if gi is None: return out
    ge = next((k for k in range(gi + 1, len(out)) if out[k]['t'] == 'h2'), len(out))
    new = out[:gi + 1]; i = gi + 1
    def start(b): return b['t'] in ('h4', 'p', 'h3') and len(pl(b)) < 130 and RX_EXGAB.match(pl(b))
    while i < ge:
        b = out[i]
        if start(b):
            j = i + 1
            while j < ge and not (start(out[j]) or (out[j]['t'] == 'h3' and re.search(r'etapa|compreens|revis', pl(out[j]).lower())) or (out[j]['t'] == 'h4' and re.match(r'ETAPA', pl(out[j])))): j += 1
            num = RX_EXGAB.match(pl(b)).group(1); ent, expl = parse_answers(out[i:j])
            tt = re.sub(r'^Exerc[ií]cio\s+\d+\s*[—:-]?\s*', '', pl(b)).strip() or titles.get(num, '')
            if ent: new.append(dict(t='gab', num=num, title=tt, ent=ent, expl=expl))
            else: new.extend(out[i:j])
            i = j; continue
        new.append(b); i += 1
    return new + out[ge:]

def process_exercises(blocks):
    groups, gz = gab_groups(blocks)
    lim = gz[0] if gz else len(blocks)
    out = []; i = 0; stats = [0, 0]; titles = {}
    while i < len(blocks):
        b = blocks[i]
        if i < lim and b['t'] in ('h4', 'h3', 'p') and RX_EXSTART.match(pl(b)) and len(pl(b)) < 130:
            num = RX_EXSTART.match(pl(b)).group(1); title = re.sub(r'^Exerc[ií]cio\s+\d+\s*[—-]\s*', '', pl(b))
            j = i + 1
            while j < lim and not (blocks[j]['t'] in ('h2', 'h3') or (blocks[j]['t'] in ('h4', 'p') and RX_EXSTART.match(pl(blocks[j])) and len(pl(blocks[j])) < 130) or (blocks[j]['t'] == 'h4' and re.match(r'ETAPA|Atividade integradora', pl(blocks[j])))): j += 1
            gb = groups.get(num, []); ga, ge = parse_answers(gb) if gb else ([], [])
            ex = build_exercise(num, title, blocks[i + 1:j], ga, ge)
            ex['gab'] = [] if ga else [x for x in gb[1:]]
            if ga: ex['gabd'] = dict(ent=ga, expl=ge)
            titles[num] = title; out.append(ex); stats[0] += ex['nq']; stats[1] += ex['nans']; i = j; continue
        out.append(b); i += 1
    return gabify(out, titles), stats

# ---------- cartões de vocabulário ----------
FR = re.compile(r'^(Francês|Expressão( em francês)?|Palavra|Pergunta( em francês)?)$')
PT = re.compile(r'^(Português|Significado|Tradução)$')
def cards_from(blocks, code):
    cards = []
    for b in blocks:
        if b['t'] != 'table' or not b['head']: continue
        hd = [c.replace('**', '').strip() for c in b['rows'][0]]
        fi = next((k for k, h in enumerate(hd) if FR.match(h)), None); pi = next((k for k, h in enumerate(hd) if PT.match(h)), None)
        if fi is None or pi is None or fi == pi: continue
        for r in b['rows'][1:]:
            f, p = r[fi].replace('**', ''), r[pi].replace('**', '')
            if f and p and len(f) < 90 and len(p) < 140:
                ex = ' · '.join(f"{hd[k]}: {r[k].replace('**', '')}" for k in range(len(r)) if k not in (fi, pi) and r[k])
                cards.append(dict(f=f, p=p, e=ex, m=code))
    return cards

# ---------- módulos ----------
def clean_blocks(bs):
    return [b for b in bs]
mods = []; stats_all = {}
for m in R:
    code = m['code']; bl = m['blocks']
    h = next((k for k, b in enumerate(bl) if b['t'] == 'h2'), len(bl))
    head, body = bl[:h], bl[h:]
    meta = []; intro = []; pt = ''
    for b in head:
        t = pl(b)
        if t.startswith(code) or t.startswith('Françes —'): continue
        mm = re.match(r'^(Nível|Unidade|Duração sugerida|Situação comunicativa|Pré-requisitos|Coleção|Tema central)\s*:\s*(.*)$', t)
        if mm and b['t'] == 'p': meta.append([mm.group(1), mm.group(2)]); continue
        if b['t'] == 'h4' and not pt and ' — ' in t and not t.startswith('PARTE'): pt = t; continue
        intro.append(b)
    uline = next((v for k, v in meta if k == 'Unidade'), None)
    if not uline:
        mm = re.search(r'UNIDADE (A1-U\d+)', ' '.join(pl(b) for b in head)); uline = mm.group(1) if mm else code[:6]
    ucode = code[:6]
    uname = uline.split('—', 1)[1].strip() if '—' in uline else ''
    body, st = process_exercises(body)
    stats_all[code] = st
    secs = []; cur = None
    for b in body:
        if b['t'] == 'h2':
            title = pl(b); cur = dict(id='s%d' % (len(secs) + 1), title=re.sub(r'^\d+\.\s*', '', title), num=re.match(r'^(\d+)', title).group(1) if re.match(r'^(\d+)', title) else '', kind=kind_of(title), blocks=[]); secs.append(cur)
        elif cur is not None: cur['blocks'].append(b)
    for s in secs:
        if s['kind'] == 'content' and any(x['t'] == 'ex' for x in s['blocks']): s['kind'] = 'exercises'
        if s['kind'] == 'exercises' and not any(x['t'] == 'ex' for x in s['blocks']) and any(re.search(r'etapa', pl(x).lower()) for x in s['blocks'][:2]): pass
    cards = cards_from(body, code)
    mods.append(dict(code=code, title=m['title'], pt=pt.replace('**', ''), unit=ucode, unitName=uname, meta=meta, intro=intro, sections=secs, cards=cards, pages=m['pages']))

# módulos que têm exercícios mas fora de seção 'exercises' (ex. U07-M01): marcar a seção que contém ex
# ---------- roteiro curricular (Documento B) ----------
B = open('/home/claude/src/B.md', encoding='utf-8').read()
road = collections.OrderedDict(); lvl = None; unit = None; mod = None
for line in B.split('\n'):
    mm = re.match(r'^# Nível (A1|A2|B1|B2)\s*$', line)
    if mm: lvl = mm.group(1); road.setdefault(lvl, collections.OrderedDict()); continue
    mm = re.match(r'^## ((?:A1|A2|B1|B2)-U\d+) — (.*)$', line)
    if mm: unit = dict(code=mm.group(1), title=mm.group(2).strip(), scope='', mods=[]); road[mm.group(1)[:2]][unit['code']] = unit; continue
    mm = re.match(r'^\*\*Escopo da unidade:\s*\*\*\s*(.*)$', line)
    if mm and unit: unit['scope'] = mm.group(1).strip(); continue
    mm = re.match(r'^### ((?:A1|A2|B1|B2)-U\d+-M\d+) — (.*)$', line)
    if mm and unit: mod = dict(code=mm.group(1), title=mm.group(2).strip()); unit['mods'].append(mod); continue
    mm = re.match(r'^\| \*\*(\d+)\. [^|]*\*\* \| (.*) \|$', line)
    if mm and mod:
        n = int(mm.group(1)); v = mm.group(2).strip()
        key = {5: 'gram', 6: 'lex', 9: 'pre', 11: 'sit', 12: 'task', 13: 'crit'}.get(n)
        if key: mod[key] = v
road_out = {l: list(us.values()) for l, us in road.items()}

# ---------- unidades do A1 e curso ----------
units = collections.OrderedDict()
for m in mods:
    u = units.setdefault(m['unit'], dict(code=m['unit'], title=m['unitName'], mods=[]))
    u['mods'].append(m['code'])
course = dict(
    levels=[dict(code='A1', name='Iniciante', focus='Fundamentos da comunicação', result='Apresentar-se, trocar informações simples e lidar com necessidades imediatas previsíveis.', available=True),
            dict(code='A2', name='Elementar', focus='Autonomia em situações familiares', result='Resolver tarefas rotineiras, descrever experiências e fazer planos simples.', available=False),
            dict(code='B1', name='Intermediário', focus='Autonomia prática e discurso conectado', result='Relatar experiências, explicar razões, lidar com situações de viagem e sustentar opiniões.', available=False),
            dict(code='B2', name='Intermediário avançado', focus='Autonomia avançada e comunicação nuançada', result='Compreender discursos complexos, argumentar, sintetizar e adaptar registro e linguagem.', available=False)],
    units=list(units.values()), roadmap=road_out)

def js(name, obj, var):
    with open(f'{OUT}/data/{name}', 'w', encoding='utf-8') as f:
        f.write(f'/* Gerado a partir da apostila. Edite aqui para ajustar conteúdos. */\n{var}=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n')
js('curso.js', course, 'window.FR_CURSO')
for m in mods:
    js(f"modulos/{m['code']}.js", m, f"(window.FR_MODULOS=window.FR_MODULOS||{{}})['{m['code']}']")
for m in mods:
    nsec = len(m['sections']); nex = sum(1 for s in m['sections'] for b in s['blocks'] if b['t'] == 'ex')
    print(m['code'], 'secs', nsec, 'ex', nex, 'q/ans', stats_all[m['code']], 'cards', len(m['cards']), 'kinds', collections.Counter(s['kind'] for s in m['sections']).most_common(4))
print({l: (len(us), sum(len(u['mods']) for u in us)) for l, us in road_out.items()})
