/* Pipeline Radar — demo portfolio (dataset fittizio, embedded in index.html) */

// Fixed reference date: dataset dates are relative to this, not to the real
// clock, so "Nuovo" badges and the "new" filter stay coherent indefinitely
// instead of draining as the calendar moves past the embedded detected_at dates.
const DEMO_TODAY = new Date('2026-07-23');

const STATE = {
  all: [],
  filtered: [],
  filter: 'all',
  type: '',
  sort: 'score',
  q: '',
};

const TIER_LABEL = { hot: 'da contattare', warm: 'da seguire', cold: 'bassa priorità' };

const TYPE_LABEL = {
  no_vendor: 'Senza fornitore',
  terminated: 'Ha rescisso contratto',
  trial: 'In prova',
  evaluating: 'In valutazione',
  renewal_soon: 'Rinnovo in scadenza',
  emerging: 'Prospect emergente',
};

const el  = (s, r=document) => r.querySelector(s);
const els = (s, r=document) => [...r.querySelectorAll(s)];
const safe = (v, f='—') => (v===null||v===undefined||v===''||v==='null') ? f : v;

document.addEventListener('DOMContentLoaded', init);

function init(){
  wireKeyShortcuts();
  wireControls();
  wireDrawer();

  // Deep-link from PWA shortcuts: ?filter=hot|no_vendor|smb|new
  const params = new URLSearchParams(location.search);
  const f = params.get('filter');
  if (f && ['all','hot','no_vendor','smb','new'].includes(f)) {
    STATE.filter = f;
  }

  STATE.all = (window.LEADS || []).map(decorate);

  paintCounters();
  els('.chip').forEach((c) => {
    c.classList.toggle('on', c.dataset.f === STATE.filter);
  });
  applyFilter();
}

/* ============ DECORATE ============ */

function decorate(o){
  const exp = o.renewal_date ? new Date(o.renewal_date) : null;
  const today = DEMO_TODAY;
  let days = null;
  if (exp && !isNaN(exp.getTime())) {
    days = Math.round((exp - today) / 86400000);
  }
  const isNoVendor = o.lead_type === 'no_vendor';
  let urgency;
  if (isNoVendor) {
    const dwv = o.days_without_vendor || 0;
    if (dwv === 0) urgency = 'critical';
    else if (dwv <= 14) urgency = 'high';
    else if (dwv <= 45) urgency = 'warm';
    else urgency = 'cold';
  } else if (days === null) {
    urgency = 'cold';
  } else if (days < 0) urgency = 'cold';
  else if (days <= 90)  urgency = 'critical';
  else if (days <= 180) urgency = 'high';
  else if (days <= 365) urgency = 'warm';
  else urgency = 'cold';

  const s = o.priority_score || 0;
  let tier = 'cold';
  if (s >= 70) tier = 'hot';
  else if (s >= 57) tier = 'warm';

  return { ...o, _days: days, _urgency: urgency, _tier: tier, _isNoVendor: isNoVendor };
}

/* ============ FILTER + SORT ============ */

function applyFilter(){
  let list = [...STATE.all];

  if (STATE.filter === 'hot')       list = list.filter(o=>o.priority_score>=70);
  else if (STATE.filter === 'smb')  list = list.filter(o=>o.team_size!=null && o.team_size<=50);
  else if (STATE.filter === 'no_vendor') list = list.filter(o=>o._isNoVendor);
  else if (STATE.filter === 'new'){
    const cutoff = DEMO_TODAY.getTime() - 14 * 86400000;
    list = list.filter(o => o.detected_at && new Date(o.detected_at).getTime() >= cutoff);
    list.sort((a,b)=>(b.detected_at||'').localeCompare(a.detected_at||''));
  }

  if (STATE.type) list = list.filter(o=>o.lead_type===STATE.type);

  if (STATE.q) {
    const q = STATE.q;
    list = list.filter(o =>
      (o.lead_name||'').toLowerCase().includes(q) ||
      (o.segment||'').toLowerCase().includes(q) ||
      (o.current_vendor||'').toLowerCase().includes(q) ||
      (o.region||'').toLowerCase().includes(q)
    );
  }

  if (STATE.sort==='score')        list.sort((a,b)=>b.priority_score-a.priority_score);
  else if (STATE.sort==='name')    list.sort((a,b)=>a.lead_name.localeCompare(b.lead_name));
  else if (STATE.sort==='date')    list.sort((a,b)=>(b.detected_at||'').localeCompare(a.detected_at||''));
  else if (STATE.sort==='urgency'){
    const rank = { critical:0, high:1, warm:2, cold:3 };
    list.sort((a,b)=> (rank[a._urgency]-rank[b._urgency]) || (b.priority_score-a.priority_score));
  }

  STATE.filtered = list;
  paintGrid();
  paintResultCount();
}

/* ============ COUNTERS ============ */

function paintCounters(){
  const all = STATE.all;
  const hot      = all.filter(o=>o.priority_score>=70).length;
  const noVendor = all.filter(o=>o._isNoVendor).length;
  const smb      = all.filter(o=>o.team_size!=null && o.team_size<=50).length;
  const cutoff14 = DEMO_TODAY.getTime() - 14 * 86400000;
  const newCt    = all.filter(o => o.detected_at && new Date(o.detected_at).getTime() >= cutoff14).length;

  el('#ctHot').textContent      = hot;
  el('#ctNoVendor').textContent = noVendor;
  el('#ctSmb').textContent      = smb;
  el('#ctAll').textContent      = all.length;

  const map = { all:all.length, hot, no_vendor:noVendor, smb, new:newCt };
  els('.chip .num').forEach(n=>{
    const k = n.dataset.ct;
    n.textContent = map[k] ?? 0;
  });
  el('#rtotal').textContent = all.length;
}

function paintResultCount(){
  el('#rcount').textContent = STATE.filtered.length;
}

/* ============ GRID ============ */

function paintGrid(){
  const g     = el('#grid');
  const empty = el('#empty');
  if (STATE.filtered.length === 0){
    g.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  g.innerHTML = STATE.filtered.map(card).join('');
  els('.card', g).forEach(c=>{
    c.addEventListener('click',  ()=>{ const o=STATE.all.find(x=>x.id===c.dataset.id); if(o) openDrawer(o); });
    c.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); const o=STATE.all.find(x=>x.id===c.dataset.id); if(o) openDrawer(o); }});
  });
}

function cardLine(o){
  const sit = TYPE_LABEL[o.lead_type] || '';
  if (o._isNoVendor) {
    const dwv = o.days_without_vendor || 0;
    const free = dwv === 0 ? 'appena rilevato' : `${dwv} gg senza fornitore`;
    return sit ? `${sit} · ${free}` : free;
  }
  if (o._days != null && o._days >= 0 && o._days <= 180) {
    return sit ? `${sit} · rinnovo tra ${o._days} gg` : `rinnovo tra ${o._days} gg`;
  }
  return sit || '—';
}

function card(o){
  const vendor = safe(o.current_vendor, 'Nessun fornitore');
  const team = o.team_size!=null ? `${o.team_size} persone` : '';
  const daysOld = o.detected_at ? Math.round((DEMO_TODAY.getTime() - new Date(o.detected_at)) / 86400000) : null;
  const isNew = daysOld !== null && daysOld <= 3;

  return `
<article class="card" data-id="${o.id}" data-urgency="${o._urgency}" data-tier="${o._tier}" tabindex="0" role="button" aria-label="${esc(o.lead_name)}, ${o.priority_score}">
  <span class="urgency"></span>
  <div class="card-head">
    <div class="name-block">
      <div class="name">${esc(o.lead_name)}${isNew ? ' <span class="tag new-signal">Nuovo</span>' : ''}</div>
      <div class="meta">
        ${[o.segment && `<span class="role">${esc(o.segment)}</span>`, team && `<span class="age">${team}</span>`, `<span class="club">${esc(vendor)}</span>`].filter(Boolean).join('<span class="sep">·</span>')}
      </div>
      <div class="meta card-line">${esc(cardLine(o))}</div>
    </div>
    <div class="score">${o.priority_score}<span class="dlabel">${TIER_LABEL[o._tier]||''}</span></div>
  </div>
</article>`;
}

function esc(s){ return String(s ?? '').replace(/[<>&"']/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

/* ============ DRAWER ============ */

function openDrawer(o){
  const brief = el('#brief');
  const vendor = safe(o.current_vendor, 'Nessun fornitore');
  const sit = TYPE_LABEL[o.lead_type] || o.lead_type || '—';

  el('#breadName').textContent = o.lead_name || '';

  const a = o.assessment || {};
  const yes = a.yes || [];
  const no  = a.no || [];
  const action = a.action
    || (o.priority_score >= 70 ? 'Da contattare ora'
       : o.priority_score >= 57 ? "Da tenere d'occhio"
       : 'Bassa priorità');

  const nums = [
    o.interactions != null && o.interactions > 0 && { v: o.interactions, l: 'Interazioni' },
    o.conversions != null && o.conversions > 0 && { v: o.conversions, l: 'Conversioni simili' },
    o.referrals != null && o.referrals > 0 && { v: o.referrals, l: 'Referral' },
    o.deal_value_formatted && { v: o.deal_value_formatted, l: 'Valore stimato' },
  ].filter(Boolean);

  const stripHtml = nums.length
    ? `<div class="strip">${nums.map(s=>`<div class="cell"><span class="v">${s.v}</span><span class="l">${s.l}</span></div>`).join('')}</div>`
    : '';

  const facts = [
    ['Situazione', sit],
    ['Fornitore attuale', vendor],
    o.team_size!=null && ['Team', `${o.team_size} persone`],
    o.segment && ['Segmento', o.segment],
    o.region && ['Area', o.region],
    o.channel && ['Canale', o.channel],
    o.owner && ['Owner', o.owner],
  ].filter(Boolean);

  const yesHtml = yes.length
    ? `<div class="assess yes"><div class="assess-h">Perché sì</div><ul class="why-list">${yes.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>`
    : '';
  const noHtml = no.length
    ? `<div class="assess no"><div class="assess-h">Perché no / attenzione</div><ul class="why-list">${no.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>`
    : '';

  brief.innerHTML = `
    <div class="brief-head">
      <div>
        <div class="name">${esc(o.lead_name)}</div>
        <div class="sub">
          ${[o.segment && esc(o.segment), o.team_size!=null && `${o.team_size} persone`, esc(vendor)].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div class="big-score ${o._tier}">${o.priority_score}<div class="pct">/100</div></div>
    </div>

    <div class="verdict-note" style="margin:12px 0 10px">
      <strong>${esc(action)}</strong>
    </div>
    ${yesHtml}
    ${noHtml}

    ${stripHtml}

    <div class="sect">
      <div class="sect-title">SCHEDA</div>
      <div class="meta-grid">
        ${facts.map(([k,v])=>`<div class="cell"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}
      </div>
    </div>
  `;

  el('#sourceLabel').textContent = o.source_label ? `Fonte: ${o.source_label}` : 'Fonte: n/d';

  el('#ov').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer(){
  el('#ov').classList.remove('open');
  document.body.style.overflow = '';
}

/* ============ CONTROLS ============ */

function wireControls(){
  el('#q').addEventListener('input', debounce(e=>{
    STATE.q = e.target.value.toLowerCase();
    applyFilter();
  }, 180));
  el('#filters').addEventListener('click', e=>{
    const c = e.target.closest('.chip');
    if (!c) return;
    els('.chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');
    STATE.filter = c.dataset.f;
    applyFilter();
  });
  el('#typeF').addEventListener('change',  e=>{ STATE.type = e.target.value; applyFilter(); });
  el('#sortBy').addEventListener('change', e=>{ STATE.sort = e.target.value; applyFilter(); });
}

function wireDrawer(){
  el('#closeBtn').addEventListener('click', closeDrawer);
  el('#ov').addEventListener('click', e=>{ if (e.target.id === 'ov') closeDrawer(); });
  document.addEventListener('keydown', e=>{ if (e.key === 'Escape') closeDrawer(); });
}

function wireKeyShortcuts(){
  document.addEventListener('keydown', e=>{
    if (e.key === '/' && document.activeElement !== el('#q')){
      e.preventDefault();
      el('#q').focus();
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !el('#ov').classList.contains('open')){
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const cards = els('.card');
      if (!cards.length) return;
      const idx = cards.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown'
        ? (cards[idx + 1] || cards[0])
        : (cards[idx - 1] || cards[cards.length - 1]);
      next.focus();
      e.preventDefault();
    }
  });
}

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
