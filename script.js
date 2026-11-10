/* Français A1 — aplicação. Dados em data/ (gerados da apostila); progresso em localStorage. */
(() => {
'use strict';
const C = window.FR_CURSO, M = window.FR_MODULOS || {};
const ORDER = C.units.flatMap(u => u.mods);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\*/g, '');
const plain = s => String(s || '').replace(/\*\*/g, '');
const norm = s => plain(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+([?!:;])/g, '$1').replace(/\s+/g, ' ').trim().replace(/^[\s.,!?«»“”"]+|[\s.,!?«»“”"]+$/g, '');
const nacc = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const KIND = { intro: ['🎯', 'Introdução'], vocab: ['🗂️', 'Vocabulário'], pronunciation: ['🔊', 'Pronúncia'], reading: ['📖', 'Leitura e diálogos'], errors: ['⚠️', 'Erros frequentes'], exercises: ['✏️', 'Exercícios'], activity: ['🧩', 'Atividade integradora'], summary: ['📌', 'Resumo'], checklist: ['✅', 'Checklist'], gabarito: ['🔑', 'Gabarito'], editorial: ['🗒️', 'Nota editorial'], evaluation: ['📊', 'Avaliação'], closing: ['🏁', 'Encerramento'], content: ['📘', 'Conteúdo'] };

/* ---------- estado e armazenamento ---------- */
const KEY = 'frApostilaA1.v1';
const def = () => ({ theme: null, last: null, sec: {}, mod: {}, ex: {}, cards: {}, notes: {}, ck: {}, open: {}, qa: {} });
let S = def();
try { S = Object.assign(def(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
let st = 0; const save = () => { clearTimeout(st); st = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }, 120); };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); };

/* ---------- progresso ---------- */
const studySecs = m => m.sections.filter(s => s.kind !== 'editorial');
const secKey = (c, id) => c + '#' + id;
function modPct(c) { const m = M[c]; if (!m) return 0; const ss = studySecs(m); const d = ss.filter(s => S.sec[secKey(c, s.id)]).length; return ss.length ? Math.round(100 * d / ss.length) : 0; }
const modDone = c => modPct(c) === 100 || !!S.mod[c];
const dotCls = c => modDone(c) ? 'd' : modPct(c) > 0 ? 'p' : '';
function exStats() { let a = 0, ok = 0; for (const k in S.ex) { const r = S.ex[k].r; if (r) { a++; if (r === 'ok') ok++; else if (r === 'part') ok += .5; } } return { a, ok, bad: Object.values(S.ex).filter(x => x.r === 'bad').length }; }
const allCards = () => ORDER.flatMap(c => (M[c] ? M[c].cards : []).map(k => Object.assign({ id: c + '|' + k.f }, k)));
const cardState = id => S.cards[id] || { b: 0, d: 0 };
const dueCards = () => allCards().filter(k => !S.cards[k.id] || S.cards[k.id].d <= Date.now());

/* ---------- áudio (voz do navegador) ---------- */
function speak(t) { if (!('speechSynthesis' in window)) return toast('Seu navegador não tem síntese de voz.'); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(plain(t).replace(/\s*[—–].*$/, '').replace(/…/g, '...')); u.lang = 'fr-FR'; u.rate = .85; const v = speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang)); if (v) u.voice = v; speechSynthesis.speak(u); }
const sayBtn = t => 'speechSynthesis' in window ? `<button class="say" data-say="${esc(plain(t))}" aria-label="Ouvir" title="Ouvir em francês">🔊</button>` : '';

/* ---------- renderização de blocos ---------- */
const FRH = /^(Francês|Expressão( em francês)?|Palavra|Pergunta( em francês)?)$/;
const NOTDLG = /^(Explica|Resposta|Exemplo|Observ|Coment|Aten|Dica|Nota|Tradu|Modelo|Crit[eé]rio|Meta|Orienta|Regra|Importante|Lembre|Resumo|Estrat|Objetivo|Situa|Tarefa|Aviso|Compare|Cuidado|Pr[eé]-req|N[ií]vel|Unidade|Dura)/i;
const DLG = /^\*\*([^*]{1,32}?)\s*:\s*\*\*\s*(.+)$/;
const CALL = /^(Observe|Atenção|Dica|Importante|Lembre|Nota|Cuidado|Exemplo comentado|Regra|Meta comunicativa|Orientação|Compare|Curiosidade|Cultura|Resumo|Estratégia)/i;
const SELF = /autoavalia|o que voc[êe] (j[áa] )?(consegue|conseguiu)/i;
const QCTX = /compreens|quest|pergunt|ficha|leitura|texto|di[aá]logo|responda|interpreta|atividade|etapa|escuta/i;
const NL = /^(?:\*\*)?(\d+(?:\.\d+)?)\.?(?:\*\*)?\s*([\s\S]*)$/;
const lab = l => /^\d+$/.test(l) ? l : /^[a-f]$/i.test(l) ? l + ')' : l;
function tableHTML(b, key) {
  const hd = b.head ? b.rows[0] : null, rows = b.head ? b.rows.slice(1) : b.rows;
  const fi = hd ? hd.findIndex(h => FRH.test(plain(h).trim())) : -1;
  const cell = (c, i, r) => /^_{3,}$/.test(c.trim()) && key ? `<input class="tin" data-qa="${esc(key + '|' + r + '|' + i)}" value="${esc((S.qa[key + '|' + r + '|' + i]) || '')}" aria-label="Sua resposta" autocomplete="off">` : inl(c) + (i === fi && c ? sayBtn(c) : '');
  return '<div class="tw"><table>' + (hd ? '<thead><tr>' + hd.map(h => `<th>${inl(h)}</th>`).join('') + '</tr></thead>' : '') + '<tbody>' + rows.map((r, ri) => '<tr>' + r.map((c, i) => `<td>${cell(c, i, ri)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
}
function gabHTML(g, inner) {
  return `<div class="gabg">${inner ? '' : `<h4><span class="exn">Exercício ${esc(g.num)}</span> ${inl(g.title)}</h4>`}<ol class="al">` + g.ent.map(([l, a]) => `<li><span class="al-l">${esc(lab(l))}</span><span>${inl(a)}</span></li>`).join('') + '</ol>' + (g.expl && g.expl.length ? '<div class="expl">' + g.expl.map(t => `<p>${inl(t)}</p>`).join('') + '</div>' : '') + '</div>';
}
function blocksHTML(bs, ctx) {
  ctx = ctx || {}; let h = '', i = 0, hc = ctx.st || '', ol = false;
  const live = !ctx.tr && !ctx.noq && !!ctx.sid, qk = j => ctx.mod + '|' + ctx.sid + '|' + j;
  const cl = () => { if (ol) { h += '</ol>'; ol = false; } };
  const glink = () => ctx.gab ? `<p class="mut small qlink">Confira suas respostas no <a href="#/modulo/${ctx.mod}/${ctx.gab}">gabarito comentado</a>.</p>` : '';
  const zone = j => { while (j < bs.length && ['p', 'li', 'n'].includes(bs[j].t)) { const t = plain(bs[j].x).trim(); if (/:$|^Marque/i.test(t) && t.length < 120) { h += `<p>${inl(bs[j].x)}</p>`; j++; continue; } if (t.length > 150 || /^(Se voc|Como interpretar|Maioria|Todos)/i.test(t)) break; h += ckHTML(ctx, bs[j].x); j++; } return j; };
  while (i < bs.length) {
    const b = bs[i];
    if (b.t !== 'n') cl();
    if (b.t === 'ex') { h += exHTML(ctx.mod, b); i++; continue; }
    if (b.t === 'gab') { h += gabHTML(b); i++; continue; }
    if (b.t === 'table') { h += tableHTML(b, live ? qk(i) : null); i++; continue; }
    if (b.t === 'h3' && /tradu[cç]/i.test(b.x)) { let j = i + 1; while (j < bs.length && !['h2', 'h3', 'h4'].includes(bs[j].t)) j++; h += `<details class="rv"><summary>${inl(b.x)} — mostrar / ocultar</summary>${blocksHTML(bs.slice(i + 1, j), Object.assign({}, ctx, { tr: 1 }))}</details>`; i = j; continue; }
    if (b.t === 'h3' || b.t === 'h4') { hc = plain(b.x); h += `<${b.t}>${inl(b.x)}</${b.t}>`; i++; if (live && SELF.test(hc)) i = zone(i); continue; }
    if (b.t === 'li') { let j = i; const it = []; while (j < bs.length && bs[j].t === 'li') it.push(bs[j++]); h += ctx.ck ? it.map(x => ckHTML(ctx, x.x)).join('') : '<ul>' + it.map(x => `<li>${inl(x.x)}</li>`).join('') + '</ul>'; i = j; continue; }
    if (b.t === 'n') {
      const m = b.x.match(NL), l = m ? m[1] : '', t = m ? m[2].trim() : b.x;
      if (ctx.ck) { h += ckHTML(ctx, b.x); i++; continue; }
      if (!live && ctx.wlkey && !t) { const k = ctx.wlkey; h += `<div class="wl"><span>${esc(l)}.</span><input class="tin" data-qa="${esc(k)}" value="${esc(S.qa[k] || '')}" placeholder="Escreva aqui…" autocomplete="off"></div>`; i++; continue; }
      if (live && !t) { cl(); let j = i, w = ''; while (j < bs.length && bs[j].t === 'n' && !(bs[j].x.match(NL) || [])[2]) { const k = qk(j), n = bs[j].x.match(NL)[1]; w += `<div class="wl"><span>${esc(n)}.</span><input class="tin" data-qa="${esc(k)}" value="${esc(S.qa[k] || '')}" placeholder="Escreva aqui…" autocomplete="off"></div>`; j++; } h += w; i = j; continue; }
      let j = i + 1; const op = []; while (live && j < bs.length && bs[j].t === 'opt') { const mm = plain(bs[j].x).match(/^([a-f])\)\s*([\s\S]*)$/i); op.push(mm ? [mm[1].toLowerCase(), mm[2]] : ['', bs[j].x]); j++; }
      const isQ = live && t && (op.length >= 2 || (/\?\s*$/.test(plain(t)) && (QCTX.test(hc) || ctx.kind === 'reading')));
      if (isQ) {
        cl(); const k = qk(i), v = S.qa[k] || '';
        h += `<div class="qa"><div class="qt"><span class="lab">${esc(l)}.</span>${inl(t)}</div>` + (op.length >= 2 ? '<div class="opts">' + op.map(([a, x]) => `<button class="qo ${v === a ? 'sel' : ''}" data-qa="${esc(k)}" data-l="${a}" aria-pressed="${v === a}"><b>${a})</b> ${inl(x)}</button>`).join('') + '</div>' : `<textarea class="qinp" rows="2" data-qa="${esc(k)}" placeholder="Escreva sua resposta…">${esc(v)}</textarea>`) + '</div>';
        i = op.length >= 2 ? j : i + 1; if (!(bs[i] && bs[i].t === 'n')) h += glink(); continue;
      }
      if (!ol) { h += '<ol class="nl">'; ol = true; }
      h += `<li><span class="nb">${esc(l)}</span><div>${inl(t)}</div></li>`; i++; continue;
    }
    if (b.t === 'p' || b.t === 'opt') {
      const dm = b.t === 'p' && b.x.match(DLG);
      if (dm && !NOTDLG.test(dm[1].trim())) {
        let j = i; const sp = []; let g = '';
        while (j < bs.length && bs[j].t === 'p') { const m = bs[j].x.match(DLG); if (!m || NOTDLG.test(m[1].trim())) break; let k = sp.indexOf(m[1].trim()); if (k < 0) { sp.push(m[1].trim()); k = sp.length - 1; } g += `<div class="bub ${k % 2 ? 'r' : ''}"><small>${esc(m[1].trim())}</small>${inl(m[2])}${ctx.tr ? '' : sayBtn(m[2])}</div>`; j++; }
        h += `<div class="dlg">${g}</div>`; i = j; continue;
      }
      if (ctx.ck && /^(Consigo|Je peux|Posso|Sei|Sou capaz|Reconhe[cç]o|Identifiquei|Reconheci|Consegui)/i.test(plain(b.x))) { h += ckHTML(ctx, b.x); i++; continue; }
      if (live && b.t === 'p' && plain(b.x).length < 120 && /^(Marque|Autoavalia)/i.test(plain(b.x))) { h += `<p>${inl(b.x)}</p>`; i = zone(i + 1); continue; }
      const cm = b.t === 'p' && b.x.match(/^\*\*([^*]{2,45}?)\*\*/);
      if (cm && CALL.test(plain(cm[1]))) { const w = /aten|cuidado|importante/i.test(cm[1]) ? 'w' : /dica|lembre|exemplo/i.test(cm[1]) ? 't' : ''; h += `<div class="co ${w}">${inl(b.x)}</div>`; i++; continue; }
      h += `<p class="${b.t === 'opt' ? 'opt' : ''}">${inl(b.x)}</p>`; i++; continue;
    }
    i++;
  }
  cl(); return h;
}
function ckHTML(ctx, t) { const k = ctx.mod + '#' + plain(t).slice(0, 60); return `<label class="ck ${S.ck[k] ? 'on' : ''}"><input type="checkbox" data-ck="${esc(k)}" ${S.ck[k] ? 'checked' : ''}><span>${inl(t)}</span></label>`; }

/* ---------- exercícios ---------- */
const exKey = (exId, i) => exId + '|' + i;
function grade(e, v) {
  if (e.type === 'mc' || e.type === 'tf') return v === e.ans ? 'ok' : 'bad';
  const vars = [e.blank, e.ans].filter(Boolean).flatMap(a => String(a).split(/\s+\/\s+|\s+ou\s+/));
  const full = e.type === 'fill' && e.blank ? vars : String(e.ans).split(/\s+\/\s+/);
  const n = norm(v); if (!n) return null;
  if (full.some(a => norm(a) === n)) return 'ok';
  if (full.some(a => nacc(a) === nacc(v))) return 'part';
  return e.type === 'fill' ? 'bad' : 'self';
}
function qHTML(exId, e, i, withExp) {
  const k = exKey(exId, i), sv = S.ex[k] || {}; let h = `<div class="qi ${sv.r || ''}" data-k="${esc(k)}" data-i="${i}"><div class="qt"><span class="lab">${esc(String(e.id).startsWith('u') ? '' : e.id + (/^\d+$/.test(e.id) ? '.' : ')'))}</span>${inl(e.q)}</div>`;
  if (e.type === 'mc' && e.ans) h += '<div class="opts">' + e.opts.map(([l, t]) => `<button class="o ${sv.v === l ? (l === e.ans ? 'right' : 'wrong') : (sv.v && l === e.ans ? 'right' : '')}" data-l="${l}"><b>${l})</b> ${inl(t)}</button>`).join('') + '</div>';
  else if (e.type === 'tf' && e.ans) h += '<div class="opts">' + [['v', 'Verdadeiro'], ['f', 'Falso']].map(([l, t]) => `<button class="o ${sv.v === l ? (l === e.ans ? 'right' : 'wrong') : (sv.v && l === e.ans ? 'right' : '')}" data-l="${l}">${t}</button>`).join('') + '</div>';
  else if (e.type === 'mc') h += '<div class="opts">' + e.opts.map(([l, t]) => `<div class="o"><b>${l})</b> ${inl(t)}</div>`).join('') + '</div><div class="mut small">Sem correção automática neste item — confira no gabarito comentado.</div>';
  else if (e.ans && e.type !== 'mc') h += `<div class="in"><input type="text" value="${esc(sv.v || '')}" placeholder="${e.type === 'fill' && e.blank ? 'Complete a lacuna…' : 'Escreva sua resposta em francês…'}" aria-label="Sua resposta" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn sm pri chk">Verificar</button></div>`;
  else h += `<textarea class="free" placeholder="Escreva sua resposta (salva automaticamente). Compare com o gabarito comentado abaixo.">${esc(sv.v || '')}</textarea>`;
  h += `<div class="fb ${sv.r || ''}">${sv.r ? fbText(e, sv, withExp) : ''}</div></div>`;
  return h;
}
function fbText(e, sv, exp) {
  const ans = e.type === 'mc' ? (e.opts.find(o => o[0] === e.ans) || [0, ''])[0] + ') ' + (e.opts.find(o => o[0] === e.ans) || [0, ''])[1] : e.type === 'tf' ? (e.ans === 'v' ? 'Verdadeiro' : 'Falso') : (e.type === 'fill' && e.blank && norm(e.blank) !== norm(e.ans) ? e.blank + '** (frase completa: ' + e.ans + ')' : e.ans);
  if (sv.r === 'ok') return '✓ Correto!' + (sv.self ? ' (autoavaliação)' : '');
  if (sv.r === 'part') return `◐ Quase! Confira os acentos/ortografia. Resposta modelo: <strong>${inl(ans)}</strong>`;
  if (sv.r === 'self') return `Resposta modelo: <strong>${inl(ans)}</strong><br><span class="mut small">Outras formulações naturais também podem estar corretas. Sua resposta equivale ao modelo?</span> <button class="btn sm ok selfy">Sim</button> <button class="btn sm selfn">Preciso revisar</button>`;
  return `✗ Não foi dessa vez. Resposta esperada: <strong>${inl(ans)}</strong>` + (exp ? `<div class="exp">${exp}</div>` : '');
}
function exHTML(code, ex) {
  const id = code + '|' + ex.num; const expH = (ex.expl || []).map(t => `<p>${inl(t)}</p>`).join('');
  let qi = 0, h = `<article class="ex" data-ex="${esc(id)}"><header><span class="exn">Exercício ${esc(ex.num)}</span><h4>${inl(ex.title)}</h4></header>`;
  ex.els.forEach((e, i) => {
    if (e.k === 'raw') h += blocksHTML([e.b], { mod: code, noq: 1, wlkey: id + '|' + i });
    else if (e.k === 'q') h += qHTML(id, e, i, expH);
    else {
      const sv = S.ex[exKey(id, i)] || {}; h += `<div class="qi ${sv.r || ''}" data-k="${esc(exKey(id, i))}" data-i="${i}">${e.head ? `<div class="mut small">${esc(e.head[0])} → ${esc(e.head[1])}</div>` : ''}<div class="mt">` + e.keys.map((k, n) => `<span>${esc(k)}. ${inl(e.left[n])}</span><select data-m="${esc(k)}"><option value="">—</option>${e.right.map(([l]) => `<option ${sv.v && sv.v[k] === l ? 'selected' : ''}>${l}</option>`).join('')}</select>`).join('') + `</div><div class="mut small" style="margin-top:6px">${e.right.map(([l, t]) => `<b>${l}.</b> ${inl(t)}`).join(' &nbsp; ')}</div><div class="exf"><button class="btn sm pri mchk">Verificar associação</button></div><div class="fb ${sv.r || ''}">${sv.r ? (sv.r === 'ok' ? '✓ Todas corretas!' : '✗ Há associações incorretas. Respostas: ' + e.keys.map(k => k + '→' + (e.ans[k] || '?')).join(', ')) : ''}</div></div>`;
    }
  });
  const hasG = ex.gabd || (ex.gab && ex.gab.length);
  h += `<div class="exf"><button class="btn sm redo">↺ Refazer</button>${hasG ? '<button class="btn sm gab">🔑 Gabarito comentado</button>' : ''}<span class="exsum"></span></div>`;
  if (hasG) h += `<div class="gabv prose" hidden>${ex.gabd ? gabHTML(Object.assign({ num: ex.num, title: ex.title }, ex.gabd), 1) : blocksHTML(ex.gab, { mod: code, tr: 1 })}</div>`;
  return h + '</article>';
}
function exSummary(art) { const k = art.dataset.ex; const q = $$('.qi', art); const done = q.filter(x => /ok|bad|part/.test(x.className)).length, ok = q.filter(x => x.classList.contains('ok')).length; $('.exsum', art).textContent = q.length ? `${done}/${q.length} respondidas · ${ok} corretas` : ''; }
function setResult(el, e, v, r, self) {
  const k = el.dataset.k; S.ex[k] = { v, r, self: self ? 1 : 0 }; save();
  const art = el.closest('.ex'); let exp = ''; if (art && S.ex[k]) { const [code, num] = (art.dataset.ex || '').split('|'); const ex = findEx(code, num); if (ex) exp = (ex.expl || []).map(t => `<p>${inl(t)}</p>`).join(''); }
  el.className = 'qi ' + (r === 'self' ? '' : r); const fb = $('.fb', el); fb.className = 'fb ' + r; fb.innerHTML = fbText(e, S.ex[k], exp);
  if (art) exSummary(art); updateSideProgress();
}
function findEx(code, num) { const m = M[code]; if (!m) return null; for (const s of m.sections) for (const b of s.blocks) if (b.t === 'ex' && b.num === num) return b; return null; }
function elOf(el) { const art = el.closest('.ex'); let code, num, i = +el.dataset.i; if (art) [code, num] = art.dataset.ex.split('|'); else { const p = el.dataset.k.split('|'); code = p[0]; num = p[1]; } const ex = findEx(code, num); return ex ? ex.els[i] : null; }

/* ---------- eventos globais (delegação) ---------- */
document.addEventListener('click', ev => {
  const t = ev.target; let b;
  if ((b = t.closest('.say'))) return speak(b.dataset.say);
  if ((b = t.closest('.qo'))) { const k = b.dataset.qa, on = S.qa[k] === b.dataset.l; if (on) delete S.qa[k]; else S.qa[k] = b.dataset.l; save(); $$('.qo', b.parentElement).forEach(o => { const sel = S.qa[k] === o.dataset.l; o.classList.toggle('sel', sel); o.setAttribute('aria-pressed', sel); }); return; }
  if ((b = t.closest('.o'))) { const el = b.closest('.qi'), e = elOf(el); if (!e) return; const v = b.dataset.l; setResult(el, e, v, v === e.ans ? 'ok' : 'bad'); $$('.o', el).forEach(o => { o.classList.remove('right', 'wrong'); if (o.dataset.l === e.ans) o.classList.add('right'); else if (o.dataset.l === v) o.classList.add('wrong'); }); return; }
  if ((b = t.closest('.chk'))) { const el = b.closest('.qi'), e = elOf(el), v = $('input', el).value; const r = grade(e, v); if (!r) return toast('Digite uma resposta primeiro.'); return setResult(el, e, v, r); }
  if ((b = t.closest('.selfy, .selfn'))) { const el = b.closest('.qi'), e = elOf(el); return setResult(el, e, S.ex[el.dataset.k].v, b.classList.contains('selfy') ? 'ok' : 'bad', 1); }
  if ((b = t.closest('.mchk'))) { const el = b.closest('.qi'), e = elOf(el); const v = {}; $$('select', el).forEach(s => v[s.dataset.m] = s.value); if (Object.values(v).some(x => !x)) return toast('Associe todos os itens.'); if (!Object.keys(e.ans).length) { $('.fb', el).textContent = 'Sem correção automática — compare com o gabarito comentado.'; return; } const ok = e.keys.every(k => (e.ans[k] || '') === v[k]); S.ex[el.dataset.k] = { v, r: ok ? 'ok' : 'bad' }; save(); el.className = 'qi ' + (ok ? 'ok' : 'bad'); const fb = $('.fb', el); fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.innerHTML = ok ? '✓ Todas corretas!' : '✗ Há associações incorretas. Respostas: ' + e.keys.map(k => k + '→' + (e.ans[k] || '?')).join(', '); const art = el.closest('.ex'); if (art) exSummary(art); updateSideProgress(); return; }
  if ((b = t.closest('.gab'))) { const g = $('.gabv', b.closest('.ex')); g.hidden = !g.hidden; b.textContent = g.hidden ? '🔑 Gabarito comentado' : 'Ocultar gabarito'; return; }
  if ((b = t.closest('.redo'))) { const art = b.closest('.ex'); const [code, num] = art.dataset.ex.split('|'); Object.keys(S.ex).filter(k => k.startsWith(code + '|' + num + '|')).forEach(k => delete S.ex[k]); save(); art.outerHTML = exHTML(code, findEx(code, num)); updateSideProgress(); return; }
  if (t.closest('#scrim')) toggleMenu(false);
  if (t.closest('.side a')) toggleMenu(false);
});
document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('.qi input[type=text]')) { ev.preventDefault(); $('.chk', ev.target.closest('.qi')).click(); } });
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.matches('.free')) { const el = t.closest('.qi'); S.ex[el.dataset.k] = { v: t.value, r: '' }; save(); }
  if (t.matches('.qinp, .tin')) { const k = t.dataset.qa; if (t.value.trim()) S.qa[k] = t.value; else delete S.qa[k]; save(); }
  if (t.matches('[data-note]')) { const k = t.dataset.note; if (t.value.trim()) S.notes[k] = t.value; else delete S.notes[k]; save(); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.matches('[data-ck]')) { const k = t.dataset.ck; if (t.checked) S.ck[k] = 1; else delete S.ck[k]; t.closest('.ck').classList.toggle('on', t.checked); save(); }
});

/* ---------- navegação lateral ---------- */
function renderSide() {
  const cur = (location.hash.match(/^#\/modulo\/([^/]+)/) || [])[1];
  let h = '<a class="nv-a ' + (!location.hash || location.hash === '#/' ? 'on' : '') + '" href="#/">🏠 Painel inicial</a>';
  C.levels.forEach(l => {
    h += `<div class="nv-h">Nível ${l.code} · ${esc(l.name)}</div>`;
    if (!l.available) { h += `<a class="nv-a lock" href="#/roteiro/${l.code}">🗺️ Roteiro ${l.code} <span class="pc">em breve</span></a>`; return; }
    C.units.forEach(u => {
      const open = u.mods.includes(cur) || S.open[u.code];
      h += `<details class="nv-u" data-u="${u.code}" ${open ? 'open' : ''}><summary>${u.code.slice(3)} · ${esc(u.title)}</summary><div class="mods">` + u.mods.map(c => { const m = M[c]; return `<a class="nv-a ${c === cur ? 'on' : ''}" href="#/modulo/${c}"><span class="dot ${dotCls(c)}"></span>${esc(c.slice(-3))} · ${esc(m ? m.title.split(' — ')[0] : c)}<span class="pc">${modPct(c)}%</span></a>`; }).join('') + '</div></details>';
    });
  });
  h += '<div class="nv-h">Ferramentas</div><a class="nv-a" href="#/cartoes">🗂️ Flashcards</a><a class="nv-a" href="#/revisao">🔁 Revisão</a><a class="nv-a" href="#/notas">📝 Minhas notas</a><a class="nv-a" href="#/config">⚙️ Backup e dados</a>';
  $('#side').innerHTML = h;
  $$('#side details.nv-u').forEach(d => d.addEventListener('toggle', () => { S.open[d.dataset.u] = d.open ? 1 : 0; save(); }));
}
function updateSideProgress() { const open = $$('#side details[open]').map(d => d.dataset.u); renderSide(); $$('#side details.nv-u').forEach(d => { if (open.includes(d.dataset.u)) d.open = true; }); }
function toggleMenu(f) { const s = $('#side'); const o = f === undefined ? !s.classList.contains('open') : f; s.classList.toggle('open', o); $('#scrim').hidden = !o; $('#menuBtn').setAttribute('aria-expanded', o); }

/* ---------- páginas ---------- */
const view = $('#view');
function home() {
  const total = ORDER.reduce((n, c) => n + (M[c] ? studySecs(M[c]).length : 0), 0), done = Object.keys(S.sec).filter(k => S.sec[k] && M[k.split('#')[0]]).length;
  const pct = total ? Math.round(100 * Math.min(done, total) / total) : 0, es = exStats(), cd = allCards(), known = cd.filter(k => cardState(k.id).b >= 3).length;
  const last = S.last && M[S.last.m] ? S.last : null, next = last ? last : { m: ORDER[0], s: 's1' };
  const lm = M[next.m], mc = ORDER.filter(modDone).length;
  let h = `<section class="hero"><div><h1>Bonjour ! 👋</h1><p>Apostila de francês A1 transformada em curso interativo.</p><p>${last ? 'Continue de onde parou:' : 'Comece pelo primeiro módulo:'} <strong>${esc(lm.title)}</strong></p><p><a class="btn" href="#/modulo/${next.m}/${next.s}">${last ? '▶ Continuar estudo' : '▶ Começar'}</a></p></div><div class="ring" style="--p:${pct}"><b>${pct}%</b></div></section>
  <div class="stats"><div class="stat"><b>${mc}/${ORDER.length}</b><span>módulos concluídos</span></div><div class="stat"><b>${done}</b><span>seções estudadas</span></div><div class="stat"><b>${es.a ? Math.round(100 * es.ok / es.a) + '%' : '—'}</b><span>acertos em ${es.a} itens respondidos</span></div><div class="stat"><b>${known}/${cd.length}</b><span>cartões dominados</span></div></div>
  <div class="row" style="margin-bottom:6px"><a class="btn pri" href="#/cartoes">🗂️ Flashcards (${dueCards().length} pendentes)</a><a class="btn" href="#/revisao">🔁 Revisão de erros (${es.bad})</a><a class="btn" href="#/notas">📝 Minhas notas (${Object.keys(S.notes).length})</a></div>
  <h2 class="sec">Nível A1 — Iniciante</h2><p class="mut">${esc(C.levels[0].result)}</p><div class="grid">`;
  C.units.forEach(u => { const p = Math.round(u.mods.reduce((a, c) => a + modPct(c), 0) / u.mods.length); h += `<div class="card ucard"><span class="chip">${u.code}</span><h3>${esc(u.title)}</h3><div class="bar"><i style="width:${p}%"></i></div><p class="mut small">${p}% concluído</p>` + u.mods.map(c => `<a class="m" href="#/modulo/${c}"><span class="dot ${dotCls(c)}"></span>${esc(M[c].title)}</a>`).join('') + '</div>'; });
  h += '</div><h2 class="sec">Próximos níveis</h2><div class="grid">' + C.levels.slice(1).map(l => `<div class="card"><span class="chip">${l.code}</span><h3>${esc(l.name)} — ${esc(l.focus)}</h3><p class="mut">${esc(l.result)}</p><a class="btn sm" href="#/roteiro/${l.code}">Ver roteiro curricular</a></div>`).join('') + '</div>';
  view.innerHTML = h;
}
function modulePage(code, sid) {
  const m = M[code]; if (!m) { view.innerHTML = '<p>Módulo não encontrado.</p>'; return; }
  const secs = m.sections; let si = secs.findIndex(s => s.id === sid); if (si < 0) si = 0; const s = secs[si];
  S.last = { m: code, s: s.id }; save();
  const mi = ORDER.indexOf(code), pv = ORDER[mi - 1], nx = ORDER[mi + 1], k = secKey(code, s.id), done = !!S.sec[k];
  const kd = KIND[s.kind] || KIND.content;
  const metaH = m.meta.map(([a, b]) => `<div><b>${esc(a)}</b>${inl(b)}</div>`).join('');
  const toc = secs.map((x, i) => `<a href="#/modulo/${code}/${x.id}" class="${i === si ? 'on' : ''} ${x.kind === 'editorial' ? 'ed' : ''}"><span class="dot ${S.sec[secKey(code, x.id)] ? 'd' : ''}"></span><span>${esc(x.num)}. ${esc(x.title)}</span></a>`).join('');
  let body;
  if (['gabarito', 'editorial'].includes(s.kind)) body = `<details class="rv" ${S.open['g' + k] ? 'open' : ''}><summary>${s.kind === 'gabarito' ? 'Mostrar gabarito (tente os exercícios antes!)' : 'Mostrar nota editorial / referência'}</summary><div class="prose">${blocksHTML(s.blocks, { mod: code, tr: 1 })}</div></details>`;
  else body = `<div class="prose">${blocksHTML(s.blocks, { mod: code, ck: s.kind === 'checklist', sid: s.id, st: s.title, kind: s.kind, gab: (secs.find(x => x.kind === 'gabarito') || {}).id })}</div>`;
  const intro = si === 0 ? `<details class="rv"><summary>Como estudar este módulo</summary><div class="prose">${blocksHTML(m.intro, { mod: code })}</div></details>` : '';
  view.innerHTML = `<div class="mh"><span class="chip">${esc(m.unit)} · ${esc(m.unitName)}</span><h1>${esc(m.title)}</h1><div class="pt">${esc(m.pt)}</div><div class="row" style="margin:10px 0"><div class="bar" style="flex:1;min-width:140px"><i style="width:${modPct(code)}%"></i></div><span class="small mut">${modPct(code)}% · ${studySecs(m).filter(x => S.sec[secKey(code, x.id)]).length}/${studySecs(m).length} seções</span></div>${si === 0 ? `<div class="meta">${metaH}</div>` : ''}</div>
  <div class="tocm"><select aria-label="Seções do módulo">${secs.map((x, i) => `<option value="${x.id}" ${i === si ? 'selected' : ''}>${esc(x.num)}. ${esc(x.title)}</option>`).join('')}</select></div>
  <div class="mlayout"><nav class="toc card" aria-label="Seções">${toc}</nav><section class="secv"><div class="sech"><h2>${kd[0]} ${esc(s.num)}. ${esc(s.title)}</h2><button class="btn sm ${done ? 'ok' : ''}" id="doneBtn">${done ? '✓ Seção concluída' : 'Marcar como concluída'}</button></div>${intro}${body}
  <details class="noteb"><summary class="btn sm">📝 Minhas anotações ${S.notes[k] ? '(1)' : ''}</summary><textarea data-note="${esc(k)}" placeholder="Escreva aqui suas dúvidas, exemplos e lembretes desta seção…">${esc(S.notes[k] || '')}</textarea></details>
  <div class="nav2"><a class="btn" href="${si > 0 ? `#/modulo/${code}/${secs[si - 1].id}` : pv ? `#/modulo/${pv}` : '#/'}">← ${si > 0 ? 'Anterior' : pv ? 'Módulo anterior' : 'Painel'}</a><button class="btn pri" id="nextBtn">${si < secs.length - 1 ? 'Concluir e avançar →' : nx ? 'Concluir módulo e seguir →' : 'Concluir módulo 🎉'}</button></div></section></div>`;
  $('.tocm select', view).onchange = e => location.hash = `#/modulo/${code}/${e.target.value}`;
  const nb = $('details.noteb', view); if (S.notes[k]) nb.open = true;
  const gd = $('details.rv > summary', view); if (gd && ['gabarito', 'editorial'].includes(s.kind)) gd.parentElement.addEventListener('toggle', () => { S.open['g' + k] = gd.parentElement.open ? 1 : 0; });
  const markDone = f => { if (f) S.sec[k] = 1; else delete S.sec[k]; save(); };
  $('#doneBtn').onclick = () => { markDone(!S.sec[k]); modulePage(code, s.id); updateSideProgress(); if (modPct(code) === 100) toast('🎉 Módulo concluído! Parabéns!'); };
  $('#nextBtn').onclick = () => { markDone(true); updateSideProgress(); if (si < secs.length - 1) location.hash = `#/modulo/${code}/${secs[si + 1].id}`; else { S.mod[code] = 1; save(); toast('🎉 Módulo concluído!'); location.hash = nx ? `#/modulo/${nx}` : '#/'; } };
  $$('.ex', view).forEach(exSummary);
}
/* flashcards (caixas de Leitner) */
let FC = { q: [], i: 0, flip: false, dir: 'fp', scope: 'all', due: true };
function flashPage(scope) {
  if (scope) FC.scope = scope;
  const pool = allCards().filter(k => FC.scope === 'all' || k.m === FC.scope || k.m.startsWith(FC.scope));
  const q = pool.filter(k => !FC.due || !S.cards[k.id] || S.cards[k.id].d <= Date.now());
  FC.q = q.sort(() => Math.random() - .5); FC.i = 0; FC.flip = false; flashDraw(pool.length);
}
function flashDraw(poolN) {
  const opts = '<option value="all">Todo o curso</option>' + C.units.map(u => `<option value="${u.code}" ${FC.scope === u.code ? 'selected' : ''}>${u.code} · ${esc(u.title)}</option>` + u.mods.map(c => `<option value="${c}" ${FC.scope === c ? 'selected' : ''}>&nbsp;&nbsp;${c.slice(-3)} · ${esc(M[c].title.split(' — ')[0])}</option>`).join('')).join('');
  const k = FC.q[FC.i], fr = FC.dir === 'fp';
  let card = '';
  if (!k) card = `<div class="card" style="text-align:center"><h2>🎉 Sessão concluída</h2><p class="mut">Nenhum cartão pendente neste filtro${FC.due ? '. Desmarque “Somente pendentes” para estudar tudo.' : '.'}</p></div>`;
  else card = `<div class="fc ${FC.flip ? 'flip' : ''}" id="fc"><div class="fci" tabindex="0" role="button" aria-label="Virar cartão"><div class="face"><div class="big">${fr ? inl(k.f) : inl(k.p)}</div>${fr ? sayBtn(k.f) : ''}<small>${esc(k.m)} · clique para virar (espaço)</small></div><div class="face back"><div class="big">${fr ? inl(k.p) : inl(k.f)}</div>${!fr ? sayBtn(k.f) : ''}${k.e ? `<small>${inl(k.e)}</small>` : ''}</div></div></div>
  <div class="rate"><button class="btn" data-r="0">✗ Errei <small>(1)</small></button><button class="btn" data-r="1">≈ Difícil <small>(2)</small></button><button class="btn pri" data-r="2">✓ Sei <small>(3)</small></button></div>`;
  view.innerHTML = `<div class="fcwrap"><h1>🗂️ Flashcards de vocabulário</h1><div class="filters"><select id="fScope" aria-label="Escopo">${opts}</select><select id="fDir"><option value="fp" ${FC.dir === 'fp' ? 'selected' : ''}>Francês → Português</option><option value="pf" ${FC.dir === 'pf' ? 'selected' : ''}>Português → Francês</option></select><label><input type="checkbox" id="fDue" ${FC.due ? 'checked' : ''}> Somente pendentes</label></div><p class="mut small">${k ? `Cartão ${FC.i + 1} de ${FC.q.length} nesta sessão · ` : ''}${allCards().length} cartões no curso, extraídos das tabelas de vocabulário da apostila. A revisão espaçada reapresenta os cartões que você erra mais cedo.</p>${card}</div>`;
  $('#fScope').onchange = e => { FC.scope = e.target.value; flashPage(); };
  $('#fDir').onchange = e => { FC.dir = e.target.value; FC.flip = false; flashDraw(); };
  $('#fDue').onchange = e => { FC.due = e.target.checked; flashPage(); };
  const f = $('.fci'); if (f) f.onclick = ev => { if (ev.target.closest('.say')) return; FC.flip = !FC.flip; $('#fc').classList.toggle('flip', FC.flip); };
  $$('.rate [data-r]').forEach(b => b.onclick = () => rate(+b.dataset.r));
}
function rate(r) {
  const k = FC.q[FC.i]; if (!k) return; const s = cardState(k.id), D = 864e5, iv = [0, 1, 3, 7, 14, 30];
  if (r === 0) { s.b = 0; s.d = Date.now() + 60e3; FC.q.push(k); } else if (r === 1) { s.b = Math.max(1, s.b); s.d = Date.now() + D; } else { s.b = Math.min(5, s.b + 1); s.d = Date.now() + iv[s.b] * D; }
  S.cards[k.id] = s; save(); FC.i++; FC.flip = false; flashDraw(); renderSide();
}
document.addEventListener('keydown', ev => { if (!location.hash.startsWith('#/cartoes') || ev.target.matches('input,select,textarea')) return; if (ev.code === 'Space') { ev.preventDefault(); const f = $('.fci'); if (f) f.click(); } else if (['Digit1', 'Digit2', 'Digit3'].includes(ev.code) && FC.q[FC.i]) rate(+ev.code.slice(-1) - 1); });

function reviewPage() {
  const es = exStats(); const bad = Object.keys(S.ex).filter(k => S.ex[k].r === 'bad');
  let h = `<h1>🔁 Revisão</h1><div class="stats"><div class="stat"><b>${bad.length}</b><span>itens para refazer</span></div><div class="stat"><b>${dueCards().length}</b><span>flashcards pendentes</span></div><div class="stat"><b>${es.a}</b><span>itens respondidos</span></div></div><div class="row"><a class="btn pri" href="#/cartoes">Revisar flashcards</a></div><h2 class="sec">Itens que você errou</h2>`;
  if (!bad.length) h += '<p class="mut">Nenhum erro registrado. Quando você errar um item nos exercícios, ele aparece aqui para ser refeito — a apostila recomenda a retomada de erros recorrentes.</p>';
  bad.forEach(k => { const [code, num, i] = k.split('|'); const ex = findEx(code, num); if (!ex) return; const e = ex.els[+i]; if (!e || e.k !== 'q') return; h += `<p class="small mut"><a href="#/modulo/${code}">${esc(M[code].title)}</a> · Exercício ${esc(num)} — ${inl(ex.title)}</p>` + qHTML(code + '|' + num, e, +i, (ex.expl || []).map(t => `<p>${inl(t)}</p>`).join('')); });
  const lst = ORDER.filter(c => M[c] && modDone(c)); if (lst.length) h += '<h2 class="sec">Módulos concluídos para rever</h2><div class="grid">' + lst.map(c => `<a class="card" style="text-decoration:none;color:inherit" href="#/modulo/${c}">${esc(M[c].title)}<br><span class="small mut">Resumo e checklist ↗</span></a>`).join('') + '</div>';
  view.innerHTML = h;
}
function notesPage() {
  const ks = Object.keys(S.notes);
  let h = `<h1>📝 Minhas notas</h1><p class="mut">Suas anotações por seção, salvas neste navegador.</p>`;
  if (!ks.length) h += '<p>Você ainda não escreveu notas. Abra qualquer seção e use “Minhas anotações”.</p>';
  ks.forEach(k => { const [c, sid] = k.split('#'); const m = M[c], s = m && m.sections.find(x => x.id === sid); h += `<div class="card" style="margin:12px 0"><a href="#/modulo/${c}/${sid}"><strong>${esc(m ? m.title : c)}</strong> · ${esc(s ? s.title : sid)}</a><textarea data-note="${esc(k)}" style="width:100%;min-height:90px;margin-top:8px;padding:.6em;border-radius:10px;border:1px solid var(--line);background:var(--card)">${esc(S.notes[k])}</textarea></div>`; });
  view.innerHTML = h;
}
function roadPage(l) {
  const lv = C.levels.find(x => x.code === l) || C.levels[1]; const us = C.roadmap[lv.code] || [];
  let h = `<h1>🗺️ Roteiro do nível ${lv.code} — ${esc(lv.name)}</h1><div class="co"><strong>Em breve.</strong> A apostila fornecida desenvolve em aulas completas apenas o nível A1. Este roteiro reproduz a ficha curricular do Documento B (módulos ainda sem material didático).</div><p>${esc(lv.focus)}. ${esc(lv.result)}</p><div class="road">`;
  us.forEach(u => { h += `<div class="card"><span class="chip">${u.code}</span><h3>${esc(u.title)}</h3><p class="mut">${esc(u.scope)}</p>` + u.mods.map(m => `<details class="rv"><summary>${esc(m.code.slice(-3))} · ${esc(m.title)}</summary><dl>${[['Conteúdos gramaticais', m.gram], ['Vocabulário', m.lex], ['Situação comunicativa', m.sit], ['Atividade integradora', m.task]].filter(x => x[1]).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl></details>`).join('') + '</div>'; });
  view.innerHTML = h + '</div>';
}
function configPage() {
  view.innerHTML = `<h1>⚙️ Backup e dados</h1><div class="card"><p>Todo o progresso, respostas, cartões e notas ficam salvos <strong>apenas neste navegador</strong> (localStorage). Exporte um backup para levar para outro dispositivo.</p><div class="row"><button class="btn pri" id="exp">⬇ Exportar progresso</button><label class="btn">⬆ Importar<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="rst" style="color:var(--bad)">Apagar todo o progresso</button></div></div>`;
  $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'progresso-frances-a1.json'; a.click(); };
  $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { S = Object.assign(def(), JSON.parse(t)); save(); toast('Progresso importado.'); renderSide(); route(); } catch (x) { toast('Arquivo inválido.'); } }); };
  $('#rst').onclick = () => { if (confirm('Apagar todo o progresso, respostas e notas deste navegador?')) { S = def(); save(); applyTheme(); renderSide(); toast('Progresso apagado.'); location.hash = '#/'; } };
}
/* busca */
let IDX = null;
function buildIdx() {
  const tx = bs => bs.map(b => b.t === 'table' ? b.rows.map(r => r.join(' ')).join(' ') : b.t === 'ex' ? b.title + ' ' + b.els.map(e => e.k === 'raw' ? tx([e.b]) : e.k === 'q' ? e.q + ' ' + (e.opts || []).map(o => o[1]).join(' ') : (e.left || []).join(' ')).join(' ') : b.x).join(' ');
  IDX = []; ORDER.forEach(c => { const m = M[c]; if (!m) return; m.sections.forEach(s => { const text = plain(tx(s.blocks)); IDX.push({ c, sid: s.id, mt: m.title, st: s.title, text, n: nacc(text + ' ' + s.title + ' ' + m.title) }); }); });
}
function search(q) {
  if (!IDX) buildIdx(); const t = nacc(q).split(' ').filter(x => x.length > 1); if (!t.length) return [];
  return IDX.map(x => { let sc = 0; for (const w of t) { const i = x.n.indexOf(w); if (i < 0) return null; sc += 1 + (nacc(x.st).includes(w) ? 3 : 0) + (x.n.split(w).length - 1) * .05; } return Object.assign({ sc }, x); }).filter(Boolean).sort((a, b) => b.sc - a.sc);
}
function snippet(x, q) { const t = nacc(q).split(' ')[0]; const low = x.text.toLowerCase(); let i = nacc(x.text).indexOf(t); if (i < 0) i = 0; const a = Math.max(0, i - 50), s = x.text.slice(a, a + 170); const re = new RegExp('(' + q.trim().split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'); return (a ? '…' : '') + esc(s).replace(re, '<mark>$1</mark>') + '…'; }
function searchPage(q) {
  const r = search(q);
  view.innerHTML = `<h1>🔎 Resultados para “${esc(q)}”</h1><p class="mut">${r.length} seções encontradas (a busca ignora acentos e maiúsculas).</p>` + r.slice(0, 60).map(x => `<a class="card" style="display:block;margin:10px 0;text-decoration:none;color:inherit" href="#/modulo/${x.c}/${x.sid}"><strong>${esc(x.st)}</strong> <span class="chip">${esc(x.c)}</span><div class="small mut snip">${snippet(x, q)}</div></a>`).join('');
}
const qi = $('#q'), qr = $('#qres'); let qt;
qi.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { const v = qi.value.trim(); if (v.length < 2) { qr.hidden = true; return; } const r = search(v).slice(0, 8); qr.innerHTML = r.length ? r.map(x => `<a href="#/modulo/${x.c}/${x.sid}"><strong>${esc(x.st)}</strong><small>${esc(x.mt)}</small></a>`).join('') : '<a>Nada encontrado</a>'; qr.hidden = false; }, 150); });
qi.addEventListener('keydown', e => { if (e.key === 'Enter' && qi.value.trim().length > 1) { qr.hidden = true; location.hash = '#/busca/' + encodeURIComponent(qi.value.trim()); } if (e.key === 'Escape') qr.hidden = true; });
document.addEventListener('click', e => { if (!e.target.closest('.searchbox') || e.target.closest('.qres a')) qr.hidden = true; });

/* ---------- roteador e tema ---------- */
function route() {
  const h = decodeURIComponent(location.hash || '#/'); const p = h.replace(/^#\/?/, '').split('/');
  const r = p[0] || 'home';
  if (r === 'modulo') modulePage(p[1], p[2]); else if (r === 'cartoes') flashPage(p[1]); else if (r === 'revisao') reviewPage(); else if (r === 'notas') notesPage(); else if (r === 'roteiro') roadPage(p[1]); else if (r === 'busca') searchPage(p.slice(1).join('/')); else if (r === 'config') configPage(); else home();
  $$('.topnav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + r));
  renderSide(); window.scrollTo(0, 0); view.focus({ preventScroll: true });
}
function applyTheme() { const t = S.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; }
$('#themeBtn').onclick = () => { S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
$('#menuBtn').onclick = () => toggleMenu();
window.addEventListener('hashchange', route);
applyTheme(); route();
window.__FR = { S: () => S, route, grade, search };
})();
