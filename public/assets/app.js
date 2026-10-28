'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
$('#year').textContent = String(new Date().getFullYear());
const menu = $('.menu-toggle');
const navigation = $('#navigation');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Ouvrir le menu'); navigation.classList.remove('open'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu'); navigation.classList.toggle('open', open); });
$$('a', navigation).forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.nav-wrap')) closeMenu(); });

const screens = {
  circuits: { file: 'circuits.webp', number: '02 / CIRCUITS', alt: 'Carte et annuaire des circuits de karting dans l’application Kart Rivals.', description: 'Circuits — ta prochaine session commence ici.' },
  paddock: { file: 'paddock.webp', number: '01 / PADDOCK', alt: 'Licence pilote Kart Rivals : cote ELO, rang et accès aux défis.', description: 'Paddock — ton pilote, ta stratégie, ta progression.' },
  defis: { file: 'defis.webp', number: '03 / DÉFIS', alt: 'Écran Défis de Kart Rivals : organiser une course et Time Attack solo.', description: 'Défis — un duel, une course ou ton prochain record.' },
  actu: { file: 'actu.webp', number: '04 / ACTUALITÉ', alt: 'Fil d’actualité Kart Rivals avec un chrono certifié de 43,605 secondes.', description: 'Actualité — les performances du paddock en direct.' }
};
const screenTabs = $$('.screen-tab');
screenTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    const screen = screens[tab.dataset.screen];
    screenTabs.forEach(item => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
    const image = $('#app-screen');
    image.src = 'assets/' + screen.file;
    image.alt = screen.alt;
    $('#screen-number').textContent = screen.number;
    $('#screen-description').textContent = screen.description;
    $('#screen-panel').setAttribute('aria-labelledby', tab.id);
  });
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % screenTabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + screenTabs.length) % screenTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = screenTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); screenTabs[next].focus(); screenTabs[next].click(); }
  });
});

const ranks = [
  ['NOVICE', 'I', '#8A93A3', '1 000 ELO au départ. Ta licence est prête. À toi d’écrire la première ligne.'],
  ['BRONZE', 'II', '#CD7F32', 'Les premiers duels, les premiers points. Ta place sur la grille se construit.'],
  ['ARGENT', 'III', '#C0C7D1', 'Tu gagnes en régularité. Chaque rival devient une nouvelle occasion de progresser.'],
  ['OR', 'IV', '#FFC83D', 'La compétition prend une autre dimension. Ton classement parle pour toi.'],
  ['PLATINE', 'V', '#4FE3D6', 'Une nouvelle étape dans ta progression. La prochaine rivalité t’attend.'],
  ['DIAMANT', 'VI', '#5AA9FF', 'La dernière ligne droite vers le sommet. Rien ne remplace la performance en piste.'],
  ['LÉGENDE', 'VII', '#FF6B1A', 'Le sommet de la grille. Un rang à défendre, course après course.']
];
$$('[data-rank]').forEach(button => button.addEventListener('click', () => {
  const rank = ranks[Number(button.dataset.rank)];
  $$('[data-rank]').forEach(item => { const active = item === button; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active)); });
  $('#rank-title').textContent = rank[0];
  $('#rank-description').textContent = rank[3];
  $('#rank-emblem > span').textContent = rank[1];
  $('.rank-watermark').textContent = rank[1];
  $('.rank-display').style.setProperty('--rank-color', rank[2]);
}));

$('#region').addEventListener('change', event => {
  const select = event.target;
  const all = select.value === 'all';
  const label = select.options[select.selectedIndex].text;
  $('#map-region').textContent = label.toLocaleUpperCase('fr');
  $('#region-note').textContent = all ? 'Retrouve l’annuaire complet et les circuits à proximité dans l’application.' : label + ' : retrouve les circuits, les infos pratiques et les pilotes de la région dans l’application.';
  $$('[data-pin]').forEach(pin => { pin.classList.toggle('active', pin.dataset.pin === select.value); pin.classList.toggle('inactive', !all && pin.dataset.pin !== select.value); });
});

$$('[data-store]').forEach(button => button.addEventListener('click', () => {
  const apple = button.dataset.store === 'apple';
  const config = window.KART_RIVALS || {};
  const url = apple ? config.appStoreUrl : config.googlePlayUrl;
  if (url) {
    try { const target = new URL(url); const domain = apple ? 'apps.apple.com' : 'play.google.com'; if (target.protocol === 'https:' && target.hostname === domain) { window.location.assign(target.href); return; } } catch (_) { /* Keep the honest unavailable state for invalid URLs. */ }
  }
  $('#store-title').textContent = apple ? 'RENDEZ-VOUS SUR IOS.' : 'RENDEZ-VOUS SUR ANDROID.';
  $('#store-message').textContent = 'Le lien officiel ' + (apple ? 'App Store' : 'Google Play') + ' sera disponible ici prochainement. Une question sur la disponibilité ? Écris-nous.';
  $('#store-dialog').showModal();
}));
$$('[data-dialog]').forEach(button => button.addEventListener('click', () => $('#' + button.dataset.dialog + '-dialog').showModal()));
$$('dialog').forEach(dialog => {
  $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
});
