/**
 * Espace administrateur — tableau de bord financier (onglets Résultat, Dépenses, Autres recettes, Budget).
 * - Recettes = sommes réellement encaissées (feuille « Mouvements », type recette) : ventes de glace (catégorie
 *   FINANCE.glace : devis encaissés via le bouton « Encaisser », ventes sans devis) + autres recettes (activités annexes).
 *   Un devis non encaissé n'est pas une recette.
 * - Dépenses et autres recettes : feuille « Mouvements » du registre ; budget mensuel : feuille « Budget ».
 * - Le budget d'un mois est réparti au prorata des jours : il se compare donc à n'importe quelle période.
 * Graphiques en SVG maison (aucune dépendance), redessinés à la largeur du conteneur.
 */
import { FINANCE } from '../config.js';
import { money, num, formatDay } from '../quote/message.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const DAY = 86400000;
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY) + 1;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const pct = (n) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const compact = (n) => {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${(a / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3).toLocaleString('fr-FR')} k`;
  return `${s}${Math.round(a)}`;
};
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* ---------- Agrégation ---------- */

/** Totaux d'une période (sert aussi à la période précédente). */
export const isGlace = (m) => m.type === 'recette' && m.categorie === FINANCE.glace;

export function totals({ mouvements = [] }) {
  const glace = mouvements.filter(isGlace).reduce((a, m) => a + m.montant, 0);
  const autres = mouvements.filter((m) => m.type === 'recette' && !isGlace(m)).reduce((a, m) => a + m.montant, 0);
  const dep = mouvements.filter((m) => m.type === 'depense').reduce((a, m) => a + m.montant, 0);
  const rec = glace + autres;
  return { glace, autres, rec, dep, res: rec - dep, marge: rec ? ((rec - dep) / rec) * 100 : null };
}

/** Découpe la période en jours, mois ou années selon sa longueur, avec réel et budget par tranche. */
export function series(state) {
  const { du, au, devis = [], mouvements = [], budgets = [] } = state;
  let start = du;
  if (daysBetween(du, au) > 366) {
    // « Depuis le début » : on démarre à la première donnée plutôt qu'à une date arbitraire.
    const first = [...devis.map((q) => ymd(new Date(q.date))), ...mouvements.map((m) => m.date), ...budgets.map((b) => `${b.mois}-01`)].sort()[0];
    if (first && first > start) start = first;
  }
  const span = daysBetween(start, au);
  const unit = span <= 31 ? 'jour' : span <= 731 ? 'mois' : 'annee';
  const keyOf = (s) => (unit === 'jour' ? s : unit === 'mois' ? s.slice(0, 7) : s.slice(0, 4));
  const label = (k) => {
    if (unit === 'jour') { const d = parse(k); return { short: `${d.getDate()}/${d.getMonth() + 1}`, long: formatDay(k) }; }
    if (unit === 'mois') { const m = Number(k.slice(5, 7)) - 1; return { short: `${MONTHS_SHORT[m]} ${k.slice(2, 4)}`, long: `${MONTHS[m]} ${k.slice(0, 4)}` }; }
    return { short: k, long: `année ${k}` };
  };
  const bud = new Map(budgets.map((b) => [b.mois, b]));
  const map = new Map();
  const row = (k) => {
    if (!map.has(k)) map.set(k, { key: k, ...label(k), glace: 0, autres: 0, dep: 0, bVentes: 0, bDep: 0 });
    return map.get(k);
  };
  // Chaque jour de la période crée sa tranche et reçoit sa part du budget mensuel.
  for (let d = parse(start), end = parse(au); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const r = row(keyOf(ymd(d)));
    const b = bud.get(ymd(d).slice(0, 7));
    if (b) {
      const n = daysInMonth(d.getFullYear(), d.getMonth() + 1);
      r.bVentes += (b.ventes || 0) / n;
      r.bDep += (b.depenses || 0) / n;
    }
  }
  for (const m of mouvements) { const k = keyOf(m.date); if (map.has(k)) row(k)[m.type === 'depense' ? 'dep' : isGlace(m) ? 'glace' : 'autres'] += m.montant; }
  const rows = [...map.values()].map((r) => {
    const rec = r.glace + r.autres;
    return { ...r, rec, res: rec - r.dep, bVentes: Math.round(r.bVentes), bDep: Math.round(r.bDep), bRes: Math.round(r.bVentes - r.bDep) };
  });
  const hasBudget = rows.some((r) => r.bVentes || r.bDep);
  return { unit, rows, hasBudget };
}

/* ---------- Graphiques ---------- */

function scale(values, h) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const raw = (hi - lo || 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step || step;
  const ticks = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t);
  return { y: (v) => h - ((v - min) / (max - min)) * h, ticks };
}

const M = { t: 14, r: 10, b: 30, l: 52 };

function frame(w, h, sc, rows, step) {
  const iw = w - M.l - M.r;
  const grid = sc.ticks.map((t) => `<g class="ch-grid${t === 0 ? ' ch-grid--zero' : ''}"><line x1="0" x2="${iw}" y1="${sc.y(t)}" y2="${sc.y(t)}"/><text x="-8" y="${sc.y(t)}" dy="0.32em">${compact(t)}</text></g>`).join('');
  const every = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(iw / 58))));
  const xl = rows.map((r, i) => (i % every ? '' : `<text class="ch-x" x="${(i + 0.5) * step}" y="${h + 20}">${esc(r.short)}</text>`)).join('');
  return grid + xl;
}

/** Arrondi de 4 px sur l'extrémité libre de la barre, base droite sur l'axe. */
function bar(x, y0, y1, w, cls) {
  const top = Math.min(y0, y1);
  const hgt = Math.abs(y1 - y0);
  if (hgt < 0.5) return '';
  const r = Math.min(4, w / 2, hgt);
  return `<path class="${cls}" d="M${x},${top + hgt}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + hgt}Z"/>`;
}

function hover(svg, tip, fig, rows, html) {
  const hits = svg.querySelectorAll('[data-i]');
  const hide = () => { tip.hidden = true; svg.querySelectorAll('.is-on').forEach((n) => n.classList.remove('is-on')); };
  hits.forEach((h) => {
    const show = (e) => {
      hide();
      h.classList.add('is-on');
      tip.innerHTML = html(rows[Number(h.dataset.i)]);
      tip.hidden = false;
      const fr = fig.getBoundingClientRect();
      const hr = h.getBoundingClientRect();
      const x = hr.left + hr.width / 2 - fr.left;
      const left = Math.min(Math.max(x, tip.offsetWidth / 2 + 8), fr.width - tip.offsetWidth / 2 - 8);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(8, (e.clientY ?? hr.top + 40) - fr.top - tip.offsetHeight - 14)}px`;
    };
    h.addEventListener('pointerenter', show);
    h.addEventListener('pointermove', show);
    h.addEventListener('focus', show);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focusout', hide);
}

const tipRow = (cls, k, v) => `<div class="tip-row"><i class="sw ${cls}"></i><span>${k}</span><b>${v}</b></div>`;

/** Recettes empilées (glace + autres) face aux dépenses, par tranche. */
function barChart(fig, rows) {
  const plot = fig.querySelector('[data-plot]');
  const w = Math.max(280, plot.clientWidth || 640);
  const h = 220;
  const iw = w - M.l - M.r;
  const step = iw / rows.length;
  const sc = scale(rows.flatMap((r) => [r.rec, r.dep]), h);
  const bw = Math.max(2, Math.min(28, (step - 6) / 2));
  const marks = rows.map((r, i) => {
    const x = i * step + step / 2 - bw - 1;
    const yg = sc.y(r.glace);
    return `${r.autres ? bar(x, yg, sc.y(r.rec), bw, 'm-autres') : ''}${bar(x, sc.y(0), yg - (r.autres && r.glace ? 2 : 0), bw, r.autres ? 'm-glace m-flat' : 'm-glace')}${bar(x + bw + 2, sc.y(0), sc.y(r.dep), bw, 'm-dep')}
      <rect class="ch-hit" data-i="${i}" x="${i * step}" y="0" width="${step}" height="${h}" tabindex="0" aria-label="${esc(r.long)}"/>`;
  }).join('');
  plot.innerHTML = `<svg width="${w}" height="${h + M.t + M.b}" role="img" aria-label="Recettes et dépenses par période"><g transform="translate(${M.l},${M.t})">${frame(w, h, sc, rows, step)}${marks}</g></svg>`;
  hover(plot.querySelector('svg'), fig.querySelector('[data-tip]'), fig, rows, (r) => `<strong>${esc(r.long)}</strong>
    ${tipRow('sw--glace', 'Ventes de glace', money(r.glace))}${tipRow('sw--autres', 'Autres recettes', money(r.autres))}${tipRow('sw--dep', 'Dépenses', money(r.dep))}
    <div class="tip-res ${r.res < 0 ? 'is-neg' : ''}"><span>Résultat</span><b>${signed(r.res)}</b></div>`);
}

/** Réel (trait plein) face au budget (pointillés), une courbe par série. */
function lineChart(fig, rows, real, budget, cls) {
  const plot = fig.querySelector('[data-plot]');
  const w = Math.max(260, plot.clientWidth || 360);
  const h = 170;
  const iw = w - M.l - M.r;
  const step = iw / rows.length;
  const sc = scale(rows.flatMap((r) => [r[real], r[budget]]), h);
  const pts = (k) => rows.map((r, i) => [(i + 0.5) * step, sc.y(r[k])]);
  const path = (p) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const dots = (p, c) => (rows.length <= 24 ? p.map(([x, y]) => `<circle class="${c}" cx="${x}" cy="${y}" r="4"/>`).join('') : '');
  const pr = pts(real);
  const pb = pts(budget);
  const area = `M${pr[0][0]},${sc.y(0)}${path(pr).replace(/^M/, 'L')}L${pr[pr.length - 1][0]},${sc.y(0)}Z`;
  const hits = rows.map((r, i) => `<rect class="ch-hit ch-hit--line" data-i="${i}" x="${i * step}" y="0" width="${step}" height="${h}" tabindex="0" aria-label="${esc(r.long)}"/><line class="ch-cross" x1="${(i + 0.5) * step}" x2="${(i + 0.5) * step}" y1="0" y2="${h}"/>`).join('');
  plot.innerHTML = `<svg width="${w}" height="${h + M.t + M.b}" role="img" aria-label="Réel comparé au budget"><g transform="translate(${M.l},${M.t})">${frame(w, h, sc, rows, step)}
    <path class="l-area ${cls}" d="${area}"/><path class="l-budget" d="${path(pb)}"/><path class="l-real ${cls}" d="${path(pr)}"/>${dots(pb, 'd-budget')}${dots(pr, `d-real ${cls}`)}${hits}</g></svg>`;
  hover(plot.querySelector('svg'), fig.querySelector('[data-tip]'), fig, rows, (r) => {
    const gap = r[real] - r[budget];
    return `<strong>${esc(r.long)}</strong>${tipRow(`sw--${cls}`, 'Réel', signedIf(r[real]))}${tipRow('sw--budget', 'Budget', signedIf(r[budget]))}
      <div class="tip-res"><span>Écart</span><b>${signed(gap)}</b></div>`;
  });
}
const signedIf = (n) => (n < 0 ? signed(n) : money(n));

/** Mini-courbe d'une carte indicateur. */
function spark(values, cls) {
  if (values.length < 2) return '';
  const w = 120;
  const h = 34;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = (v) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
  const p = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${p}L${w},${h}L0,${h}Z" class="spark-a"/><path d="${p}" class="spark-l"/></svg>`;
}

/* ---------- Tableau de bord ---------- */

export function createDashboard(panel) {
  const $ = (s) => panel.querySelector(s);
  let last = null;

  function delta(cur, prev, goodUp = true) {
    if (prev == null) return '';
    if (!prev) return cur ? '<span class="kpi-delta">nouveau</span>' : '<span class="kpi-delta">= période préc.</span>';
    const d = ((cur - prev) / Math.abs(prev)) * 100;
    if (Math.abs(d) < 0.5) return '<span class="kpi-delta">= période préc.</span>';
    const good = d > 0 === goodUp;
    return `<span class="kpi-delta ${good ? 'is-good' : 'is-bad'}"><span aria-hidden="true">${d > 0 ? '▲' : '▼'}</span> ${pct(Math.abs(d))} <small>vs période préc.</small></span>`;
  }

  function render(state) {
    last = state;
    const t = totals(state);
    const p = state.prev ? totals(state.prev) : null;
    const { rows, unit, hasBudget } = series(state);
    $('[data-fin-warning]').hidden = state.hasMv;

    const neg = t.res < 0;
    $('[data-fin-hero]').innerHTML = `
      <div class="hero-res__main">
        <span class="hero-res__k">Résultat de la période</span>
        <strong class="hero-res__v ${neg ? 'is-neg' : 'is-pos'}">${signed(t.res)}</strong>
        <span class="hero-res__badge ${neg ? 'is-neg' : 'is-pos'}"><span aria-hidden="true">${neg ? '▼' : '▲'}</span> ${neg ? 'Perte' : t.res ? 'Bénéfice' : 'Équilibre'}</span>
        ${delta(t.res, p?.res)}
      </div>
      <div class="hero-res__split">
        <div class="hero-res__bar" role="img" aria-label="Recettes ${money(t.rec)}, dépenses ${money(t.dep)}">
          <span class="hb hb--rec" style="--v:${t.rec / Math.max(t.rec, t.dep, 1)}"></span>
          <span class="hb hb--dep" style="--v:${t.dep / Math.max(t.rec, t.dep, 1)}"></span>
        </div>
        <dl class="hero-res__dl">
          <div><dt><i class="sw sw--glace"></i>Recettes</dt><dd>${money(t.rec)}</dd></div>
          <div><dt><i class="sw sw--dep"></i>Dépenses</dt><dd>${money(t.dep)}</dd></div>
          <div><dt>Marge</dt><dd>${t.marge == null ? '—' : pct(t.marge)}</dd></div>
        </dl>
      </div>`;

    const kpi = (k, v, d, sp, cls) => `<div class="kpi frost"><span class="kpi-k"><i class="sw ${cls}"></i>${k}</span><strong>${v}</strong>${d}${sp}</div>`;
    $('[data-fin-kpis]').innerHTML = [
      kpi('Ventes de glace', money(t.glace), delta(t.glace, p?.glace), spark(rows.map((r) => r.glace), 'sp--glace'), 'sw--glace'),
      kpi('Autres recettes', money(t.autres), delta(t.autres, p?.autres), spark(rows.map((r) => r.autres), 'sp--autres'), 'sw--autres'),
      kpi('Dépenses', money(t.dep), delta(t.dep, p?.dep, false), spark(rows.map((r) => r.dep), 'sp--dep'), 'sw--dep'),
      kpi('Marge nette', t.marge == null ? '—' : pct(t.marge), p && p.marge != null && t.marge != null ? `<span class="kpi-delta ${t.marge >= p.marge ? 'is-good' : 'is-bad'}">${t.marge >= p.marge ? '▲' : '▼'} ${Math.abs(t.marge - p.marge).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pts <small>vs période préc.</small></span>` : '', spark(rows.map((r) => (r.rec ? (r.res / r.rec) * 100 : 0)), 'sp--res'), 'sw--res'),
    ].join('');

    const unitLabel = { jour: 'par jour', mois: 'par mois', annee: 'par année' }[unit];
    panel.querySelectorAll('[data-fin-unit]').forEach((n) => { n.textContent = unitLabel; });
    $('[data-fin-col]').textContent = { jour: 'Jour', mois: 'Mois', annee: 'Année' }[unit];
    $('[data-fin-rows]').innerHTML = rows.map((r) => `<tr><td>${esc(r.long)}</td><td class="num">${money(r.glace)}</td><td class="num">${money(r.autres)}</td><td class="num">${money(r.dep)}</td><td class="num ${r.res < 0 ? 'is-neg' : ''}"><strong>${signed(r.res)}</strong></td></tr>`).join('');
    $('[data-fin-foot]').innerHTML = `<tr><th scope="row">Total</th><td class="num">${money(t.glace)}</td><td class="num">${money(t.autres)}</td><td class="num">${money(t.dep)}</td><td class="num ${t.res < 0 ? 'is-neg' : ''}"><strong>${signed(t.res)}</strong></td></tr>`;

    for (const type of ['depense', 'recette']) {
      const map = new Map();
      for (const m of state.mouvements || []) if (m.type === type) map.set(m.categorie, (map.get(m.categorie) || 0) + m.montant);
      const list = [...map].sort((a, b) => b[1] - a[1]);
      const tot = list.reduce((a, [, v]) => a + v, 0);
      const max = list[0]?.[1] || 1;
      $(`[data-fin-cat="${type}"]`).innerHTML = list.length
        ? list.map(([k, v]) => `<li><div class="cat-top"><span>${esc(k)}</span><b>${money(v)}</b></div><div class="cat-bar"><span class="cat-fill cat-fill--${type}" style="--v:${v / max}"></span><small>${pct((v / tot) * 100)}</small></div></li>`).join('')
        : `<li class="cat-empty">${type === 'depense' ? 'Aucune dépense' : 'Aucune recette encaissée'} sur la période.</li>`;
    }

    const budget = $('[data-fin-budget]');
    budget.hidden = !hasBudget;
    if (hasBudget) {
      const b = rows.reduce((a, r) => ({ v: a.v + r.bVentes, d: a.d + r.bDep }), { v: 0, d: 0 });
      const bm = b.v ? ((b.v - b.d) / b.v) * 100 : null;
      const gauge = (k, real, plan, goodUp, fmt = money) => {
        const ratio = plan ? real / plan : 0;
        const good = goodUp ? ratio >= 1 : ratio <= 1;
        return `<div class="gauge frost">
          <span class="kpi-k">${k}</span>
          <div class="gauge__nums"><strong>${plan ? pct(ratio * 100) : '—'}</strong><span>du budget</span></div>
          <div class="gauge__track"><span class="gauge__fill ${good ? 'is-good' : 'is-bad'}" style="--v:${Math.min(ratio, 1.5) / 1.5}"></span><span class="gauge__goal" title="Budget"></span></div>
          <dl><div><dt>Réel</dt><dd>${fmt(real)}</dd></div><div><dt>Budget</dt><dd>${fmt(plan)}</dd></div><div><dt>Écart</dt><dd class="${good ? 'is-good' : 'is-bad'}">${signed(real - plan)}</dd></div></dl>
        </div>`;
      };
      const mgood = t.marge != null && bm != null && t.marge >= bm;
      $('[data-fin-gauges]').innerHTML = gauge('Recettes vs budget des ventes', t.rec, b.v, true) + gauge('Dépenses vs budget des dépenses', t.dep, b.d, false)
        + `<div class="gauge frost"><span class="kpi-k">Marge réelle vs marge budgétée</span>
          <div class="gauge__nums"><strong>${t.marge == null ? '—' : pct(t.marge)}</strong><span>réel</span></div>
          <div class="gauge__vs"><span>Budget</span><b>${bm == null ? '—' : pct(bm)}</b></div>
          <dl><div><dt>Résultat réel</dt><dd>${signed(t.res)}</dd></div><div><dt>Résultat budget</dt><dd>${signed(b.v - b.d)}</dd></div><div><dt>Écart</dt><dd class="${mgood ? 'is-good' : 'is-bad'}">${t.marge == null || bm == null ? '—' : `${t.marge - bm >= 0 ? '+' : '−'}${Math.abs(t.marge - bm).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pts`}</dd></div></dl>
        </div>`;
      $('[data-fin-brows]').innerHTML = rows.map((r) => `<tr><td>${esc(r.long)}</td><td class="num">${money(r.bVentes)}</td><td class="num">${money(r.rec)}</td><td class="num">${money(r.bDep)}</td><td class="num">${money(r.dep)}</td><td class="num">${signed(r.bRes)}</td><td class="num ${r.res < 0 ? 'is-neg' : ''}">${signed(r.res)}</td></tr>`).join('');
    }
    draw();
  }

  function draw() {
    if (!last || panel.hidden) return;
    const { rows, hasBudget } = series(last);
    barChart($('[data-fin-chart]'), rows);
    if (hasBudget) {
      lineChart($('[data-fin-line="ventes"]'), rows, 'rec', 'bVentes', 'glace');
      lineChart($('[data-fin-line="depenses"]'), rows, 'dep', 'bDep', 'dep');
      lineChart($('[data-fin-line="marge"]'), rows, 'res', 'bRes', 'res');
    }
  }

  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
  return { render, draw };
}

/* ---------- Saisie : dépenses / autres recettes ---------- */

export function mountMovements(panel, type, ctx) {
  const dep = type === 'depense';
  const noun = dep ? 'dépense' : 'recette';
  const cats = dep ? FINANCE.depenseCategories : FINANCE.recetteCategories;
  const lid = `admin-cats-${type}`;
  panel.innerHTML = `
    <form class="mv-form frost" data-mv-form novalidate>
      <h2 class="admin__h3" data-mv-title>${dep ? 'Nouvelle dépense' : 'Nouvelle recette'}</h2>
      <p class="admin-note">${dep ? 'Toute sortie d’argent : électricité, carburant, salaires, emballages…' : `Tout argent encaissé : glace vendue sans devis (activité « ${FINANCE.glace} »), boissons, location… Les devis encaissés s’ajoutent ici d’eux-mêmes avec le bouton « Encaisser » de l’onglet Devis.`}</p>
      <div class="mv-grid">
        <div class="field"><label for="${type}-date">Date</label><input class="input" id="${type}-date" name="date" type="date" required></div>
        <div class="field"><label for="${type}-cat">${dep ? 'Catégorie' : 'Activité'}</label><input class="input" id="${type}-cat" name="categorie" list="${lid}" maxlength="60" required placeholder="${dep ? 'Ex. Électricité' : 'Ex. Vente de boissons'}"><datalist id="${lid}"></datalist></div>
        <div class="field"><label for="${type}-lib">Libellé</label><input class="input" id="${type}-lib" name="libelle" maxlength="120" placeholder="${dep ? 'Ex. Facture CIE octobre' : 'Ex. Vente comptoir, 10 sacs'}"></div>
        <div class="field"><label for="${type}-mt">Montant (F CFA)</label><input class="input" id="${type}-mt" name="montant" type="number" inputmode="numeric" min="1" step="1" required></div>
        <div class="field mv-grid__wide"><label for="${type}-note">Note <span class="field-hint">(facultatif)</span></label><input class="input" id="${type}-note" name="note" maxlength="300"></div>
      </div>
      <div class="mv-actions">
        <button class="btn btn--sm" type="submit"><span data-label>Ajouter la ${noun}</span></button>
        <button class="btn btn--glass btn--sm" type="button" data-mv-cancel hidden>Annuler</button>
        <p class="admin-note" data-mv-msg role="status"></p>
      </div>
    </form>
    <div class="mv-head"><h2 class="admin__h2">${dep ? 'Dépenses' : 'Recettes encaissées'} de la période</h2><strong class="mv-total" data-mv-total></strong></div>
    <div class="admin-table-wrap">
      <table class="admin-table admin-table--mv">
        <thead><tr><th scope="col">Date</th><th scope="col">${dep ? 'Catégorie' : 'Activité'}</th><th scope="col">Libellé</th><th scope="col" class="num">Montant</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody data-mv-rows></tbody>
      </table>
    </div>`;
  const form = panel.querySelector('[data-mv-form]');
  const msg = panel.querySelector('[data-mv-msg]');
  const submit = form.querySelector('[type="submit"]');
  const cancel = panel.querySelector('[data-mv-cancel]');
  let editing = null;
  let linked = ''; // n° du devis encaissé lié à la recette modifiée (conservé à l'enregistrement)
  let list = [];

  function reset() {
    editing = null;
    linked = '';
    form.reset();
    form.date.value = ymd(new Date());
    submit.querySelector('[data-label]').textContent = `Ajouter la ${noun}`;
    panel.querySelector('[data-mv-title]').textContent = dep ? 'Nouvelle dépense' : 'Nouvelle recette';
    cancel.hidden = true;
  }
  reset();
  cancel.addEventListener('click', () => { reset(); msg.textContent = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = {
      id: editing || '', type, date: form.date.value, categorie: form.categorie.value.trim(),
      libelle: form.libelle.value.trim(), montant: Math.round(Number(form.montant.value)), note: form.note.value.trim(), devis: linked,
    };
    const bad = [[form.date, !m.date], [form.categorie, !m.categorie], [form.montant, !(m.montant > 0)]];
    bad.forEach(([el, b]) => el.setAttribute('aria-invalid', String(b)));
    if (bad.some(([, b]) => b)) { msg.textContent = 'Renseignez la date, la catégorie et un montant positif.'; return; }
    submit.disabled = true;
    msg.textContent = 'Enregistrement…';
    try {
      const r = await ctx.post({ action: 'mouvement', mouvement: m });
      if (!r.ok) { msg.textContent = r.erreur === 'code' ? 'Session expirée : reconnectez-vous.' : 'Enregistrement refusé : vérifiez les champs.'; return; }
      const out = m.date < ctx.period().du || m.date > ctx.period().au;
      msg.textContent = `${dep ? 'Dépense' : 'Recette'} ${editing ? 'modifiée' : 'ajoutée'}${out ? ' (hors de la période affichée)' : ''}.`;
      reset();
      ctx.reload();
    } catch {
      msg.textContent = 'Registre injoignable. Réessayez dans un instant.';
    } finally { submit.disabled = false; }
  });

  panel.querySelector('[data-mv-rows]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const m = list[Number(b.dataset.i)];
    if (b.dataset.act === 'edit') {
      editing = m.id;
      linked = m.devis || '';
      for (const k of ['date', 'categorie', 'libelle', 'montant', 'note']) form[k].value = m[k] ?? '';
      submit.querySelector('[data-label]').textContent = 'Enregistrer la modification';
      panel.querySelector('[data-mv-title]').textContent = `Modifier la ${noun}`;
      cancel.hidden = false;
      msg.textContent = '';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      form.montant.focus({ preventScroll: true });
      return;
    }
    if (!confirm(`Supprimer cette ${noun} de ${money(m.montant)} du ${formatDay(m.date)} ?`)) return;
    b.disabled = true;
    try {
      const r = await ctx.post({ action: 'supprimer', mouvement: { id: m.id } });
      if (r.ok) ctx.reload(); else b.disabled = false;
    } catch { b.disabled = false; }
  });

  return {
    update(state) {
      list = (state.mouvements || []).filter((m) => m.type === type);
      const used = new Set([...cats, ...(state.allCats?.[type] || []), ...list.map((m) => m.categorie)]);
      panel.querySelector('datalist').innerHTML = [...used].map((c) => `<option value="${esc(c)}">`).join('');
      panel.querySelector('[data-mv-total]').textContent = list.length ? `Total : ${money(list.reduce((a, m) => a + m.montant, 0))}` : '';
      panel.querySelector('[data-mv-rows]').innerHTML = list.length
        ? list.map((m, i) => `<tr>
            <td>${esc(m.date.split('-').reverse().join('/'))}</td>
            <td><span class="mv-tag mv-tag--${isGlace(m) ? 'glace' : type}">${esc(m.categorie)}</span></td>
            <td class="mv-lib">${m.devis ? '<span class="mv-tag mv-tag--devis">Devis</span> ' : ''}${esc(m.libelle)}${m.note ? `<br><small>${esc(m.note)}</small>` : ''}</td>
            <td class="num"><strong>${money(m.montant)}</strong></td>
            <td class="mv-btns"><button class="mv-btn" type="button" data-act="edit" data-i="${i}">Modifier</button><button class="row-del" type="button" data-act="del" data-i="${i}" aria-label="Supprimer" title="Supprimer"></button></td>
          </tr>`).join('')
        : `<tr><td colspan="5" class="mv-empty">Aucune ${noun} enregistrée sur cette période.</td></tr>`;
      const ro = !state.hasMv;
      form.querySelectorAll('input, button').forEach((el) => { el.disabled = ro; });
      if (ro) msg.textContent = 'Saisie indisponible : mettez à jour le script du registre (docs/DEPLOIEMENT.md § 3).';
    },
  };
}

/* ---------- Saisie : budget mensuel ---------- */

export function mountBudget(panel, ctx) {
  const now = new Date().getFullYear();
  panel.innerHTML = `
    <form class="mv-form frost" data-bud-form>
      <div class="bud-head">
        <div><h2 class="admin__h3">Budget mensuel</h2>
        <p class="admin-note">Facultatif. Renseignez vos objectifs de ventes et vos dépenses prévues : le tableau de bord compare alors le réel au budget (recettes, dépenses et marge). Laissez vide les mois sans budget.</p></div>
        <div class="field"><label for="bud-year">Année</label><select class="select" id="bud-year" name="annee">${[now - 1, now, now + 1].map((y) => `<option${y === now ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table admin-table--bud">
          <thead><tr><th scope="col">Mois</th><th scope="col" class="num">Budget des ventes</th><th scope="col" class="num">Budget des dépenses</th><th scope="col" class="num">Résultat prévu</th><th scope="col" class="num">Marge prévue</th></tr></thead>
          <tbody data-bud-rows></tbody>
          <tfoot data-bud-foot></tfoot>
        </table>
      </div>
      <div class="mv-actions">
        <button class="btn btn--sm" type="submit"><span data-label>Enregistrer le budget</span></button>
        <button class="btn btn--glass btn--sm" type="button" data-bud-copy>Recopier janvier sur toute l’année</button>
        <p class="admin-note" data-bud-msg role="status"></p>
      </div>
    </form>`;
  const form = panel.querySelector('[data-bud-form]');
  const msg = panel.querySelector('[data-bud-msg]');
  const tbody = panel.querySelector('[data-bud-rows]');
  let budgets = [];

  const val = (el) => Math.max(0, Math.round(Number(el.value) || 0));
  function totalsRow() {
    let v = 0;
    let d = 0;
    tbody.querySelectorAll('tr').forEach((tr) => {
      const a = val(tr.querySelector('[data-k="ventes"]'));
      const b = val(tr.querySelector('[data-k="depenses"]'));
      v += a; d += b;
      tr.querySelector('[data-res]').textContent = a || b ? signed(a - b) : '—';
      tr.querySelector('[data-res]').classList.toggle('is-neg', a - b < 0);
      tr.querySelector('[data-mg]').textContent = a ? pct(((a - b) / a) * 100) : '—';
    });
    panel.querySelector('[data-bud-foot]').innerHTML = `<tr><th scope="row">Total ${form.annee.value}</th><td class="num">${money(v)}</td><td class="num">${money(d)}</td><td class="num ${v - d < 0 ? 'is-neg' : ''}">${signed(v - d)}</td><td class="num">${v ? pct(((v - d) / v) * 100) : '—'}</td></tr>`;
  }
  function fill() {
    const y = form.annee.value;
    const map = new Map(budgets.map((b) => [b.mois, b]));
    tbody.innerHTML = MONTHS.map((m, i) => {
      const k = `${y}-${String(i + 1).padStart(2, '0')}`;
      const b = map.get(k) || {};
      const inp = (f, v) => `<input class="input input--num" type="number" inputmode="numeric" min="0" step="1000" data-k="${f}" data-m="${k}" value="${v || ''}" aria-label="${f === 'ventes' ? 'Budget des ventes' : 'Budget des dépenses'} ${m} ${y}" placeholder="—">`;
      return `<tr><th scope="row">${m[0].toUpperCase()}${m.slice(1)}</th><td class="num">${inp('ventes', b.ventes)}</td><td class="num">${inp('depenses', b.depenses)}</td><td class="num" data-res></td><td class="num" data-mg></td></tr>`;
    }).join('');
    totalsRow();
  }
  form.annee.addEventListener('change', fill);
  tbody.addEventListener('input', totalsRow);
  panel.querySelector('[data-bud-copy]').addEventListener('click', () => {
    const rows = [...tbody.querySelectorAll('tr')];
    for (const f of ['ventes', 'depenses']) {
      const v = rows[0].querySelector(`[data-k="${f}"]`).value;
      rows.forEach((tr) => { tr.querySelector(`[data-k="${f}"]`).value = v; });
    }
    totalsRow();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mois = [...tbody.querySelectorAll('tr')].map((tr) => ({
      mois: tr.querySelector('[data-k="ventes"]').dataset.m,
      ventes: val(tr.querySelector('[data-k="ventes"]')),
      depenses: val(tr.querySelector('[data-k="depenses"]')),
    }));
    const btn = e.submitter;
    btn.disabled = true;
    msg.textContent = 'Enregistrement…';
    try {
      const r = await ctx.post({ action: 'budget', mois });
      msg.textContent = r.ok ? `Budget ${form.annee.value} enregistré.` : r.erreur === 'code' ? 'Session expirée : reconnectez-vous.' : 'Enregistrement refusé.';
      if (r.ok) ctx.reload();
    } catch {
      msg.textContent = 'Registre injoignable. Réessayez dans un instant.';
    } finally { btn.disabled = false; }
  });

  return {
    update(state) {
      budgets = state.budgets || [];
      fill();
      const ro = !state.hasMv;
      form.querySelectorAll('input, button, select').forEach((el) => { el.disabled = ro; });
      if (ro) msg.textContent = 'Saisie indisponible : mettez à jour le script du registre (docs/DEPLOIEMENT.md § 3).';
    },
  };
}
