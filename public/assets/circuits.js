'use strict';
(() => {
  const section = document.getElementById('circuits');
  if (!section) return;
  const find = id => document.getElementById(id);
  const { prepare, filter, safeURL } = KartCircuits;
  const pageSize = 6;
  let tracks = [], results = [], page = 0, loading = false, loaded = false;
  let map = null, clusters = null, boundaries = null, geography = null, markers = new Map();
  const form = find('circuit-filters');
  const query = find('circuit-query');
  const region = find('circuit-region');
  const department = find('circuit-department');
  const dialog = find('circuit-dialog');
  const list = find('circuit-list');
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const typeLabel = track => track.is_indoor ? 'Indoor' : 'Outdoor';
  const options = () => ({query: query.value, region: region.value, department: department.value, type: form.elements['circuit-type'].value});
  function fillOptions(select, values, placeholder, selected = '') {
    select.replaceChildren(new Option(placeholder, ''));
    values.forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = values.some(([value]) => value === selected) ? selected : '';
  }
  function updateDepartments() {
    const choices = new Map(tracks.filter(track => !region.value || track.region === region.value).map(track => [track.department, `${track.department} — ${track.department_name}`]));
    if (!region.value && geography) geography.features.forEach(feature => { const code = feature.properties.code; if (code === '2A' || code === '2B') choices.set('20', '20 — Corse'); else choices.set(code, `${code} — ${feature.properties.nom}`); });
    fillOptions(department, [...choices].sort(([a], [b]) => a.localeCompare(b)), 'Tous les départements', department.value);
  }
  function link(label, url) {
    const href = safeURL(url);
    if (!href) return null;
    const anchor = node('a', label);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }
  function openDetails(track) {
    const details = find('circuit-detail');
    details.replaceChildren();
    details.append(node('p', `${track.department} — ${track.department_name}`, 'eyebrow'));
    const title = node('h2', track.name); title.id = 'circuit-detail-title'; details.append(title);
    details.append(node('p', [track.address, `${track.postal_code} ${track.city}`].filter(Boolean).join(' · '), 'circuit-detail-location'));
    const tags = node('div', null, 'circuit-detail-tags');
    [typeLabel(track), track.length_m ? `${track.length_m} m de piste` : null, track.kart_power].filter(Boolean).forEach(label => tags.append(node('span', label)));
    details.append(tags);
    if (track.description) details.append(node('p', track.description));
    if (track.location_approx) details.append(node('p', 'Position approximative : vérifie l’adresse auprès du circuit avant le départ.', 'circuit-detail-approx'));
    const actions = node('div', null, 'circuit-detail-actions');
    // An address-based route is preferable to an approximate imported coordinate.
    const destination = `${track.name}, ${track.address || ''}, ${track.postal_code} ${track.city}, France`;
    actions.append(link('Itinéraire ↗', 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination)));
    [link('Site du circuit ↗', track.website), link('Réserver ↗', track.booking_url)].filter(Boolean).forEach(anchor => actions.append(anchor));
    if (track.phone) {
      const phone = node('a', `Appeler : ${track.phone}`);
      const number = track.phone.replace(/[^\d+]/g, '');
      if (/^\+?\d{6,15}$/.test(number)) { phone.href = 'tel:' + number; actions.append(phone); }
    }
    if (map && markers.has(track.id)) {
      const showMap = node('button', 'Voir sur la carte'); showMap.type = 'button';
      showMap.addEventListener('click', () => {
        dialog.close();
        find('circuit-map').scrollIntoView({block: 'center', behavior: 'auto'});
        const marker = markers.get(track.id);
        if (marker) clusters.zoomToShowLayer(marker, () => { marker.openPopup(); marker.getElement()?.focus(); });
      });
      actions.append(showMap);
    }
    details.append(actions, node('p', 'Informations issues de l’annuaire Kart Rivals. Horaires, tarifs et conditions à confirmer directement auprès du circuit.', 'circuit-detail-note'));
    dialog.showModal();
  }
  function renderList() {
    list.replaceChildren();
    const totalPages = Math.ceil(results.length / pageSize);
    page = Math.min(page, Math.max(0, totalPages - 1));
    find('circuit-pagination').hidden = results.length <= pageSize;
    find('circuits-previous').disabled = page === 0;
    find('circuits-next').disabled = page + 1 >= totalPages;
    find('circuits-page').textContent = `Page ${page + 1} / ${totalPages}`;
    find('circuit-count').textContent = `${results.length} circuit${results.length === 1 ? '' : 's'} trouvé${results.length === 1 ? '' : 's'}` + (results.length ? ` · ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, results.length)} dans la liste` : '');
    if (!results.length) {
      const empty = node('div', null, 'circuit-empty');
      empty.append(node('h3', 'PAS DE PISTE ICI. POUR L’INSTANT.'), node('p', 'Essaie une autre ville, un département voisin ou retire un filtre.'));
      const reset = node('button', 'Afficher tous les circuits'); reset.type = 'button'; reset.addEventListener('click', resetFilters); empty.append(reset); list.append(empty); return;
    }
    results.slice(page * pageSize, (page + 1) * pageSize).forEach(track => {
      const row = node('button', null, 'circuit-row' + (track.is_indoor ? '' : ' outdoor')); row.type = 'button';
      row.setAttribute('aria-label', `Voir la fiche de ${track.name}, ${track.city}`);
      const bar = node('span'); bar.setAttribute('aria-hidden', 'true');
      const text = node('span'); text.append(node('strong', track.name), node('small', `${track.city} (${track.department}) · ${typeLabel(track)}${track.length_m ? ' · ' + track.length_m + ' m' : ''}`));
      const arrow = node('span', '↗'); arrow.setAttribute('aria-hidden', 'true');
      row.append(bar, text, arrow); row.addEventListener('click', () => openDetails(track)); list.append(row);
    });
  }
  function fitMap() {
    if (!map) return;
    if (results.length) map.fitBounds(results.map(track => [track.lat, track.lng]), {padding: [30, 30], maxZoom: 10, animate: false});
    else {
      const selected = boundaries?.getLayers().filter(layer => layer.feature.properties.code === department.value || (department.value === '20' && ['2A','2B'].includes(layer.feature.properties.code)));
      if (selected?.length) map.fitBounds(L.featureGroup(selected).getBounds(), {padding:[30,30],maxZoom:9,animate:false});
      else map.setView([46.6, 2.5], 5, {animate: false});
    }
  }
  function renderMap() {
    if (!map) return;
    map.closePopup(); clusters.clearLayers(); markers.clear();
    if (boundaries) boundaries.setStyle(feature => ({fillColor: department.value === feature.properties.code ? '#435323' : '#293440', color: '#63717b', weight: department.value === feature.properties.code ? 2 : 0.7, fillOpacity: 1}));
    results.forEach(track => {
      const marker = L.marker([track.lat, track.lng], {title: `${track.name} — ${track.city}`, alt: track.name,
        icon: L.divIcon({className: 'circuit-marker' + (track.is_indoor ? '' : ' outdoor'), iconSize: [24, 24], iconAnchor: [12, 12]})});
      const popup = node('div', null, 'map-popup');
      popup.append(node('strong', track.name), node('p', `${track.city} (${track.department}) · ${typeLabel(track)}`));
      if (track.location_approx) popup.append(node('p', 'Position approximative'));
      const button = node('button', 'Découvrir le circuit ↗'); button.type = 'button'; button.addEventListener('click', () => openDetails(track)); popup.append(button);
      marker.bindPopup(popup, {maxWidth: 260, minWidth: 190});
      markers.set(track.id, marker); clusters.addLayer(marker);
    });
    fitMap();
  }
  function initMap() {
    if (map) return;
    try {
      if (!window.L || !L.markerClusterGroup) throw new Error('Map library unavailable');
      map = L.map('circuit-map', {scrollWheelZoom: false, minZoom: 3, maxZoom: 12, zoomSnap: 0.5, maxBounds: [[38,-12],[55,15]], maxBoundsViscosity: 0.8});
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      map.zoomControl.remove();
      L.control.zoom({zoomInTitle:'Zoomer',zoomOutTitle:'Dézoomer'}).addTo(map);
      if (geography) {
        boundaries = L.geoJSON(geography, {style: {color: '#63717b', weight: 0.7, fillColor:'#293440', fillOpacity:1},
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(() => node('span', `${feature.properties.code} — ${feature.properties.nom}`), {sticky:true});
            layer.on('click', () => {
              const code = feature.properties.code.startsWith('2') && /[AB]/.test(feature.properties.code) ? '20' : feature.properties.code;
              // Clear incompatible region/query when selecting a department geographically.
              region.value = ''; query.value = ''; updateDepartments();
              if ([...department.options].some(option => option.value === code)) { department.value = code; refresh(); }

            });
          }}).addTo(map);
        map.attributionControl.addAttribution('<a href="https://github.com/gregoiredavid/france-geojson" target="_blank" rel="noopener">IGN / France GeoJSON</a> · Licence ouverte');
      } else {
        find('map-status').hidden = false;
        find('map-status').textContent = 'Contours indisponibles. Les positions et les fiches restent accessibles.';
      }
      clusters = L.markerClusterGroup({maxClusterRadius: 45, showCoverageOnHover: false, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
        iconCreateFunction: cluster => L.divIcon({html: `<span>${cluster.getChildCount()}</span>`, className: 'circuit-cluster', iconSize: [43,43]})});
      map.addLayer(clusters);
      if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({pan:false})).observe(find('circuit-map'));
    } catch (_) {
      map = null;
      find('map-status').hidden = false;
      find('map-status').textContent = 'La carte est indisponible. Retrouve tous les circuits dans la liste.';
      find('map-fit').disabled = true;
    }
  }
  function refresh() { if (!loaded) return; page = 0; results = filter(tracks, options()); renderList(); renderMap(); }
  function resetFilters() { form.reset(); updateDepartments(); refresh(); }
  async function load() {
    if (loading || loaded) return;
    loading = true; find('circuit-error').hidden = true; find('circuit-count').textContent = 'Chargement des circuits…';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('data/circuits.json', {signal:controller.signal});
      if (!response.ok) throw new Error('Data unavailable');
      tracks = prepare((await response.json()).tracks);
      try { const geo = await fetch('data/departments.geojson', {signal:controller.signal}); if (geo.ok) geography = await geo.json(); } catch (_) { /* Circuit search remains available if the geographic background fails. */ }
      fillOptions(region, [...new Set(tracks.map(track => track.region))].sort((a,b) => a.localeCompare(b,'fr')).map(name => [name,name]), 'Toute la France', region.value);
      updateDepartments(); loaded = true; initMap(); refresh();
    } catch (_) { find('circuit-error').hidden = false; find('circuit-count').textContent = 'Annuaire momentanément indisponible'; }
    finally { clearTimeout(timeout); loading = false; }
  }
  let timer;
  query.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 220); });
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); refresh(); });
  region.addEventListener('change', () => { updateDepartments(); refresh(); });
  department.addEventListener('change', refresh);
  form.querySelectorAll('[name=circuit-type]').forEach(input => input.addEventListener('change', refresh));
  find('circuit-reset').addEventListener('click', resetFilters);
  find('circuit-retry').addEventListener('click', load);
  find('map-fit').addEventListener('click', fitMap);
  find('circuits-previous').addEventListener('click', () => { page--; renderList(); });
  find('circuits-next').addEventListener('click', () => { page++; renderList(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, {rootMargin:'300px'});
    observer.observe(section);
  } else load();
})();
