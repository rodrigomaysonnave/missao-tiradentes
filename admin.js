'use strict';
// Painel de administração. Carregado sob demanda por admin() em app.js; usa os utilitários globais de app.js
// ($, esc, ico, rpc, shell, heading, flash, openModal, demo). Os dados vêm de funções do banco restritas ao administrador.
window.AdminPanel = (() => {
  let tab = 'overview', filter = 'all', search = '', months = 12, cache = {};
  const tabs = [['overview', 'Visão geral'], ['students', 'Alunos e responsáveis'], ['finance', 'Financeiro'], ['system', 'Sistema e marketing']];
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = v => Number(v || 0).toLocaleString('pt-BR');
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const tz = { timeZone: 'America/Sao_Paulo' };
  const dt = v => v ? new Date(v.length === 10 ? v + 'T12:00' : v).toLocaleDateString('pt-BR', tz) : '—';
  const dtt = v => v ? new Date(v).toLocaleString('pt-BR', { ...tz, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const mon = v => new Date(v + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  const ago = v => { if (!v) return 'nunca'; const d = Math.floor((Date.now() - new Date(v)) / 86400000); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };
  const phoneFmt = p => p ? String(p).replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '';
  const wa = (p, text = '') => p ? `<a class="adm-wa" href="https://wa.me/55${esc(p)}${text ? '?text=' + encodeURIComponent(text) : ''}" target="_blank" rel="noopener">WhatsApp ${esc(phoneFmt(p))}</a>` : '';
  const statusLabel = { pending: 'Aguardando pagamento', approved: 'Ativo', rejected: 'Não aprovado', suspended: 'Suspenso' };
  const payLabel = { aprovada: 'Aprovada', concluida: 'Concluída', reembolsada: 'Reembolsada', chargeback: 'Chargeback', cancelada: 'Cancelada',
    pedido_reembolso: 'Pedido de reembolso', aguardando: 'Aguardando pagamento', atrasada: 'Atrasada', expirada: 'Expirada' };
  const payType = { CREDIT_CARD: 'Cartão', PIX: 'Pix', BILLET: 'Boleto', PAYPAL: 'PayPal', GOOGLE_PAY: 'Google Pay', OUTRO: 'Outro' };
  const tone = s => ({ approved: 'good', aprovada: 'good', concluida: 'good', pending: 'warn', aguardando: 'warn', pedido_reembolso: 'warn',
    suspended: 'bad', rejected: 'bad', reembolsada: 'bad', chargeback: 'bad', cancelada: 'bad', expirada: 'bad' }[s] || '');
  const badge = (s, label) => `<span class="adm-badge ${tone(s)}">${esc(label || s)}</span>`;
  const inGuarantee = t => t.status === 'aprovada' && t.approved_at && Date.now() - new Date(t.approved_at) < (C.offer?.guaranteeDays || 7) * 86400000;

  // Gráfico de barras simples em SVG. series: [{label, values:[...], cls}] ; labels: rótulos do eixo x.
  function bars(labels, series, { height = 150, fmt = num, every = 1 } = {}) {
    const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.max(0, v))));
    const n = labels.length, w = 100 / n, bw = w * 0.8 / series.length;
    const rects = labels.map((l, i) => series.map((s, k) => {
      const v = s.values[i] || 0, h = Math.max(0, v) / max * (height - 18);
      return `<rect class="${s.cls}" x="${(i * w + w * 0.1 + k * bw).toFixed(2)}%" y="${(height - 18 - h).toFixed(1)}" width="${bw.toFixed(2)}%" height="${h.toFixed(1)}" rx="2"><title>${esc(l)} · ${esc(s.label)}: ${esc(fmt(v))}</title></rect>`;
    }).join('')).join('');
    const ticks = labels.map((l, i) => `<span>${i % every === 0 ? esc(l) : ''}</span>`).join('');
    const legend = series.length > 1 ? `<div class="adm-legend">${series.map(s => `<span><i class="${s.cls}"></i>${esc(s.label)}</span>`).join('')}</div>` : '';
    return `${legend}<svg class="adm-chart" viewBox="0 0 100 ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(series.map(s => s.label).join(', '))}"><line x1="0" x2="100%" y1="${height - 18}" y2="${height - 18}"/>${rects}</svg><div class="adm-axis" style="grid-template-columns:repeat(${n},1fr)" aria-hidden="true">${ticks}</div>`;
  }
  const kpi = (label, value, sub = '', cls = '') => `<div class="adm-kpi ${cls}"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;

  async function load(key, fn) { if (!cache[key]) cache[key] = await fn(); return cache[key]; }
  const get = {
    overview: () => load('overview', () => demo ? fake.overview() : rpc('admin_overview', {})),
    students: () => load('students', () => demo ? fake.students() : rpc('admin_students', {})),
    finance: () => load('finance' + months, () => demo ? fake.finance() : rpc('admin_finance', { p_months: months })),
  };

  async function render() {
    let body = '';
    try { body = await ({ overview, students, finance, system }[tab])(); }
    catch (e) {
      body = /admin_|function|404|PGRST/i.test(e.message)
        ? `<div class="notice">O painel ainda não foi ativado no banco. Rode <b>work/changes/admin-dashboard.sql</b> no SQL Editor do Supabase.<br><small>${esc(e.message)}</small></div>`
        : `<div class="notice">${esc(e.message)}</div>`;
    }
    shell(`${heading('Administração', 'Alunos, responsáveis, vendas e saúde do sistema em um só lugar.')}
      ${demo ? '<div class="notice">Demonstração: todos os dados abaixo são fictícios.</div>' : ''}
      <div class="adm-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'active' : ''}" data-atab="${k}">${t}</button>`).join('')}
      <button class="adm-refresh" data-arefresh="1" aria-label="Atualizar dados">↻ Atualizar</button></div>
      <div class="adm-body">${body}</div>`);
  }

  // ---------------- visão geral ----------------
  async function overview() {
    const o = await get.overview(), s = o.students, f = o.funnel, a = o.alerts, m = o.money, act = o.activity;
    const alerts = [
      [a.paid_without_account, 'pagamento(s) sem cadastro vinculado', 'Compraram com um e-mail que não bate com nenhum cadastro. Vincule ao aluno certo.', 'finance'],
      [a.refund_requests, 'pedido(s) de reembolso', 'Entre em contato antes do prazo da garantia.', 'finance'],
      [a.leads, 'ficha(s) preenchida(s) sem pagamento', 'Responsáveis que começaram o cadastro e não pagaram. Bom momento para um contato.', 'students:leads'],
      [a.abandoned_30d, 'carrinho(s) abandonado(s) nos últimos 30 dias', 'Abriram o checkout da Hotmart e não concluíram.', 'finance'],
      [a.unconfirmed, 'cadastro(s) sem e-mail confirmado há mais de 1 dia', 'Pode ser e-mail na caixa de spam ou digitado errado.', 'students:unconfirmed'],
      [a.reports_failed, 'relatório(s) semanal(is) com falha no envio', 'Confira a configuração de e-mail.', 'system'],
    ].filter(x => x[0] > 0);
    const steps = [['Cadastros', f.signups], ['E-mail confirmado', f.confirmed], ['Ficha completa', f.enrolled], ['Pagamento aprovado', f.approved], ['Fez o diagnóstico', f.diagnostic], ['Plano definido', f.plan], ['Relatório semanal ligado', f.reports]];
    const daily = act.daily || [], weekly = o.signups_weekly || [];
    return `
      ${alerts.length ? `<div class="adm-alerts">${alerts.map(([n, t, d, go]) => `<button class="adm-alert" data-ago="${go}"><strong>${n} ${t}</strong><span>${d}</span></button>`).join('')}</div>` : '<div class="adm-ok">Nenhuma pendência no momento.</div>'}
      <div class="adm-kpis">
        ${kpi('Alunos ativos', num(s.approved), `${num(s.pending)} aguardando pagamento`)}
        ${kpi('Novos cadastros', num(s.new_7d), `${num(s.new_30d)} nos últimos 30 dias`)}
        ${kpi('Vendas no mês', num(m.month_sales), `${brl(m.month_net)} líquido`)}
        ${kpi('Estudaram nos últimos 7 dias', `${num(act.active_7d)} de ${num(s.approved)}`, `${num(act.inactive_7d)} sem atividade`, act.inactive_7d ? 'warn' : '')}
        ${kpi('Minutos estudados (7 dias)', num(act.minutes_7d), `${num(act.attempts_7d)} atividades concluídas`)}
        ${kpi('Em garantia', num(m.in_guarantee), 'vendas que ainda podem ser reembolsadas')}
      </div>
      <div class="adm-grid2">
        <section class="panel"><h3>Funil do cadastro ao estudo</h3>
          <div class="adm-funnel">${steps.map(([t, n], i) => `<div><span>${t}</span><div class="adm-bar"><i style="width:${pct(n, f.signups || 1)}%"></i></div><b>${num(n)}</b><small>${i ? pct(n, steps[i - 1][1]) + '% da etapa anterior' : ''}</small></div>`).join('')}</div>
        </section>
        <section class="panel"><h3>Alunos estudando por dia (30 dias)</h3>
          ${bars(daily.map(d => dt(d.day).slice(0, 5)), [{ label: 'Alunos que estudaram', values: daily.map(d => d.students), cls: 's1' }], { every: 5 })}
        </section>
      </div>
      <section class="panel spaced"><h3>Cadastros e vendas por semana (12 semanas)</h3>
        ${bars(weekly.map(w => dt(w.week).slice(0, 5)), [{ label: 'Cadastros', values: weekly.map(w => w.signups), cls: 's2' }, { label: 'Vendas', values: weekly.map(w => w.sales), cls: 's1' }], { every: 2 })}
      </section>`;
  }

  // ---------------- alunos ----------------
  const filters = [['all', 'Todos'], ['approved', 'Ativos'], ['inactive', 'Sem estudo há 7+ dias'], ['leads', 'Ficha sem pagamento'], ['pending', 'Aguardando pagamento'], ['unconfirmed', 'E-mail não confirmado'], ['suspended', 'Suspensos']];
  function pass(r) {
    const idle = !r.last_activity || Date.now() - new Date(r.last_activity) > 7 * 86400000;
    const ok = { all: true, approved: r.status === 'approved', inactive: r.status === 'approved' && idle, leads: r.status === 'pending' && r.enrolled,
      pending: r.status === 'pending', unconfirmed: !r.email_confirmed, suspended: r.status === 'suspended' || r.status === 'rejected' }[filter];
    if (!ok) return false;
    if (!search) return true;
    const q = search.toLowerCase(), digits = search.replace(/\D/g, '');
    return [r.name, r.student_name, r.email, r.guardian_name, r.unit, r.student_school].some(v => String(v || '').toLowerCase().includes(q)) || (digits.length >= 4 && String(r.guardian_phone || '').includes(digits));
  }
  async function students() {
    const rows = await get.students(), list = rows.filter(pass);
    const count = k => rows.filter(r => { const f = filter; filter = k; const ok = pass({ ...r, name: r.name }) ; filter = f; return ok; }).length;
    return `
      <div class="adm-toolbar"><input id="adm-search" type="search" placeholder="Buscar por aluno, responsável, e-mail, telefone ou escola" value="${esc(search)}" aria-label="Buscar aluno">
        <button class="btn outline small" data-acsv="1">Exportar planilha (CSV)</button></div>
      <div class="adm-chips">${filters.map(([k, t]) => `<button class="${filter === k ? 'active' : ''}" data-afilter="${k}">${t} <small>${count(k)}</small></button>`).join('')}</div>
      ${list.length ? `<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Aluno</th><th>Responsável</th><th>Situação</th><th>Plano</th><th>Esta semana</th><th>Última atividade</th><th></th></tr></thead><tbody>
      ${list.map(r => {
        const target = (r.plan_minutes || 0) * (r.plan_days?.length || 0);
        return `<tr><td data-l="Aluno"><b>${esc(r.student_name || r.name)}</b><small>${esc([r.student_grade, r.unit].filter(Boolean).join(' · ')) || '—'}</small></td>
        <td data-l="Responsável">${r.guardian_name ? `${esc(r.guardian_name)} <small>${esc(r.guardian_relation || '')}</small>` : '<small>Ficha pendente</small>'}<small>${esc(r.email)}${r.email_confirmed ? '' : ' · <b class="adm-warn-text">e-mail não confirmado</b>'}</small>${wa(r.guardian_phone)}</td>
        <td data-l="Situação">${badge(r.status, statusLabel[r.status])}${r.payment ? `<small>Pagamento: ${esc(payLabel[r.payment.status] || r.payment.status)}</small>` : ''}</td>
        <td data-l="Plano">${r.plan_minutes ? `${r.plan_minutes} min × ${r.plan_days.length} dias${r.has_pin ? '' : '<small>sem PIN</small>'}` : `<small>${r.status === 'approved' ? (r.diagnostic ? 'Diagnóstico feito, sem plano' : 'Ainda sem diagnóstico') : '—'}</small>`}</td>
        <td data-l="Esta semana">${r.plan_minutes ? `<div class="adm-bar small"><i style="width:${Math.min(100, pct(r.week_minutes, target))}%"></i></div><small>${num(r.week_minutes)} de ${num(target)} min · ${r.week_days} dia(s)</small>` : '—'}</td>
        <td data-l="Última atividade">${esc(ago(r.last_activity))}${r.avg_percent != null ? `<small>Acertos recentes: ${r.avg_percent}%</small>` : ''}</td>
        <td><button class="btn outline small" data-astudent="${r.id}">Abrir</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty">Nenhum aluno neste filtro.</div>'}
      <p class="muted adm-foot">CPF e RG não aparecem nesta lista. Para vê-los, abra o aluno e use “Ver ficha completa”.</p>`;
  }

  async function studentDetail(id) {
    const r = (await get.students()).find(x => x.id === id);
    if (!r) return;
    openModal('<div class="modal-head"><h2>Carregando…</h2><button data-action="close-modal" aria-label="Fechar">×</button></div>');
    let d;
    try { d = demo ? fake.detail() : await rpc('admin_student_detail', { p_user: id }); }
    catch (e) { openModal(`<div class="modal-head"><h2>Não foi possível abrir</h2><button data-action="close-modal" aria-label="Fechar">×</button></div><p>${esc(e.message)}</p>`); return; }
    const plan = d.plans[0], weeks = d.weeks || [];
    const kind = { diagnostic: 'Diagnóstico', practice: 'Treino', lesson: 'Aula', exam: 'Prova anterior', mock: 'Simulado de conquista', review: 'Revisão' };
    const topics = (d.topics || []).filter(t => t.total >= 2).map(t => ({ ...t, rate: pct(t.correct, t.total) })).sort((a, b) => a.rate - b.rate);
    const firstName = (r.guardian_name || '').split(' ')[0];
    openModal(`<div class="modal-head"><h2>${esc(r.student_name || r.name)}</h2><button data-action="close-modal" aria-label="Fechar">×</button></div>
      <div class="adm-detail">
        <p>${badge(r.status, statusLabel[r.status])} ${esc([r.student_grade, r.student_school, r.unit].filter(Boolean).join(' · '))} · cadastro em ${dt(r.created_at)}</p>
        <div class="adm-actions">
          ${r.enrolled ? `<button class="btn outline small" data-enroll="${r.id}">Ver ficha completa</button>` : ''}
          ${r.status !== 'approved' ? `<button class="btn small" data-approve="${r.id}">Liberar acesso</button>` : `<button class="btn outline small" data-suspend="${r.id}">Suspender</button>`}
          ${r.has_pin ? `<button class="btn outline small" data-pinreset="${r.id}">Zerar PIN</button>` : ''}
        </div>
        <h3>Responsável</h3>
        <p>${r.guardian_name ? `<b>${esc(r.guardian_name)}</b> (${esc(r.guardian_relation || '')})<br>` : 'Ficha ainda não preenchida.<br>'}${esc(r.email)} ${r.email_confirmed ? '· e-mail confirmado' : '· <b class="adm-warn-text">e-mail não confirmado</b>'}<br>
          Último acesso: ${esc(ago(r.last_sign_in_at))} · Relatório semanal: ${r.reports_active ? 'ligado' : 'desligado'}<br>
          ${wa(r.guardian_phone, firstName ? `Olá, ${firstName}! Aqui é da Missão Tiradentes.` : '')}</p>
        <h3>Plano de estudo</h3>
        <p>${plan ? `${plan.minutes} min por dia, ${plan.days.length} dias por semana, às ${String(plan.time).slice(0, 5)} (desde ${dt(plan.start_day)})` : 'Sem plano definido.'}${d.plans.length > 1 ? `<br><small>${d.plans.length - 1} alteração(ões) anteriores.</small>` : ''}</p>
        ${weeks.length ? `<h3>Minutos por semana (meta x feito)</h3>${bars(weeks.map(w => dt(w.week).slice(0, 5)), [{ label: 'Meta', values: weeks.map(w => w.target || 0), cls: 's2' }, { label: 'Estudado', values: weeks.map(w => w.minutes), cls: 's1' }], { height: 120 })}` : ''}
        ${topics.length ? `<h3>Desempenho por tema</h3><div class="adm-topics">${topics.slice(0, 12).map(t => `<div><span>${esc((course.topics.find(x => x.id === t.topic)?.title) || t.topic)}</span><div class="adm-bar small ${t.rate < 50 ? 'low' : ''}"><i style="width:${t.rate}%"></i></div><small>${t.correct}/${t.total}</small></div>`).join('')}</div>` : ''}
        <h3>Últimas atividades</h3>
        ${d.attempts.length ? `<ul class="adm-list">${d.attempts.slice(0, 12).map(a => `<li><span>${dtt(a.date)}</span><b>${esc(kind[a.kind] || a.kind || 'Atividade')}</b> ${esc(a.label || '')}<em>${a.percent != null ? Math.round(a.percent) + '%' : ''}</em></li>`).join('')}</ul>` : '<p class="muted">Nenhuma atividade ainda.</p>'}
        ${d.mocks.length ? `<h3>Simulados de conquista</h3><ul class="adm-list">${d.mocks.map(m => `<li><b>Simulado ${m.number}</b> iniciado em ${dtt(m.started_at)}<em>${m.finished_at ? 'entregue' : 'em andamento'}</em></li>`).join('')}</ul>` : ''}
        ${d.reports.length ? `<h3>Relatórios semanais</h3><ul class="adm-list">${d.reports.map(x => `<li>Semana de ${dt(x.week_start)}<em>${esc({ sent: 'enviado', pending: 'na fila', sending: 'enviando', failed: 'falhou', uncertain: 'envio incerto' }[x.status] || x.status)}</em></li>`).join('')}</ul>` : ''}
        ${d.payments.length ? `<h3>Avisos da Hotmart</h3><ul class="adm-list">${d.payments.map(p => `<li><span>${dtt(p.at)}</span>${esc(p.event)}<em>${esc(p.transaction || '')}</em></li>`).join('')}</ul>` : ''}
        ${d.audit.length ? `<h3>Histórico de acesso</h3><ul class="adm-list">${d.audit.map(x => `<li><span>${dtt(x.at)}</span>${esc(statusLabel[x.from] || x.from)} → ${esc(statusLabel[x.to] || x.to)}<em>${esc(x.by || '')}</em></li>`).join('')}</ul>` : ''}
        <h3>Anotações do atendimento</h3>
        <form class="form adm-note" data-aform="note" data-user="${r.id}"><textarea name="body" rows="2" maxlength="2000" placeholder="Ex.: mãe pediu para mudar o horário; combinado retorno na sexta." required></textarea><button class="btn small" type="submit">Salvar anotação</button></form>
        ${d.notes.length ? `<ul class="adm-list">${d.notes.map(n => `<li><span>${dtt(n.at)}</span>${esc(n.body)}<em>${esc(n.by || '')}</em></li>`).join('')}</ul>` : ''}
      </div>`);
  }

  function csv() {
    const rows = (cache.students || []).filter(pass);
    const head = ['Aluno', 'Série', 'Escola', 'Unidade', 'Situação', 'Responsável', 'Parentesco', 'E-mail', 'WhatsApp', 'Cadastro', 'Plano (min/dia)', 'Minutos nesta semana', 'Última atividade', 'Pagamento'];
    const lines = rows.map(r => [r.student_name || r.name, r.student_grade, r.student_school, r.unit, statusLabel[r.status], r.guardian_name, r.guardian_relation, r.email,
      phoneFmt(r.guardian_phone), dt(r.created_at), r.plan_minutes || '', r.week_minutes, r.last_activity ? dt(r.last_activity) : '', r.payment ? payLabel[r.payment.status] || r.payment.status : '']);
    const text = '﻿' + [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `alunos-missao-tiradentes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------------- financeiro ----------------
  const categories = ['Anúncios (Meta)', 'Anúncios (Google)', 'Ferramentas e assinaturas', 'Hospedagem e domínio', 'Material e conteúdo', 'Impostos', 'Contador', 'Pró-labore', 'Outros'];
  async function finance() {
    const f = await get.finance(), t = f.totals, ms = f.months || [];
    const result = Number(t.net) - Number(t.refunded_net) + Number(t.other_income) - Number(t.expenses);
    const guarantee = (f.transactions || []).filter(inGuarantee);
    const unlinked = (f.transactions || []).filter(x => ['aprovada', 'concluida'].includes(x.status) && !x.user_id);
    return `
      <div class="adm-toolbar"><label>Período <select id="adm-months">${[6, 12, 24].map(n => `<option value="${n}" ${n === months ? 'selected' : ''}>Últimos ${n} meses</option>`).join('')}</select></label></div>
      <div class="adm-kpis">
        ${kpi('Receita líquida (Hotmart)', brl(t.net), `${num(t.sales)} vendas · ${brl(t.gross)} bruto`)}
        ${kpi('Reembolsos e chargebacks', brl(t.refunded_net), `${num(t.refunds)} venda(s)`, t.refunds ? 'warn' : '')}
        ${kpi('Despesas lançadas', brl(t.expenses), t.other_income > 0 ? `${brl(t.other_income)} em outras receitas` : '')}
        ${kpi('Resultado', brl(result), 'líquido − reembolsos + receitas − despesas', result < 0 ? 'bad' : 'good')}
        ${kpi('Ainda em garantia', brl(guarantee.reduce((s, x) => s + Number(x.net || 0), 0)), `${guarantee.length} venda(s) dentro dos ${C.offer?.guaranteeDays || 7} dias`)}
        ${kpi('Formas de pagamento', Object.entries(t.by_payment || {}).map(([k, v]) => `${payType[k] || k} ${v}`).join(' · ') || '—', '')}
      </div>
      ${unlinked.length ? `<div class="notice"><b>${unlinked.length} pagamento(s) aprovado(s) sem aluno vinculado.</b> Use “Vincular” na lista de vendas para liberar o acesso do aluno certo.</div>` : ''}
      <section class="panel"><h3>Resultado por mês</h3>
        ${bars(ms.map(m => mon(m.month)), [{ label: 'Líquido Hotmart', values: ms.map(m => Number(m.net) - Number(m.refunded_net)), cls: 's1' }, { label: 'Despesas', values: ms.map(m => Number(m.expenses)), cls: 's3' }], { fmt: brl, every: ms.length > 12 ? 2 : 1 })}
        <div class="adm-table-wrap"><table class="adm-table compact"><thead><tr><th>Mês</th><th>Vendas</th><th>Bruto</th><th>Líquido</th><th>Reembolsos</th><th>Despesas</th><th>Outras receitas</th><th>Resultado</th></tr></thead><tbody>
        ${[...ms].reverse().map(m => `<tr><td data-l="Mês">${mon(m.month)}</td><td data-l="Vendas">${m.sales}</td><td data-l="Bruto">${brl(m.gross)}</td><td data-l="Líquido">${brl(m.net)}</td><td data-l="Reembolsos">${m.refunds ? `${brl(m.refunded_net)} (${m.refunds})` : '—'}</td><td data-l="Despesas">${brl(m.expenses)}</td><td data-l="Outras receitas">${brl(m.other_income)}</td><td data-l="Resultado"><b class="${m.result < 0 ? 'adm-bad-text' : ''}">${brl(m.result)}</b></td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <div class="adm-grid2 spaced">
        <section class="panel"><h3>Lançar despesa ou receita</h3>
          <form class="form adm-entry" data-aform="entry">
            <div class="adm-row2"><label>Tipo<select name="kind"><option value="despesa">Despesa</option><option value="receita">Receita avulsa</option></select></label>
            <label>Data<input type="date" name="day" required value="${new Date().toLocaleDateString('sv-SE', tz)}"></label></div>
            <label>Categoria<input name="category" list="adm-cats" required maxlength="40" placeholder="Ex.: Anúncios (Meta)"></label><datalist id="adm-cats">${categories.map(c => `<option value="${c}">`).join('')}</datalist>
            <label>Descrição<input name="description" maxlength="200" placeholder="Ex.: campanha de novembro"></label>
            <label>Valor (R$)<input name="amount" inputmode="decimal" required placeholder="0,00"></label>
            <button class="btn small" type="submit">Lançar</button>
          </form>
        </section>
        <section class="panel"><h3>Lançamentos do período</h3>
          ${f.entries.length ? `<ul class="adm-list">${f.entries.map(e => `<li><span>${dt(e.day)}</span><b>${esc(e.category)}</b> ${esc(e.description)}<em class="${e.kind === 'despesa' ? 'adm-bad-text' : 'ok-text'}">${e.kind === 'despesa' ? '−' : '+'} ${brl(e.amount)}</em><button class="adm-x" data-aentrydel="${e.id}" aria-label="Apagar lançamento">×</button></li>`).join('')}</ul>` : '<p class="muted">Nenhum lançamento. Registre aqui anúncios, ferramentas, impostos e outros custos para ver o resultado real.</p>'}
        </section>
      </div>
      <section class="panel spaced"><h3>Vendas</h3>
        ${f.transactions.length ? `<div class="adm-table-wrap"><table class="adm-table compact"><thead><tr><th>Data</th><th>Comprador</th><th>Aluno</th><th>Situação</th><th>Pagamento</th><th>Bruto</th><th>Líquido</th></tr></thead><tbody>
        ${f.transactions.map(x => `<tr><td data-l="Data">${dt(x.approved_at || x.first_at)}</td><td data-l="Comprador">${esc(x.buyer || '')}<small>${esc(x.email || '')}</small></td>
          <td data-l="Aluno">${x.user_id ? esc(x.student || '') : ['aprovada', 'concluida'].includes(x.status) ? `<button class="btn outline small" data-alink="${esc(x.transaction)}">Vincular</button>` : '—'}</td>
          <td data-l="Situação">${badge(x.status, payLabel[x.status] || x.status)}${inGuarantee(x) ? '<small>em garantia</small>' : ''}</td>
          <td data-l="Pagamento">${esc(payType[x.payment_type] || x.payment_type || '—')}${x.installments > 1 ? ` ${x.installments}x` : ''}</td>
          <td data-l="Bruto">${x.price != null ? brl(x.price) : '—'}</td><td data-l="Líquido">${x.net != null ? brl(x.net) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="empty">Nenhuma venda registrada ainda. As vendas aparecem aqui assim que a Hotmart envia o aviso.</div>'}
        <p class="muted adm-foot">Valores conforme os avisos da Hotmart: bruto é o que o comprador pagou; líquido é a sua comissão de produtor, já sem as taxas. Datas de saque e antecipação seguem as regras da Hotmart.</p>
      </section>
      ${f.abandoned.length ? `<section class="panel spaced"><h3>Carrinhos abandonados (60 dias)</h3><ul class="adm-list">${f.abandoned.map(a => `<li><span>${dtt(a.at)}</span><b>${esc(a.name || '')}</b> ${esc(a.email || '')} ${wa(String(a.phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''), 'Olá! Vi que você se interessou pela Missão Tiradentes. Posso ajudar com alguma dúvida?')}</li>`).join('')}</ul></section>` : ''}`;
  }

  async function linkPayment(tx) {
    const rows = (await get.students()).filter(r => r.status !== 'approved' || !r.payment);
    openModal(`<div class="modal-head"><h2>Vincular pagamento</h2><button data-action="close-modal" aria-label="Fechar">×</button></div>
      <p>Escolha o aluno desta compra. Se a compra estiver aprovada, o acesso dele é liberado.</p>
      <form class="form" data-aform="link" data-tx="${esc(tx)}"><label>Aluno<select name="user" required><option value="">Selecione</option>${rows.map(r => `<option value="${r.id}">${esc(r.student_name || r.name)} · ${esc(r.email)}</option>`).join('')}</select></label><button class="btn" type="submit">Vincular e liberar</button></form>`);
  }

  // ---------------- sistema e marketing ----------------
  async function system() {
    const o = await get.overview(), s = o.system || {};
    const ga = !!C.analytics?.ga4Id;
    const project = (C.supabaseUrl || '').match(/https:\/\/([a-z0-9]+)\./)?.[1] || '';
    const hours = s.last_webhook ? (Date.now() - new Date(s.last_webhook)) / 3600000 : null;
    const check = (ok, title, text) => `<li class="${ok ? 'done' : ''}"><b>${ok ? '✓' : '○'} ${title}</b><span>${text}</span></li>`;
    const link = (href, t) => `<a class="btn outline small" href="${href}" target="_blank" rel="noopener">${t}</a>`;
    return `
      <div class="adm-kpis">
        ${kpi('Último aviso da Hotmart', s.last_webhook ? ago(s.last_webhook) : 'nenhum', `${num(s.webhooks_30d)} avisos em 30 dias`)}
        ${kpi('Último relatório semanal enviado', s.last_report_sent ? ago(s.last_report_sent) : 'nenhum', `${num(s.reports_pending)} na fila · ${num(o.alerts.reports_failed)} com falha`, o.alerts.reports_failed ? 'warn' : '')}
        ${kpi('PINs de responsáveis', num(s.pins), `${num(s.pins_locked)} bloqueado(s) agora`)}
      </div>
      <div class="adm-grid2">
        <section class="panel"><h3>Configuração</h3><ul class="adm-check">
          ${check(true, 'Pagamento automático (Hotmart)', hours == null ? 'Webhook configurado. Ainda sem vendas reais registradas.' : 'Avisos chegando normalmente.')}
          ${check(ga, 'Google Analytics 4', ga ? `Medindo a página de vendas com o ID ${esc(C.analytics.ga4Id)}.` : 'Crie a propriedade no Google Analytics e coloque o ID (G-XXXXXXX) em config.js. Só a página pública é medida, nunca a área do aluno.')}
          ${check(!!C.analytics?.searchConsole, 'Google Search Console', C.analytics?.searchConsole ? 'Site verificado.' : 'Verifique o domínio missaotiradentes.com.br e envie o sitemap.xml.')}
          ${check(false, 'E-mail transacional (Resend)', 'Necessário para a confirmação de cadastro e os relatórios semanais chegarem aos pais.')}
          ${check(false, 'Cópia de segurança do banco', 'O plano gratuito do Supabase não guarda cópias diárias. Considere o plano Pro ou uma exportação semanal.')}
        </ul></section>
        <section class="panel"><h3>Atalhos</h3><div class="adm-links">
          ${project ? link(`https://supabase.com/dashboard/project/${project}`, 'Banco (Supabase)') : ''}
          ${link('https://app.hotmart.com/', 'Hotmart')}
          ${link('https://analytics.google.com/', 'Google Analytics')}
          ${link('https://search.google.com/search-console', 'Search Console')}
          ${link('https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fmissaotiradentes.com.br%2F', 'Velocidade do site')}
          ${link('https://search.google.com/test/rich-results?url=https%3A%2F%2Fmissaotiradentes.com.br%2F', 'Teste de dados estruturados')}
        </div>
        <h3 class="spaced">Rastrear campanhas</h3>
        <p class="muted">Use links com UTM nos anúncios e posts para saber de onde vêm as vendas no Google Analytics. Exemplo para o Instagram:</p>
        <code class="adm-code">https://missaotiradentes.com.br/?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=lancamento</code>
        </section>
      </div>`;
  }

  // ---------------- eventos ----------------
  async function click(b, d) {
    if (d.atab) { tab = d.atab; await render(); return true; }
    if (d.arefresh) { cache = {}; await render(); flash('Dados atualizados.'); return true; }
    if (d.afilter) { filter = d.afilter; await render(); return true; }
    if (d.ago) { const [t, f] = d.ago.split(':'); tab = t; if (f) filter = f; await render(); return true; }
    if (d.astudent) { await studentDetail(d.astudent); return true; }
    if (d.acsv) { csv(); return true; }
    if (d.alink) { await linkPayment(d.alink); return true; }
    if (d.aentrydel) {
      modalConfirm('Apagar este lançamento?', 'O valor sai do resultado do mês. Essa ação não pode ser desfeita.', async () => {
        try { if (!demo) await rpc('admin_finance_entry_delete', { p_id: Number(d.aentrydel) }); cache = {}; await render(); flash('Lançamento apagado.'); } catch (e) { flash(e.message); }
      });
      return true;
    }
    return false;
  }
  async function submit(e) {
    const f = e.target, kind = f.dataset.aform; if (!kind) return false;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f)), btn = f.querySelector('[type=submit]');
    if (demo) { flash('Na demonstração nada é gravado.'); return true; }
    btn.disabled = true;
    try {
      if (kind === 'entry') { await rpc('admin_finance_entry_save', { p: data }); cache = {}; await render(); flash('Lançamento registrado.'); }
      if (kind === 'note') { await rpc('admin_add_note', { p_user: f.dataset.user, p_body: data.body }); await studentDetail(f.dataset.user); flash('Anotação salva.'); }
      if (kind === 'link') { const r = await rpc('admin_link_payment', { p_transaction: f.dataset.tx, p_user: data.user }); $('#modal').close(); cache = {}; await render(); flash(r.status === 'aprovada' || r.status === 'concluida' ? 'Pagamento vinculado e acesso liberado.' : 'Pagamento vinculado.'); }
    } catch (err) { flash(err.message); btn.disabled = false; }
    return true;
  }
  document.addEventListener('input', e => {
    if (e.target.id === 'adm-search') {
      search = e.target.value; clearTimeout(submit.t);
      submit.t = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const i = $('#adm-search'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 250);
    }
  });
  document.addEventListener('change', async e => { if (e.target.id === 'adm-months') { months = Number(e.target.value); await render(); } });

  // ---------------- dados fictícios da demonstração ----------------
  const fake = (() => {
    const day = n => new Date(Date.now() - n * 86400000).toISOString();
    const names = [['Lucas Pereira', 'Ana Pereira', 'Mãe', 'Pelotas'], ['Júlia Martins', 'Carlos Martins', 'Pai', 'Porto Alegre'], ['Pedro Alves', 'Fernanda Alves', 'Mãe', 'Santa Maria'], ['Laura Costa', 'Rita Costa', 'Avó', 'Pelotas'], ['Gabriel Rocha', 'Marcos Rocha', 'Pai', 'Passo Fundo']];
    const students = () => names.map(([s, g, rel, u], i) => ({ id: 'demo-' + i, name: s, student_name: s, email: g.split(' ')[0].toLowerCase() + '@exemplo.com', status: i === 4 ? 'pending' : 'approved', unit: u,
      created_at: day(40 - i * 7), email_confirmed: i !== 3 || true, last_sign_in_at: day(i), enrolled: true, guardian_name: g, guardian_relation: rel, guardian_phone: '5399999000' + i,
      student_grade: '9º ano', student_school: 'Escola Estadual Exemplo', plan_minutes: i === 4 ? null : [40, 30, 50, 40][i], plan_days: i === 4 ? null : [1, 2, 3, 4, 5], has_pin: i !== 4, reports_active: i < 3,
      diagnostic: i !== 4, attempts: 20 - i * 4, lessons: 8 - i, avg_percent: [72, 58, 81, 44, null][i], week_minutes: [160, 45, 210, 0, 0][i], week_days: [4, 1, 4, 0, 0][i],
      last_activity: i === 4 ? null : day([0, 2, 1, 9][i]), payment: i === 4 ? null : { status: i === 1 ? 'aprovada' : 'concluida', price: 1089.9 }, notes: 0 }));
    return {
      students,
      overview: () => ({ students: { total: 5, pending: 1, approved: 4, rejected: 0, suspended: 0, new_7d: 1, new_30d: 3 },
        funnel: { signups: 9, confirmed: 8, enrolled: 6, approved: 4, diagnostic: 4, plan: 4, reports: 3 },
        activity: { active_7d: 3, inactive_7d: 1, minutes_7d: 415, attempts_7d: 23, daily: Array.from({ length: 30 }, (_, i) => ({ day: day(29 - i).slice(0, 10), students: [1, 2, 3, 2, 3, 0, 1][i % 7], minutes: 40 })) },
        signups_weekly: Array.from({ length: 12 }, (_, i) => ({ week: day(77 - i * 7).slice(0, 10), signups: [0, 1, 0, 2, 1, 0, 1, 3, 1, 2, 0, 1][i], sales: [0, 0, 0, 1, 1, 0, 0, 2, 1, 1, 0, 0][i] })),
        money: { month_sales: 2, month_net: 1900.24, month_gross: 2179.8, month_expenses: 300, in_guarantee: 1 },
        alerts: { paid_without_account: 1, leads: 1, unconfirmed: 0, refund_requests: 0, reports_failed: 0, abandoned_30d: 2 },
        system: { last_webhook: day(1), webhooks_30d: 7, last_report_sent: null, reports_pending: 0, pins: 4, pins_locked: 0 } }),
      finance: () => {
        const ms = Array.from({ length: months }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (months - 1 - i)); return d.toISOString().slice(0, 8) + '01'; });
        const months_ = ms.map((m, i) => { const s = i >= months - 3 ? [1, 2, 2][i - (months - 3)] : 0, net = s * 950.12, ex = i >= months - 3 ? 150 * (i - months + 4) : 0;
          return { month: m, sales: s, gross: s * 1089.9, net, refunds: 0, refunded_net: 0, expenses: ex, other_income: 0, result: net - ex }; });
        const tx = [['HP-1004', 'Fernanda Alves', 'demo-2', 'aprovada', 2], ['HP-1003', 'Marcos Souza', null, 'aprovada', 3], ['HP-1002', 'Carlos Martins', 'demo-1', 'concluida', 20], ['HP-1001', 'Ana Pereira', 'demo-0', 'concluida', 45]]
          .map(([t, b, u, st, n]) => ({ transaction: t, buyer: b, email: b.split(' ')[0].toLowerCase() + '@exemplo.com', user_id: u, student: u ? names[+u.slice(-1)][0] : null, status: st, approved_at: day(n), first_at: day(n), price: 1089.9, net: 950.12, payment_type: n % 2 ? 'PIX' : 'CREDIT_CARD', installments: n % 2 ? 1 : 12 }));
        return { months: months_, totals: { sales: 4, active: 4, gross: 4359.6, net: 3800.48, refunds: 0, refunded_net: 0, refund_requests: 0, expenses: 450, other_income: 0, by_payment: { CREDIT_CARD: 2, PIX: 2 } },
          transactions: tx, entries: [{ id: 1, day: day(3).slice(0, 10), kind: 'despesa', category: 'Anúncios (Meta)', description: 'Campanha de lançamento', amount: 300 }, { id: 2, day: day(20).slice(0, 10), kind: 'despesa', category: 'Hospedagem e domínio', description: 'Domínio .com.br', amount: 150 }],
          abandoned: [{ at: day(2), email: 'interessada@exemplo.com', name: 'Patrícia Lima', phone: '5553988887777' }] };
      },
      detail: () => ({ plans: [{ start_day: day(30).slice(0, 10), days: [1, 2, 3, 4, 5], minutes: 40, time: '18:00:00' }],
        weeks: Array.from({ length: 8 }, (_, i) => ({ week: day(49 - i * 7).slice(0, 10), minutes: [120, 180, 200, 90, 210, 160, 190, 140][i], days: 4, target: 200 })),
        attempts: [{ date: day(0), kind: 'practice', label: 'Frações', percent: 80 }, { date: day(1), kind: 'practice', label: 'Interpretação de texto', percent: 60 }, { date: day(9), kind: 'diagnostic', label: 'Diagnóstico', percent: 55 }],
        topics: [{ topic: 'fracoes', total: 12, correct: 9 }, { topic: 'interpretacao', total: 10, correct: 5 }, { topic: 'porcentagem', total: 6, correct: 2 }],
        mocks: [], reports: [{ week_start: day(7).slice(0, 10), status: 'sent' }], payments: [{ at: day(45), event: 'PURCHASE_APPROVED', transaction: 'HP-1001' }], audit: [], notes: [] }),
    };
  })();

  return { render, click, submit, reset: () => { cache = {}; } };
})();
