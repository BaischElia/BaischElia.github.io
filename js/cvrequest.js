/* =========================================================
   cvrequest.js — „Lebenslauf anfragen“
   ---------------------------------------------------------
   Kleines Formular im Modal. Die Anfrage wird über FormSubmit
   (formsubmit.co) als E-Mail an CV_INBOX geschickt — ganz ohne
   eigenen Server, passend für GitHub Pages.

   Beim allerersten Absenden schickt FormSubmit einmalig eine
   Bestätigungs-Mail an CV_INBOX. Erst nach Klick auf
   „Activate Form“ kommen die Anfragen an.
   ========================================================= */

const CV_INBOX = 'baischelia@gmx.de';
const CV_ENDPOINT = 'https://formsubmit.co/ajax/' + CV_INBOX;

const _cv = id => document.getElementById(id);
const _cvDE = () => (window.lang || 'de') === 'de';

function openCvRequest(){
  const mb = _cv('cvMb');
  if(!mb) return;
  // Bei jedem Öffnen frisch starten (außer ein Text wurde schon getippt)
  if(_cv('cvDone').hidden === false) resetCvForm();
  mb.classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(()=> _cv('cvName') && _cv('cvName').focus(), 80);
}

function closeCvRequest(){
  const mb = _cv('cvMb');
  if(!mb) return;
  mb.classList.remove('show');
  document.body.style.overflow = '';
}

function resetCvForm(){
  _cv('cvForm').reset();
  _cv('cvForm').hidden = false;
  _cv('cvDone').hidden = true;
  _cv('cvErr').hidden = true;
}

async function sendCvRequest(e){
  e.preventDefault();
  const form = _cv('cvForm');
  const btn  = _cv('cvSend');
  const err  = _cv('cvErr');
  err.hidden = true;

  // Pflichtfelder prüfen, Browser zeigt die Hinweise selbst an
  if(!form.reportValidity()) return;

  // Unsichtbares Feld: füllen nur Bots aus
  if(_cv('cvHoney').value) return;

  const data = {
    Name:        _cv('cvName').value.trim(),
    Unternehmen: _cv('cvCompany').value.trim() || '—',
    'E-Mail':    _cv('cvEmail').value.trim(),
    Nachricht:   _cv('cvMsg').value.trim() || '—',
    _subject:    'Lebenslauf-Anfrage von ' + _cv('cvName').value.trim(),
    _replyto:    _cv('cvEmail').value.trim(),
    _template:   'table'
  };

  btn.disabled = true;
  const label = btn.querySelector('span');
  const before = label.textContent;
  label.textContent = _cvDE() ? 'Wird gesendet …' : 'Sending …';

  try{
    const res = await fetch(CV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    const out = await res.json().catch(()=> ({}));
    if(!res.ok || out.success === 'false' || out.success === false) throw new Error(out.message || res.status);
    form.hidden = true;
    _cv('cvDone').hidden = false;
  } catch(ex){
    console.warn('Lebenslauf-Anfrage fehlgeschlagen:', ex);
    err.hidden = false;
  } finally {
    btn.disabled = false;
    label.textContent = before;
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const mb = _cv('cvMb');
  if(!mb) return;
  mb.addEventListener('click', e=>{ if(e.target === mb) closeCvRequest(); });
  addEventListener('keydown', e=>{ if(e.key === 'Escape' && mb.classList.contains('show')) closeCvRequest(); });
  _cv('cvForm').addEventListener('submit', sendCvRequest);
});
