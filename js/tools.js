/* =========================================================
   tools.js — Steuerung der Tool-Modals
   ---------------------------------------------------------
   Öffnet/schließt das Modal, ruft das jeweilige Tool auf und
   verwaltet das Info-Panel mit der Erklärung zum Verfahren.

   Die einzelnen Tools liegen in  js/tools/*.js  und
   registrieren sich selbst über  window.TOOLS[name] = renderFn.

   NEUES TOOL HINZUFÜGEN:
   1. Datei anlegen: js/tools/mein-tool.js
      -> darin:  window.TOOLS['meintool'] = function(body, title){ ... }
      -> optional die Erklärung:
         window.TOOLS['meintool'].doc = { de: `<h4>…</h4><p>…</p>`, en: `…` };
   2. In index.html das <script> einbinden.
   3. In index.html eine .tool-Karte mit onclick="openTool('meintool')"
   ========================================================= */

window.TOOLS = window.TOOLS || {};

const _mb        = () => document.getElementById('mb');
const _mTitle    = () => document.getElementById('mTitle');
const _mBody     = () => document.getElementById('mBody');
const _mInfo     = () => document.getElementById('mInfo');
const _mInfoWrap = () => document.getElementById('mInfoPanel');
const _mInfoBody = () => document.getElementById('mInfoBody');

/* Sprachhelfer für die Tools */
window.isDE = () => (window.lang || 'de') === 'de';

let _openTool = null;

function openTool(name){
  const render = window.TOOLS[name];
  if(!render){ console.warn('Tool nicht gefunden:', name); return; }
  _openTool = name;

  _mb().classList.add('show');
  document.body.style.overflow = 'hidden';
  closeInfo();
  render(_mBody(), _mTitle());

  // Info-Button nur zeigen, wenn das Tool eine Erklärung mitbringt.
  const doc = render.doc;
  const btn = _mInfo();
  if(btn){
    btn.style.display = doc ? 'flex' : 'none';
    if(doc){
      btn.title = window.isDE() ? 'Wie funktioniert das?' : 'How does it work?';
      _mInfoBody().innerHTML = window.isDE() ? doc.de : (doc.en || doc.de);
    }
  }
}

function closeTool(){
  _mb().classList.remove('show');
  document.body.style.overflow = '';
  closeInfo();
  _openTool = null;
}

function toggleInfo(){
  const wrap = _mInfoWrap();
  if(!wrap) return;
  const on = wrap.classList.toggle('show');
  _mInfo().classList.toggle('active', on);
  // Das Panel liegt über dem Tool-Inhalt. Ist das Modal gerade sehr flach
  // (z. B. weil noch kein Bild geladen ist), bekommt es solange eine feste
  // Höhe, damit der Text nicht auf ein paar Zeilen zusammengedrückt wird.
  wrap.closest('.modal').classList.toggle('info-open', on);
}

function closeInfo(){
  const wrap = _mInfoWrap();
  if(wrap){
    wrap.classList.remove('show');
    wrap.closest('.modal').classList.remove('info-open');
  }
  const btn = _mInfo();
  if(btn) btn.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const mb = _mb();
  if(mb) mb.onclick = e => { if(e.target === mb) closeTool(); };
  const info = _mInfo();
  if(info) info.onclick = toggleInfo;
  const back = document.getElementById('mInfoBack');
  if(back) back.onclick = closeInfo;
  addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    // Erst das Info-Panel schließen, dann das Tool.
    const wrap = _mInfoWrap();
    if(wrap && wrap.classList.contains('show')) closeInfo();
    else closeTool();
  });
});
