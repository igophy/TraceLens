'use strict';

(() => {
  const api = window.TraceLensReports;
  if (!api) return;
  const reportCopies = new Map();

  function renderReport(container, report, target) {
    if (!container || !report) return;
    container.querySelector('.explanation-report')?.remove();
    container.querySelector('.technical-heading')?.remove();

    const id = `report-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    reportCopies.set(id, api.reportText(report, target));
    const section = document.createElement('section');
    section.className = `explanation-report ${report.level === 'Høy' ? 'high' : report.level === 'Middels' ? 'medium' : 'low'}`;
    section.innerHTML = `
      <div class="report-heading">
        <div><span>ENKEL RAPPORT</span><h3>${api.html(report.title)}</h3></div>
        <button class="ghost-button" type="button" data-copy-report="${id}">Kopier rapport</button>
      </div>
      <p class="report-summary">${api.html(report.summary)}</p>
      <div class="report-columns">
        <div><h4>Hva betyr dette?</h4><ul>${api.asList(report.meaning)}</ul></div>
        <div><h4>Anbefalt neste steg</h4><ul>${api.asList(report.actions)}</ul></div>
      </div>
      <details class="report-limitations">
        <summary>Hva analysen ikke kan avgjøre</summary>
        <ul>${api.asList(report.limitations)}</ul>
      </details>`;

    const actions = container.querySelector('.result-actions');
    if (actions) actions.insertAdjacentElement('afterend', section);
    else container.querySelector('.result-header')?.insertAdjacentElement('afterend', section);

    const details = container.querySelector('.data-grid, .hash-list');
    if (details) {
      const heading = document.createElement('div');
      heading.className = 'technical-heading';
      heading.innerHTML = '<span>TEKNISKE DETALJER</span><small>Rådata fra analysen</small>';
      details.insertAdjacentElement('beforebegin', heading);
    }
  }

  const originalRegisterResult = window.registerResult;
  if (typeof originalRegisterResult === 'function') {
    window.registerResult = function registerResultWithReport(type, target, title, summary, data) {
      const report = api.buildReport(type, target, data || {});
      return originalRegisterResult(type, target, title, summary, report ? { ...data, report } : data);
    };
  }

  function wrapRenderer(name, descriptor) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function wrappedRenderer(...args) {
      const result = original.apply(this, args);
      const info = descriptor(...args);
      renderReport(args[0], api.buildReport(info.type, info.target, info.data), info.target);
      return result;
    };
  }

  wrapRenderer('renderUrlResult', (_container, _raw, analysis) => ({
    type: 'url', target: analysis.url?.href || '',
    data: { score: analysis.score, level: analysis.level, host: analysis.url?.hostname, protocol: analysis.url?.protocol, findings: analysis.findings }
  }));
  wrapRenderer('renderDomainResult', (_container, domain, analysis) => ({ type: 'domain', target: domain, data: analysis }));
  wrapRenderer('renderPrivateIp', (_container, ip, type) => ({ type: 'ip', target: ip, data: { classification: type, public: false } }));
  wrapRenderer('renderIpResult', (_container, ip, data) => ({
    type: 'ip', target: ip,
    data: { public: true, country: data.country, city: data.city, region: data.region, isp: data.connection?.isp, asn: data.connection?.asn, org: data.connection?.org }
  }));
  wrapRenderer('renderFileResult', (_container, file, analysis) => ({
    type: 'file', target: file.name,
    data: { name: file.name, type: file.type, signature: analysis.signature, extensionMatches: analysis.extensionMatches, entropy: analysis.entropy, sha256: analysis.hashes?.sha256 }
  }));
  wrapRenderer('renderHashResult', (_container, target, hashes, size, expected) => {
    const normalized = (expected || '').trim().toLowerCase().replace(/\s/g, '');
    return { type: 'hash', target, data: { hashes, expected: normalized, match: normalized ? Object.values(hashes).includes(normalized) : null, size } };
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-report]');
    if (!button) return;
    const text = reportCopies.get(button.dataset.copyReport);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.('Rapport kopiert');
    } catch {
      window.showToast?.('Kunne ikke kopiere rapporten');
    }
  });
})();
