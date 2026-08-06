'use strict';

(() => {
  const api = window.TraceLensReports;
  if (!api) return;

  function caseReportHtml(item) {
    const findings = item.findings.map(finding => {
      const report = finding.data?.report || api.buildReport(finding.type, finding.target, finding.data || {});
      const reportHtml = report ? `
        <section class="plain-report ${report.level === 'Høy' ? 'high' : report.level === 'Middels' ? 'medium' : 'low'}">
          <p class="assessment"><b>Enkel vurdering:</b> ${api.html(report.summary)}</p>
          <h4>Hva betyr dette?</h4><ul>${api.asList(report.meaning)}</ul>
          <h4>Anbefalt neste steg</h4><ul>${api.asList(report.actions)}</ul>
          <h4>Begrensninger</h4><ul>${api.asList(report.limitations)}</ul>
        </section>` : '';
      return `<article>
        <h3>${api.html(finding.title)}</h3>
        <p><b>Mål:</b> ${api.html(finding.target)}</p>
        <p><b>Resultat:</b> ${api.html(finding.summary)}</p>
        ${reportHtml}
        <details><summary>Tekniske detaljer</summary><pre>${api.html(JSON.stringify(finding.data, null, 2))}</pre></details>
      </article>`;
    }).join('');

    const exported = typeof window.formatDate === 'function' ? window.formatDate(new Date()) : new Date().toLocaleString('nb-NO');
    return `<!doctype html><html lang="no"><head><meta charset="utf-8"><title>${api.html(item.title)} – TraceLens</title><style>
      body{font:15px/1.6 system-ui;max-width:940px;margin:40px auto;padding:0 22px;color:#17202a}header{border-bottom:2px solid #17202a;margin-bottom:28px;padding-bottom:16px}small{color:#667}article{border:1px solid #ccd4dc;border-radius:12px;padding:20px;margin:16px 0;break-inside:avoid}.plain-report{border-left:5px solid #22a06b;background:#f4fbf7;padding:14px 18px;margin:16px 0}.plain-report.medium{border-left-color:#d59b00;background:#fffbeb}.plain-report.high{border-left-color:#d14343;background:#fff5f5}.assessment{font-size:16px}.plain-report h4{margin-bottom:4px}.plain-report ul{margin-top:4px}summary{cursor:pointer;font-weight:700}pre{white-space:pre-wrap;word-break:break-word;background:#f3f6f8;padding:12px;border-radius:8px;font-size:12px}@media print{body{margin:0}details{display:block}details>summary{display:none}}
    </style></head><body><header><h1>${api.html(item.title)}</h1><p>${api.html(item.description || '')}</p><small>Eksportert ${exported} · TraceLens</small></header><h2>Notater</h2><p>${api.html(item.notes || 'Ingen notater')}</p><h2>Funn (${item.findings.length})</h2>${findings || '<p>Ingen funn.</p>'}</body></html>`;
  }

  function exportReadableCaseReport() {
    if (typeof window.getCases !== 'function' || typeof window.getActiveCaseId !== 'function') return;
    const item = window.getCases().find(entry => entry.id === window.getActiveCaseId());
    if (!item) return;
    const win = window.open('', '_blank');
    if (!win) {
      window.showToast?.('Nettleseren blokkerte rapportvinduet');
      return;
    }
    win.document.write(caseReportHtml(item));
    win.document.close();
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-export-report]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exportReadableCaseReport();
  }, true);
})();
