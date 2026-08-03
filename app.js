'use strict';

const HISTORY_KEY = 'tracelens.history.v1';
const MAX_HISTORY = 12;
const toolMeta = {
  domain: { label: 'Domain Intel', icon: '◎' },
  ip: { label: 'IP Lookup', icon: '⌖' },
  hash: { label: 'Hash Lab', icon: '#' },
  file: { label: 'File Intel', icon: '▱' }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function setView(viewName, updateHash = true) {
  const target = $(`#view-${viewName}`) || $('#view-overview');
  $$('.view').forEach(view => view.classList.toggle('active', view === target));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === viewName));
  $('#viewTitle').textContent = target.dataset.title;
  $('#viewEyebrow').textContent = target.dataset.eyebrow;
  if (updateHash) history.replaceState(null, '', `#${viewName}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(type, target) {
  const historyItems = getHistory();
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  historyItems.unshift({ id, type, target, at: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems.slice(0, MAX_HISTORY)));
  renderHistory();
}

function renderHistory() {
  const items = getHistory();
  $('#analysisCount').textContent = String(items.length);
  const list = $('#historyList');
  if (!items.length) {
    list.innerHTML = '<div class="history-empty">Ingen analyser ennå</div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const meta = toolMeta[item.type] || toolMeta.domain;
    const date = new Date(item.at);
    return `<div class="history-item">
      <span class="history-icon">${meta.icon}</span>
      <div><strong>${escapeHtml(item.target)}</strong><small>${meta.label}</small></div>
      <span class="history-time">${date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>`;
  }).join('');
}

function setLoading(container, label = 'ANALYSERER') {
  container.className = 'result-area';
  container.innerHTML = `<div class="loading-state"><span class="loader"></span><span>${escapeHtml(label)}</span></div>`;
}

function setError(container, title, message) {
  container.className = 'result-area';
  container.innerHTML = `<div class="error-panel"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
}

function resultHeader(target) {
  return `<div class="result-header">
    <div class="result-target"><span>TARGET</span><h2>${escapeHtml(target)}</h2></div>
    <span class="result-status">COMPLETE</span>
  </div>`;
}

function dataCard(label, value, wide = false) {
  return `<div class="data-card${wide ? ' wide' : ''}"><span class="data-label">${escapeHtml(label)}</span><span class="data-value">${escapeHtml(value || '—')}</span></div>`;
}

function normalizeDomain(input) {
  const value = input.trim().toLowerCase();
  if (!value) throw new Error('Skriv inn et domene.');
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') throw new Error();
    return url.hostname.replace(/^www\./, '');
  } catch {
    throw new Error('Ugyldig domene. Eksempel: example.com');
  }
}

async function dnsQuery(domain, type) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`, {
    headers: { accept: 'application/dns-json' }
  });
  if (!response.ok) throw new Error(`DNS-tjenesten svarte med ${response.status}.`);
  return response.json();
}

async function analyzeDomain(domain) {
  const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
  const settled = await Promise.allSettled(types.map(type => dnsQuery(domain, type)));
  const groups = types.map((type, index) => {
    const result = settled[index];
    if (result.status !== 'fulfilled') return { type, records: [] };
    const answers = result.value.Answer || [];
    return {
      type,
      records: answers
        .filter(answer => answer.type !== 46)
        .map(answer => ({ ttl: answer.TTL, value: String(answer.data || '').replace(/\.$/, '') }))
    };
  });
  const total = groups.reduce((sum, group) => sum + group.records.length, 0);
  return { groups, total };
}

function renderDomainResult(container, domain, analysis) {
  const populated = analysis.groups.filter(group => group.records.length);
  container.className = 'result-area';
  container.innerHTML = resultHeader(domain) + `<div class="result-grid">
    ${dataCard('DNS records', String(analysis.total))}
    ${dataCard('Record types', String(populated.length))}
    ${dataCard('IPv4', populated.find(group => group.type === 'A')?.records.map(record => record.value).join(', ') || 'Ingen', true)}
  </div>` + populated.map(group => `<div class="record-group">
    <div class="record-group-title"><span>${group.type}</span> ${group.records.length} funnet</div>
    <div class="record-table">${group.records.map(record => `<div class="record-row"><span class="record-type">TTL ${record.ttl}</span><span class="record-value">${escapeHtml(record.value)}</span></div>`).join('')}</div>
  </div>`).join('');
}

function isValidIp(value) {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){1,7}|:):(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?)$/;
  return ipv4.test(value) || ipv6.test(value);
}

async function lookupIp(ip) {
  const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!response.ok) throw new Error(`Oppslagstjenesten svarte med ${response.status}.`);
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'Fant ikke IP-adressen.');
  return data;
}

function renderIpResult(container, ip, data) {
  const coordinates = [data.latitude, data.longitude].every(value => typeof value === 'number')
    ? `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}` : '—';
  container.className = 'result-area';
  container.innerHTML = resultHeader(ip) + `<div class="result-grid">
    ${dataCard('Land', [data.flag?.emoji, data.country].filter(Boolean).join(' '))}
    ${dataCard('By / region', [data.city, data.region].filter(Boolean).join(', '))}
    ${dataCard('ISP', data.connection?.isp)}
    ${dataCard('ASN', data.connection?.asn ? `AS${data.connection.asn}` : '—')}
    ${dataCard('Organisasjon', data.connection?.org)}
    ${dataCard('Type', data.type?.toUpperCase())}
    ${dataCard('Koordinater', coordinates)}
    ${dataCard('Tidssone', data.timezone?.id)}
    ${dataCard('Reverse / domene', data.connection?.domain || '—', true)}
  </div>`;
}

async function digest(buffer, algorithm) {
  const value = await crypto.subtle.digest(algorithm, buffer);
  return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function makeHashes(buffer) {
  const [sha256, sha1, sha384] = await Promise.all([
    digest(buffer, 'SHA-256'),
    digest(buffer, 'SHA-1'),
    digest(buffer, 'SHA-384')
  ]);
  return { sha256, sha1, sha384 };
}

function renderHashResult(container, target, hashes, size) {
  container.className = 'result-area';
  const rows = [['SHA-256', hashes.sha256], ['SHA-384', hashes.sha384], ['SHA-1', hashes.sha1]];
  container.innerHTML = resultHeader(target) + `<div class="result-grid">${dataCard('Datamengde', formatBytes(size))}${dataCard('Algoritmer', '3')}</div>
  <div class="record-group"><div class="record-group-title"><span>#</span> Fingeravtrykk</div><div class="hash-list">
    ${rows.map(([label, value]) => `<div class="hash-row"><span>${label}</span><code>${value}</code><button class="copy-button" type="button" data-copy="${value}" aria-label="Kopier ${label}">⧉</button></div>`).join('')}
  </div></div>`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function readAscii(view, offset, length) {
  let result = '';
  for (let i = 0; i < length; i += 1) result += String.fromCharCode(view.getUint8(offset + i));
  return result;
}

function parseExif(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return {};
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xFFE1) {
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 8 || readAscii(view, offset + 2, 4) !== 'Exif') return {};
      const tiff = offset + 8;
      if (tiff + 8 > view.byteLength) return {};
      const little = view.getUint16(tiff, false) === 0x4949;
      const get16 = pos => view.getUint16(pos, little);
      const get32 = pos => view.getUint32(pos, little);
      const ifd0 = tiff + get32(tiff + 4);
      const tags = {};
      const parseIfd = ifdOffset => {
        if (ifdOffset + 2 > view.byteLength) return;
        const count = get16(ifdOffset);
        for (let i = 0; i < count; i += 1) {
          const entry = ifdOffset + 2 + i * 12;
          if (entry + 12 > view.byteLength) break;
          const tag = get16(entry);
          const type = get16(entry + 2);
          const components = get32(entry + 4);
          const byteCount = components * (type === 2 ? 1 : type === 3 ? 2 : 4);
          const valueOffset = byteCount <= 4 ? entry + 8 : tiff + get32(entry + 8);
          if (valueOffset < 0 || valueOffset + byteCount > view.byteLength) continue;
          if (type === 2) tags[tag] = readAscii(view, valueOffset, Math.max(0, components - 1)).replace(/\0/g, '').trim();
          else if (type === 3 && components === 1) tags[tag] = get16(valueOffset);
          else if (type === 4 && components === 1) tags[tag] = get32(valueOffset);
          if (tag === 0x8769 && type === 4) parseIfd(tiff + get32(entry + 8));
        }
      };
      parseIfd(ifd0);
      return {
        make: tags[0x010F], model: tags[0x0110], software: tags[0x0131], capturedAt: tags[0x9003] || tags[0x0132],
        lens: tags[0xA434], width: tags[0xA002] || tags[0x0100], height: tags[0xA003] || tags[0x0101], orientation: tags[0x0112]
      };
    }
    if ((marker & 0xFF00) !== 0xFF00) break;
    const length = view.getUint16(offset, false);
    if (length < 2) break;
    offset += length;
  }
  return {};
}

async function getImageDimensions(file) {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    return await new Promise((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

async function analyzeFile(file) {
  const buffer = await file.arrayBuffer();
  const [sha256, dimensions] = await Promise.all([digest(buffer, 'SHA-256'), getImageDimensions(file)]);
  const exif = file.type === 'image/jpeg' ? parseExif(buffer) : {};
  return { sha256, dimensions, exif };
}

function renderFileResult(container, file, analysis) {
  const { exif, dimensions } = analysis;
  const camera = [exif.make, exif.model].filter(Boolean).join(' ') || '—';
  const resolution = dimensions ? `${dimensions.width} × ${dimensions.height}` : (exif.width && exif.height ? `${exif.width} × ${exif.height}` : '—');
  container.className = 'result-area';
  container.innerHTML = resultHeader(file.name) + `<div class="result-grid">
    ${dataCard('Filtype', file.type || 'Ukjent')}
    ${dataCard('Størrelse', formatBytes(file.size))}
    ${dataCard('Sist endret', formatDate(file.lastModified))}
    ${dataCard('Oppløsning', resolution)}
    ${dataCard('Kamera', camera)}
    ${dataCard('Programvare', exif.software || '—')}
    ${dataCard('Opptakstid', exif.capturedAt || '—')}
    ${dataCard('Objektiv', exif.lens || '—')}
    ${dataCard('SHA-256', analysis.sha256, true)}
  </div>`;
}

function wireDropZone(input) {
  const zone = input.closest('.drop-zone');
  if (!zone) return;
  ['dragenter', 'dragover'].forEach(eventName => zone.addEventListener(eventName, event => {
    event.preventDefault(); zone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(eventName => zone.addEventListener(eventName, event => {
    event.preventDefault(); zone.classList.remove('dragover');
  }));
  zone.addEventListener('drop', event => {
    const files = event.dataTransfer?.files;
    if (!files?.length || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function updateClock() {
  $('#clock').textContent = new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

$$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-open-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.openView)));

$('#clearHistoryButton').addEventListener('click', () => {
  if (!getHistory().length) return showToast('Historikken er allerede tom');
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast('Historikk slettet');
});

$('#domainForm').addEventListener('submit', async event => {
  event.preventDefault();
  const result = $('#domainResult');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  try {
    const domain = normalizeDomain($('#domainInput').value);
    button.disabled = true;
    setLoading(result, 'HENTER DNS DATA');
    const analysis = await analyzeDomain(domain);
    renderDomainResult(result, domain, analysis);
    saveHistory('domain', domain);
  } catch (error) { setError(result, 'Analyse feilet', error.message); }
  finally { button.disabled = false; }
});

$('#ipForm').addEventListener('submit', async event => {
  event.preventDefault();
  const result = $('#ipResult');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const ip = $('#ipInput').value.trim();
  if (!isValidIp(ip)) return setError(result, 'Ugyldig IP-adresse', 'Skriv inn en gyldig IPv4- eller IPv6-adresse.');
  try {
    button.disabled = true;
    setLoading(result, 'KARTLEGGER NETTVERK');
    const data = await lookupIp(ip);
    renderIpResult(result, ip, data);
    saveHistory('ip', ip);
  } catch (error) { setError(result, 'Oppslag feilet', error.message); }
  finally { button.disabled = false; }
});

$$('[data-hash-mode]').forEach(button => button.addEventListener('click', () => {
  $$('[data-hash-mode]').forEach(item => item.classList.toggle('active', item === button));
  const fileMode = button.dataset.hashMode === 'file';
  $('#hashFileMode').hidden = !fileMode;
  $('#hashTextMode').hidden = fileMode;
}));

$('#hashFile').addEventListener('change', event => {
  $('#hashFileName').textContent = event.target.files[0]?.name || 'Velg fil';
});

$('#hashForm').addEventListener('submit', async event => {
  event.preventDefault();
  const result = $('#hashResult');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const fileMode = $('[data-hash-mode="file"]').classList.contains('active');
  try {
    let buffer;
    let target;
    if (fileMode) {
      const file = $('#hashFile').files[0];
      if (!file) throw new Error('Velg en fil først.');
      buffer = await file.arrayBuffer();
      target = file.name;
    } else {
      const text = $('#hashText').value;
      if (!text.length) throw new Error('Skriv eller lim inn tekst først.');
      buffer = new TextEncoder().encode(text);
      target = `Tekst · ${text.length} tegn`;
    }
    button.disabled = true;
    setLoading(result, 'BEREGNER HASHER');
    const hashes = await makeHashes(buffer);
    renderHashResult(result, target, hashes, buffer.byteLength);
    saveHistory('hash', target);
  } catch (error) { setError(result, 'Kunne ikke generere hash', error.message); }
  finally { button.disabled = false; }
});

$('#fileInput').addEventListener('change', event => {
  $('#fileInputName').textContent = event.target.files[0]?.name || 'Slipp en fil her eller trykk for å velge';
});

$('#fileForm').addEventListener('submit', async event => {
  event.preventDefault();
  const result = $('#fileResult');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const file = $('#fileInput').files[0];
  if (!file) return setError(result, 'Ingen fil valgt', 'Velg en fil før du starter analysen.');
  try {
    button.disabled = true;
    setLoading(result, 'LESER FILDATA');
    const analysis = await analyzeFile(file);
    renderFileResult(result, file, analysis);
    saveHistory('file', file.name);
  } catch (error) { setError(result, 'Filanalysen feilet', error.message); }
  finally { button.disabled = false; }
});

document.addEventListener('click', async event => {
  const copyButton = event.target.closest('[data-copy]');
  if (!copyButton) return;
  try {
    await navigator.clipboard.writeText(copyButton.dataset.copy);
    showToast('Kopiert');
  } catch { showToast('Kunne ikke kopiere'); }
});

wireDropZone($('#hashFile'));
wireDropZone($('#fileInput'));
renderHistory();
updateClock();
setInterval(updateClock, 1000);
setView(location.hash.slice(1) || 'overview', false);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
