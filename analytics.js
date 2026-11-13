'use strict';
// Medição da página pública com Google Analytics 4, só depois do consentimento (LGPD).
// - Sem ID em config.js (analytics.ga4Id), nada é carregado e nenhum aviso aparece.
// - A área do aluno nunca é medida: sem nomes, e-mails ou IDs de alunos (a maioria é menor de idade).
// - Eventos do funil: interesse em começar, cadastro concluído e ida ao pagamento da Hotmart.
(() => {
  const id = window.SITE_CONFIG?.analytics?.ga4Id, KEY = 'mt-consent';
  window.mtTrack = () => {};
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const save = v => { try { localStorage.setItem(KEY, v); } catch {} };
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  const loggedIn = () => { try { return !!sessionStorage.getItem('tiradentes-session'); } catch { return false; } };
  let loaded = false;
  function start() {
    if (loaded) return; loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    if (!loggedIn()) gtag('event', 'page_view', { page_location: location.origin + location.pathname + location.search, page_title: document.title });
  }
  // Só eventos do funil, sem dados pessoais. A área do aluno não envia page_view.
  window.mtTrack = (name, params = {}) => { if (loaded) gtag('event', name, params); };
  document.addEventListener('click', e => {
    const el = e.target.closest('a,button'); if (!el) return;
    if (el.matches('[data-auth="signup"],a[href="#lp-preco"]')) mtTrack('generate_lead_start', { location: el.closest('section,header')?.id || 'topo' });
    if (/pay\.hotmart\.com/.test(el.getAttribute('href') || '')) mtTrack('begin_checkout', { currency: 'BRL', value: Number(window.SITE_CONFIG?.offer?.price) || undefined });
  }, true);
  function banner() {
    const b = document.createElement('div');
    b.className = 'consent'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML = '<p>Usamos cookies de medição (Google Analytics) para entender como as famílias encontram o site e melhorar esta página. A área do aluno não é medida. <a href="privacidade.html">Política de privacidade</a></p><div><button class="btn outline small" data-consent="no">Recusar</button><button class="btn small" data-consent="yes">Aceitar</button></div>';
    b.addEventListener('click', e => { const v = e.target.closest('[data-consent]')?.dataset.consent; if (!v) return; save(v); b.remove(); if (v === 'yes') start(); });
    document.body.appendChild(b);
  }
  const c = read();
  if (c === 'yes') start();
  else if (c !== 'no' && !loggedIn()) document.addEventListener('DOMContentLoaded', banner);
})();
