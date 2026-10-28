'use strict';
// Shared by the browser and the small data/search regression suite.
(function (root) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'\-–—]/g, ' ').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
  const safeURL = value => {
    if (!value) return null;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch (_) { return null; }
  };
  function prepare(rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty circuit catalogue');
    const ids = new Set();
    return rows.map(track => {
      if (typeof track.id !== 'string' || ids.has(track.id) || typeof track.name !== 'string' || typeof track.city !== 'string' || !Number.isFinite(track.lat) || !Number.isFinite(track.lng) || Math.abs(track.lat) > 90 || Math.abs(track.lng) > 180 || typeof track.is_indoor !== 'boolean') throw new Error('Invalid circuit');
      ids.add(track.id);
      return { ...track, search: normalize([track.name, track.city, track.postal_code, track.department_name, track.region].join(' ')) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  function filter(tracks, { query = '', region = '', department = '', type = 'all' } = {}) {
    const q = normalize(query);
    return tracks.filter(track => (!region || track.region === region) && (!department || track.department === department) &&
      (type === 'all' || track.is_indoor === (type === 'indoor')) &&
      (!q || (/^\d{2}$/.test(q) ? track.department === q : q.split(' ').every(word => track.search.includes(word)))));
  }
  root.KartCircuits = Object.freeze({ normalize, safeURL, prepare, filter });
})(globalThis);
