'use strict';
(() => {
  const form = document.getElementById('partner-form');
  if (!form) return;
  const type = document.getElementById('partner-type');
  const message = document.getElementById('partner-message');
  const status = document.getElementById('partner-status');
  const submit = document.getElementById('partner-submit');
  let busy = false;
  type.addEventListener('change', () => {
    message.placeholder = type.value === 'update' ? 'Indiquez la fiche concernée et les changements souhaités : adresse, horaires, contacts, informations de piste…' : 'Présentez votre circuit et le partenariat envisagé.';
  });
  function announce(text, error = false) {
    status.textContent = text; status.hidden = false;
    status.classList.toggle('error', error); status.focus();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true; submit.disabled = true; submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'ENVOI EN COURS…'; status.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const sessionResponse = await fetch('api/contact.php', {cache:'no-store', signal:controller.signal});
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.csrf) throw new Error(session.error || 'Le formulaire est momentanément indisponible. Écrivez à contact@kartrivals.fr.');
      const payload = Object.fromEntries(new FormData(form)); payload.csrf = session.csrf;
      const response = await fetch('api/contact.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal});
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'La demande n’a pas pu être envoyée. Réessayez ou écrivez à contact@kartrivals.fr.');
      form.reset();
      announce(`Merci ! Votre demande a été transmise à l’équipe Kart Rivals. Référence : ${result.reference}. Nous vous répondrons à l’adresse e-mail indiquée après examen de votre demande.`);
    } catch (error) {
      const text = error.name === 'AbortError' ? 'La réponse du serveur tarde. L’envoi a peut-être abouti : vous pouvez réessayer, les doublons récents sont évités, ou écrire à contact@kartrivals.fr.' : (error instanceof SyntaxError || error instanceof TypeError ? 'Connexion impossible. Vos informations restent dans le formulaire. Réessayez ou écrivez à contact@kartrivals.fr.' : error.message);
      announce(text, true);
    } finally {
      clearTimeout(timeout); busy = false; submit.disabled = false; submit.removeAttribute('aria-busy');
      submit.replaceChildren(document.createTextNode('ENVOYER MA DEMANDE '));
      const arrow = document.createElement('span'); arrow.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;width:1em;height:1em;vertical-align:-.12em;flex-shrink:0"><path d="M7 17 17 7M7 7h10v10"/></svg>'; arrow.setAttribute('aria-hidden','true'); submit.append(arrow);
    }
  });
})();
