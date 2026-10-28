/* =========================================================
   contact.js — E-Mail-Links und „Kopieren“
   ---------------------------------------------------------
   Kein Formular, kein fremder Dienst: Die Buttons öffnen das
   Mailprogramm des Besuchers mit einer vorbereiteten Mail.
   Der Text folgt der eingestellten Sprache (DE/EN).
   ========================================================= */

const MAIL_TO = 'baischelia@gmx.de';

const CV_MAIL = {
  de: {
    subject: 'Lebenslauf-Anfrage',
    body: 'Hallo Elia,\n\nich würde gern deinen Lebenslauf erhalten.\n\nName:\nUnternehmen:\nWofür (z. B. Stelle):\n\nViele Grüße'
  },
  en: {
    subject: 'CV request',
    body: 'Hi Elia,\n\nI would like to receive your CV.\n\nName:\nCompany:\nWhat for (e.g. position):\n\nBest regards'
  }
};

function mailHref(to, subject, body){
  return 'mailto:' + to +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
}

/* Link für „Lebenslauf anfragen“ in der aktuellen Sprache setzen */
function updateMailLinks(){
  const a = document.getElementById('cvMail');
  if(!a) return;
  const t = CV_MAIL[(window.lang || 'de') === 'de' ? 'de' : 'en'];
  a.href = mailHref(MAIL_TO, t.subject, t.body);
}

/* E-Mail-Adresse in die Zwischenablage kopieren */
async function copyMail(){
  const btn = document.getElementById('copyMail');
  const label = btn && btn.querySelector('span');
  const de = (window.lang || 'de') === 'de';
  let ok = false;
  try{
    await navigator.clipboard.writeText(MAIL_TO);
    ok = true;
  } catch(e){
    // Fallback für ältere Browser: Text kurz markieren und kopieren
    const tmp = document.createElement('textarea');
    tmp.value = MAIL_TO; tmp.setAttribute('readonly', '');
    tmp.style.position = 'fixed'; tmp.style.opacity = '0';
    document.body.appendChild(tmp); tmp.select();
    try{ ok = document.execCommand('copy'); } catch(_){}
    tmp.remove();
  }
  if(!label) return;
  label.textContent = ok ? (de ? 'Kopiert' : 'Copied') : (de ? 'Nicht möglich' : 'Not possible');
  btn.classList.toggle('done', ok);
  clearTimeout(copyMail._t);
  copyMail._t = setTimeout(()=>{
    // Sprache erst jetzt abfragen, falls sie inzwischen umgestellt wurde
    label.textContent = (window.lang || 'de') === 'de' ? 'Kopieren' : 'Copy';
    btn.classList.remove('done');
  }, 2000);
}

/* Beim Sprachwechsel den Mailtext mitwechseln */
document.addEventListener('DOMContentLoaded', ()=>{
  updateMailLinks();
  if(typeof window.toggleLang === 'function'){
    const original = window.toggleLang;
    window.toggleLang = function(){ original(); updateMailLinks(); };
  }
});
