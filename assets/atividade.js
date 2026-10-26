/* Aba Atividade — lê window.CERBERO_ATIVIDADE (gerado por gerar_atividade.py).
 * Só exibe; não envia nada a lugar nenhum. Recarrega o arquivo de dados a cada 20 s. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (v == null || v === '' || isNaN(+v) ? 0 : +v);
  let MOEDA = 'BRL';
  const money = (v, sign) => {
    const s = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: MOEDA === 'USDT' ? 'USD' : MOEDA }).format(Math.abs(num(v)));
    if (!sign) return num(v) < 0 ? '−' + s : s;
    return (num(v) > 0.004 ? '+' : num(v) < -0.004 ? '−' : '') + s;
  };
  const qty = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(num(v));
  const pct = (v) => (v > 0.0004 ? '+' : v < -0.0004 ? '−' : '') + Math.abs(v * 100).toFixed(2).replace('.', ',') + '%';
  const tone = (v) => (num(v) > 0.004 ? 'pos' : num(v) < -0.004 ? 'neg' : 'zero');
  const arrow = (v) => (num(v) > 0.004 ? '▲ ' : num(v) < -0.004 ? '▼ ' : '');
  const when = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    return s < 60 ? Math.round(s) + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1).replace('.', ',') + ' h';
  };
  const kpi = (t, v, s, cls) => '<div class="kpi ' + (cls || '') + '"><div class="t">' + t + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';

  function renderObservacao(A) {
    const h = A.saude || {}, c = A.ultimo_ciclo || {};
    const idade = (Date.now() - new Date(A.status_utc).getTime()) / 1000;
    const recente = Number.isFinite(idade) && idade >= -60 && idade < 300;
    const ok = recente && A.estado === 'rodando' && !h.erros_seguidos;
    $('#live').innerHTML = '<span class="pulse ' + (ok ? '' : 'warn') + '"></span><div><b>' + esc(A.estado) +
      '</b> · ciclo ' + esc(h.ciclos) + '<br>Observador: ' + when(A.status_utc) + ' · publicação: ' + when(A.gerado_em) + '</div>';
    const avisos = [];
    const V = A.validacao || {};
    const nomes = Object.keys(V.estrategias || {});
    if (!nomes.length || !V.aprovadas) {
      avisos.push('ESTRATÉGIAS NÃO APROVADAS: ' + (nomes.length ? nomes.map((e) => e + ' (' + V.estrategias[e] + ')').join(', ')
        : 'status de validação indisponível') + '. Nenhuma tem vantagem estatística comprovada no backtest fora da amostra' +
        (V.politica === 'bloquear' ? '; o robô NÃO abre novas posições (decisão: não operar).' : '; posições do paper são só teste de infraestrutura.') +
        ' Resultados de simulação não são lucro.');
    }
    if (!recente) avisos.push('Observador sem atualização recente. Estes são os últimos dados recebidos; verifique o Mac e a conexão.');
    if (h.erros_seguidos) avisos.push('Observação degradada: ' + h.erros_seguidos + ' erros consecutivos.');
    if (h.circuito_futuros_aberto) avisos.push('Coleta de Futuros temporariamente em pausa.');
    if (window.CERBERO_FETCH_FALHOU) avisos.push('Falha ao buscar a publicação. Exibindo a última versão recebida.');
    $('#alert').hidden = !avisos.length; $('#alert').textContent = avisos.join(' ');
    $('#alert').classList.toggle('reprovado', !V.aprovadas);
    const P = A.paper;
    $('.brand p').textContent = P ? 'Teste em papel · Futuros USD-M · dinheiro fictício · nenhuma ordem real'
      : 'Observação somente leitura · hipóteses não validadas · sem ordens ou posições';
    const f = A.financeiro || {};
    const capital = f.capital_referencia == null || !f.moeda ? '—' :
      new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 8}).format(f.capital_referencia) + ' ' + esc(f.moeda);
    $('#hero').innerHTML = kpi('Capital de referência', capital, 'valor fictício configurado para a sessão', 'accent') +
      (P ? kpi('Patrimônio fictício', money(P.patrimonio) + ' USDT', 'saldo ' + money(P.saldo) + ' · margem em uso ' + money(P.margem_usada)) +
        kpi('Lucro / prejuízo', '<span class="' + tone(num(P.pnl_realizado) + num(P.pnl_aberto)) + '">' + money(num(P.pnl_realizado) + num(P.pnl_aberto), true) + '</span>',
          'realizado ' + money(P.pnl_realizado, true) + ' · aberto ' + money(P.pnl_aberto, true) + ' · após taxas') +
        kpi('Operações fechadas', (P.metricas || {}).operacoes ?? 0, 'acerto ' + ((P.metricas || {}).win_rate_pct ?? '—') + '% · PF ' + ((P.metricas || {}).profit_factor ?? '—')) +
        kpi('Drawdown máx.', ((P.metricas || {}).drawdown_max_pct ?? 0) + '%', P.kill_switch ? 'KILL SWITCH ATIVO' : 'suspende em 8%')
        : kpi('Lucro / prejuízo', 'Não calculado', 'observador sem operações ou posições')) +
      kpi('Contratos monitorados', c.contratos_operacionais ?? '—', 'Futuros USD-M') +
      kpi('Cobertura', (c.cobertura_pct ?? '—') + '%', 'cotações disponíveis') +
      kpi('Oportunidades teóricas', h.oportunidades_total ?? '—', 'total nesta sessão; não são operações') +
      kpi('Elegíveis no ciclo', c.elegiveis_novas ?? '—', 'hipóteses após filtros');
    $('#small').innerHTML = kpi('Analisados', c.analisados ?? '—', 'último ciclo') +
      kpi('Aprovados nos filtros', c.aprovados_filtros ?? '—') +
      kpi('Erros consecutivos', h.erros_seguidos ?? '—') + kpi('Erros totais', h.erros_total ?? '—') +
      kpi('Cobertura Spot', (h.spot_ultima_cobertura_pct ?? '—') + '%', when(h.spot_ultima_utc)) +
      kpi('Último ciclo saudável', when(h.ultimo_ciclo_ok_utc));
    const L = A.intraday_lab;
    if (L) {
      const cp = (L.carteiras || {}).pesquisa || {}, cv = (L.carteiras || {}).viabilidade || {};
      const aprov = Object.values(L.estrategias || {}).filter((v) => v === 'experimental-paper').length;
      $('#small').innerHTML += kpi('Intraday lab', esc(L.estado), (L.analises_5m ?? 0) + ' análises de 5 min · ' + (L.moedas_universo ?? 0) + ' moedas') +
        kpi('Lab: carteira 5.000', money(cp.patrimonio) + ' USDT', (cp.operacoes ?? 0) + ' operações · ' + cp.posicoes + ' abertas') +
        kpi('Lab: carteira 230', money(cv.patrimonio) + ' USDT', (cv.operacoes ?? 0) + ' operações · ' + cv.posicoes + ' abertas') +
        kpi('Lab: sinais', L.sinais_total ?? 0, aprov ? aprov + ' estratégia(s) em teste' : 'todas reprovadas na triagem: não opera') +
        kpi('Lab: sombra (hipotético)', (L.sombra || {}).operacoes ?? 0, 'R médio ' + ((L.sombra || {}).r_medio ?? '—') + ' · não é lucro');
    }
    const H2 = A.h2;
    if (H2) {
      const hp = (H2.carteiras || {}).pesquisa || {}, hv = (H2.carteiras || {}).viabilidade || {};
      $('#small').innerHTML += kpi('H2 semanal', esc(H2.estado), 'exposição máx. ' + (H2.exposicao_max ?? '—') + 'x · próxima ' + when(H2.proxima_avaliacao_utc)) +
        kpi('H2: carteira 5.000', money(hp.patrimonio) + ' USDT', ((hp.resultado_pct ?? 0) >= 0 ? '+' : '') + (hp.resultado_pct ?? 0) + '% · ' + hp.posicoes + ' posições' + (hp.kill_switch ? ' · KILL SWITCH' : '')) +
        kpi('H2: carteira 230', money(hv.patrimonio) + ' USDT', (hv.inviabilidades ? hv.inviabilidades + ' semana(s) inviável(is) pelo mínimo da Binance' : hv.posicoes + ' posições'));
    }
    const CB = A.cerebro;
    if (CB) {
      $('#small').innerHTML += kpi('Cérebro: 16 famílias', CB.familias_no_laco + ' no laço', CB.familias_nao_iniciadas + ' ainda não iniciadas') +
        kpi('Agentes de IA', CB.agentes_instalados + ' instalados', CB.agentes_no_laco_de_decisao + ' decidem · ' + CB.agentes_consultivos + ' só consultivos');
    }
    const P3 = A.cerebro_p3;
    if (P3) {
      const fv = Object.values(P3.fontes || {}), ok = fv.filter((f) => f.ok === true).length, pend = fv.filter((f) => f.situacao === 'pendente').length;
      const esp = Object.values(P3.especialistas || {}).filter((e) => e.ativo).length;
      const acion = Object.entries(P3.agentes || {}).filter(([, v]) => v.acionamentos_24h).map(([k, v]) => k + ' ' + v.acionamentos_24h);
      const mod = Object.entries(P3.modelos || {}).map(([k, v]) => k + ': ' + (v === 'disponivel' ? 'conectado' : (v || '?').replace('_', ' '))).join(' · ');
      $('#small').innerHTML += kpi('Cérebro P3', esc(P3.estado), 'observação · ' + (P3.ciclos ?? 0) + ' ciclos · ' + when(P3.atualizado_utc)) +
        kpi('Fontes de dados', ok + ' funcionando', pend + ' pendentes de configuração' + (fv.some((f) => f.ok === false) ? ' · há falhas' : '')) +
        kpi('Especialistas Python', esp + ' ativos', (P3.mensagens_24h ?? 0) + ' mensagens no barramento em 24 h') +
        kpi('Agentes acionados (24 h)', acion.length, esc(acion.join(', ') || 'nenhum')) +
        kpi('Modelos de linguagem', 'US$ ' + (P3.custo_hoje_usd ?? 0).toFixed(2) + ' hoje', esc(mod)) +
        kpi('Consensos (24 h)', P3.consensos_24h ?? 0, (P3.concordancias_24h ?? 0) + ' concordâncias · ' + (P3.divergencias_24h ?? 0) + ' divergências · não autorizam operação') +
        kpi('Notícias (24 h)', P3.noticias_24h ?? 0, (P3.noticias_relevantes_24h ?? 0) + ' relevantes · não verificadas') +
        kpi('Hipóteses p/ laboratório', P3.hipoteses_laboratorio ?? 0, 'aguardam pré-registro e backtest') +
        kpi('Erros do cérebro', P3.erros_recentes ?? 0, (P3.mortas ?? 0) + ' mensagens mortas · ' + (P3.erros_seguidos ?? 0) + ' ciclos seguidos com erro');
      const FS = P3.familias_status || {};
      const ft = Object.values(FS).filter((v) => v === 'IMPLEMENTADA E TESTADA').length;
      if (Object.keys(FS).length) $('#small').innerHTML += kpi('16 famílias de especialistas', ft + ' implementadas e testadas',
        Object.values(FS).filter((v) => v === 'IMPLEMENTADA NÃO VALIDADA').length + ' não validadas · ' + Object.values(FS).filter((v) => v === 'PLANEJADA' || v === 'BLOQUEADA').length + ' planejadas/bloqueadas');
      const G = P3.mercados_globais || {};
      const nomes = { SPYUSDT: 'S&P 500 (SPY)', QQQUSDT: 'Nasdaq-100 (QQQ)', IWMUSDT: 'Russell 2000 (IWM)', EWZUSDT: 'Brasil (EWZ)', XAUUSDT: 'Ouro', XAGUSDT: 'Prata',
        CLUSDT: 'Petróleo WTI', BZUSDT: 'Petróleo Brent', COPPERUSDT: 'Cobre', NATGASUSDT: 'Gás natural', USDBRLUSDT: 'USD/BRL', BTCDOMUSDT: 'Dominância BTC',
        NVDAUSDT: 'Nvidia', MSTRUSDT: 'MicroStrategy', COINUSDT: 'Coinbase' };
      Object.entries(nomes).forEach(([k, n]) => { const x = G[k]; if (!x) return;
        $('#small').innerHTML += kpi(n, money(x.preco), ((x.var_24h_pct ?? 0) >= 0 ? '+' : '') + (x.var_24h_pct ?? '—') + '% 24 h · ' +
          (x.subjacente_aberto ? 'mercado aberto' : 'mercado fechado: indicativo') + ' · proxy Binance, só observação'); });
      const F = G.fred || {};
      const fn = { VIXCLS: 'VIX', DGS10: 'Treasury 10 anos', DTWEXBGS: 'Dólar amplo (Fed)', SP500: 'S&P 500 oficial', DCOILWTICO: 'WTI oficial', DEXBZUS: 'BRL por USD oficial' };
      Object.entries(fn).forEach(([k, n]) => { const x = F[k]; if (x) $('#small').innerHTML += kpi(n, x.valor, 'FRED · dado oficial atrasado de ' + esc(x.data || '—')); });
      const C = G.cripto || {};
      if (C.contratos_elegiveis) $('#small').innerHTML += kpi('Cripto: todos os perpétuos', C.contratos_elegiveis + ' monitorados',
        (C.pct_em_alta_24h ?? '—') + '% em alta em 24 h · ' + (C.liquidos ?? 0) + ' com liquidez suficiente');
    }
    const N = A.noite;
    if (N && N.fim_utc) {
      $('#small').innerHTML += kpi('Relatório da noite', (N.horas ?? '—') + ' h', when(N.inicio_utc) + ' → ' + when(N.fim_utc)) +
        kpi('Noite: operações simuladas', N.operacoes ?? 0, (N.fechamentos_sombra_hipotetica ?? 0) + ' fechamentos hipotéticos da sombra (não é lucro)') +
        kpi('Noite: sinais', N.sinais_lab ?? 0, (N.oportunidades_observador ?? 0) + ' oportunidades teóricas no observador') +
        kpi('Noite: IA gratuita', (N.chamadas_ia ?? 0) + ' chamadas', 'custo US$ ' + (N.custo_ia_usd ?? 0).toFixed(2)) +
        kpi('Noite: erros e reinícios', (N.erros ?? 0) + ' erros', (N.reinicios ?? 0) + ' reinícios de serviço');
    }
    $('#chart').closest('section').hidden = true;
    if (P) renderPaper(P); else $('#ops').closest('.grid2').style.display = 'none';
    $('#dec').previousElementSibling.querySelector('h2').textContent = 'Sinais hipotéticos recentes';
    $('#decNote').textContent = 'Até 100 registros · valores de referência · nenhuma ordem';
    $('#dec').innerHTML = (A.sinais || []).slice().reverse().map((x) => '<div class="dec"><div class="dec-h"><b>' + esc(x.simbolo) +
      '</b><span class="badge">' + esc(x.lado) + ' · ' + esc(x.estrategia) + '</span></div><p>' +
      (x.elegivel ? 'Elegível pelos filtros' : 'Descartada pelos filtros') + ' · hipótese não validada</p><div class="ind">Referência: ' +
      esc(x.preco_referencia) + ' USDT · stop teórico: ' + esc(x.stop_referencia) + ' USDT</div><small>' + when(x.instante_utc) +
      ' · validade: ' + when(x.validade_utc) + (Date.parse(x.validade_utc) < Date.now() ? ' (expirada)' : '') + '</small></div>').join('') ||
      '<div class="empty">Nenhuma oportunidade teórica registrada.</div>';
    if (P) { $('#foot').textContent = 'Teste em papel: posições fictícias simuladas com cotações públicas, taxas, spread, slippage e funding. Nenhuma ordem é enviada à Binance. As estratégias atuais foram reprovadas no backtest walk-forward (expectativa líquida negativa); o paper não comprova lucro. Publicação a cada 120 s; o Mac precisa permanecer ligado.'; return; }
    $('#foot').textContent = 'Somente leitura de cotações públicas. Hipóteses sem backtest validado; nenhuma ordem ou posição, real ou fictícia. Publicação automática a cada 120 s, consulta a cada 60 s. O Mac precisa permanecer ligado e conectado.';
  }

  function renderPaper(P) {
    MOEDA = 'USDT';
    $('#ops').closest('.grid2').style.display = '';
    const ops = (P.operacoes || []).slice().reverse();
    $('#opsNote').textContent = ops.length ? ops.length + ' eventos · mais recentes primeiro' : '';
    $('#ops').innerHTML = ops.length ? '<table><thead><tr><th>Quando</th><th>Ativo</th><th>Ação</th><th class="r">Qtd</th><th class="r">Preço</th><th class="r">Taxa</th><th class="r">Resultado</th></tr></thead><tbody>' +
      ops.map((o) => {
        const abre = o.evento === 'abertura', buy = abre === (o.lado === 'LONG');
        const acao = (abre ? 'abre ' : 'fecha ') + o.lado + (abre ? '' : ' (' + esc(o.motivo || '?') + ')');
        return '<tr><td>' + when(o.instante_utc) + '</td><td><b>' + esc(o.simbolo) + '</b><br><small class="muted">' + esc(o.estrategia) + '</small></td><td><span class="side ' + (buy ? 'buy' : 'sell') + '">' + (buy ? '↓ COMPRA' : '↑ VENDA') + '</span><br><small>' + acao + '</small></td>' +
          '<td class="r">' + qty(o.qtd) + '</td><td class="r">' + money(o.preco) + '</td><td class="r">' + money(o.taxa) + '</td><td class="r">' +
          (abre ? '<span class="muted">—</span>' : '<span class="' + tone(o.pnl_liquido) + '">' + arrow(o.pnl_liquido) + money(o.pnl_liquido, true) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty"><div><b>Nenhuma compra ou venda ainda</b>Aguardando sinal aprovado pelo gestor de risco.</div></div>';
    const pos = P.posicoes || [];
    $('#pos').innerHTML = pos.length ? '<table><thead><tr><th>Ativo</th><th class="r">Entrada</th><th class="r">Agora</th><th class="r">Stop</th><th class="r">Alvo</th><th class="r">Resultado</th></tr></thead><tbody>' +
      pos.map((x) => { const r = (x.lado === 'LONG' ? 1 : -1) * (num(x.marca) - num(x.entrada)) * num(x.qtd);
        return '<tr><td><b>' + esc(x.simbolo) + '</b> ' + esc(x.lado) + '<br><small class="muted">' + esc(x.estrategia) + '</small></td><td class="r">' + money(x.entrada) + '</td><td class="r">' + money(x.marca) +
          '</td><td class="r">' + money(x.stop) + '</td><td class="r">' + money(x.alvo) + '</td><td class="r"><span class="' + tone(r) + '">' + arrow(r) + money(r, true) + '</span></td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="empty" style="min-height:70px">Nenhuma posição aberta.</div>';
    const est = (P.metricas || {}).por_estrategia || {};
    $('#rej').previousElementSibling.querySelector('h2').textContent = 'Resultado por estratégia';
    $('#rej').innerHTML = Object.keys(est).length ? '<table><thead><tr><th>Estratégia</th><th class="r">Ops</th><th class="r">Acerto</th><th class="r">Resultado</th></tr></thead><tbody>' +
      Object.entries(est).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="r">' + esc(v.operacoes) + '</td><td class="r">' + esc(v.win_rate_pct ?? '—') + '%</td><td class="r"><span class="' + tone(v.pnl_liquido) + '">' + money(v.pnl_liquido, true) + '</span></td></tr>').join('') + '</tbody></table>'
      : '<div class="empty" style="min-height:60px">Ainda sem operações fechadas.</div>';
  }

  function render() {
    const A = window.CERBERO_ATIVIDADE;
    if (!A) { $('#hero').innerHTML = '<div class="card empty">Arquivo de dados ausente. Rode <code>python3 grafo/assets/gerar_atividade.py</code>.</div>'; return; }
    if (A.modo === 'observacao') { renderObservacao(A); return; }
    MOEDA = A.moeda || 'BRL';
    const S = A.sessao;
    if (!S || !S.status) {
      $('#hero').innerHTML = '<div class="card empty"><div><b>Nenhuma sessão paper encontrada</b>Inicie uma sessão com <code>python3 scripts/sessao_paper.py</code>.</div></div>';
      return;
    }
    const st = S.status, r = st.resumo || {};
    const cap = num(A.capital_inicial), pat = num(r.patrimonio), saldo = num(r.saldo), expo = num(r.exposicao_total);
    const total = pat - cap, totalPct = cap ? total / cap : 0;
    const custoAberto = Object.values(S.posicoes_custo || {}).reduce((a, p) => a + num(p.custo), 0);
    const naoReal = expo - custoAberto;
    const compras = S.operacoes.filter((o) => o.lado === 'COMPRA'), vendas = S.operacoes.filter((o) => o.lado !== 'COMPRA');
    const gasto = compras.reduce((a, o) => a + num(o.valor), 0), recebido = vendas.reduce((a, o) => a + num(o.valor), 0);
    const ganhos = vendas.filter((o) => num(o.resultado) > 0).length, perdas = vendas.filter((o) => num(o.resultado) < 0).length;

    // ---- estado ao vivo ----
    const FOTO = window.CERBERO_FOTO;
    const parado = st.estado !== 'rodando' && st.estado !== 'iniciando';
    const atraso = (Date.now() - new Date(st.instante_utc).getTime()) / 1000;
    const atrasado = !FOTO && !parado && atraso > 180;
    $('#live').innerHTML = '<span class="pulse ' + (parado ? 'off' : atrasado ? 'warn' : '') + '"></span><div><b>' +
      esc({ rodando: 'Rodando', iniciando: 'Iniciando', encerrado: 'Encerrada', parado_por_risco: 'Parada pelo risco', erro: 'Erro' }[st.estado] || st.estado) +
      '</b> · ciclo ' + esc(st.ciclo) + ' · sessão ' + esc(S.id) + '<br>' + (FOTO ? 'retrato de ' + when(A.gerado_em)
        : 'motor atualizou há ' + ago(st.instante_utc) + ' · painel lido há <span id="age">' + ago(A.gerado_em) + '</span>') + '</div>';
    const avisos = [];
    if (atrasado) avisos.push('O motor não atualiza o status há ' + ago(st.instante_utc) + '. O processo pode ter parado.');
    if (FOTO) avisos.push('Retrato dos números de ' + when(A.gerado_em) + '. A página é atualizada quando uma nova versão é publicada; o bot continua rodando no Mac.');
    else if (REMOTA && (Date.now() - new Date(A.gerado_em).getTime()) / 1000 > 900)
      avisos.push('Sem novidades há ' + ago(A.gerado_em) + '. O Mac que roda o bot pode estar desligado, dormindo ou sem internet; os números abaixo são da última atualização.');
    else if (!REMOTA && (Date.now() - new Date(A.gerado_em).getTime()) / 1000 > 120)
      avisos.push('Os dados desta página foram gerados há ' + ago(A.gerado_em) + '. Para atualizar sozinho, deixe rodando no Terminal: <code>python3 grafo/assets/gerar_atividade.py --acompanhar 30</code>');
    if (st.kill_switch) avisos.push('Kill switch do gestor de risco ativo: ' + esc(st.kill_switch));
    if (st.estado === 'erro') avisos.push('Sessão terminou com erro: ' + esc(st.erro));
    $('#alert').hidden = !avisos.length;
    $('#alert').innerHTML = avisos.join('<br>');

    // ---- KPIs ----
    $('#hero').innerHTML =
      kpi('Capital inicial', money(cap), 'definido em config/simulacao.json') +
      kpi('Patrimônio atual', money(pat), 'saldo + posições a preço de mercado', 'accent') +
      kpi('Lucro / prejuízo total', '<span class="' + tone(total) + '">' + arrow(total) + money(total, true) + '</span>', '<span class="' + tone(total) + '">' + pct(totalPct) + '</span> sobre o capital inicial · já com taxas') +
      kpi('Saldo disponível', money(saldo), 'em ' + esc(MOEDA) + ', fora de posições');
    $('#small').innerHTML =
      kpi('Compras', compras.length, money(gasto) + ' gastos') +
      kpi('Vendas', vendas.length, money(recebido) + ' recebidos' + (vendas.length ? ' · ' + ganhos + ' com lucro, ' + perdas + ' com perda' : '')) +
      kpi('Resultado realizado', '<span class="' + tone(r.pnl_realizado) + '">' + money(r.pnl_realizado, true) + '</span>', 'das vendas já feitas') +
      kpi('Não realizado', '<span class="' + tone(naoReal) + '">' + money(naoReal, true) + '</span>', 'posições abertas, se vendesse agora') +
      kpi('Taxas pagas', money(r.taxas_total), 'taxa simulada ' + esc(A.config.taxa_pct) + '% por ordem') +
      kpi('Bloqueadas pelo risco', S.rejeicoes.length, 'ordens vetadas antes de executar');

    renderChart(S, cap);
    renderOps(S);
    renderPos(S, r);
    renderDec(S);
    $('#foot').innerHTML = (FOTO ? 'Retrato publicado a partir do Mac que roda o bot. ' : REMOTA ? 'Atualizado automaticamente a partir do Mac que roda o bot (a cada ~2–5 min). ' : 'Fonte: <code>' + esc(S.pasta) + '/</code> (status.json, diario.jsonl, motor.jsonl) · capital e limites de <code>config/simulacao.json</code>. ') +
      'Tudo aqui é <b>simulação paper</b> com dinheiro fictício e cotações públicas da Binance. LIVE_TRADING = ' + esc(String(st.LIVE_TRADING)) + '. ' +
      'Esta página só lê arquivos locais e não envia ordens.';
  }

  // ---- gráfico de patrimônio ----
  let chartPts = [];
  function renderChart(S, cap) {
    const el = $('#chart');
    const t0 = S.id.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
    const pts = [{ instante: t0, patrimonio: cap, inicio: true }].concat(S.historico || [])
      .map((p) => ({ t: new Date(p.instante).getTime(), v: num(p.patrimonio), p: p })).filter((p) => !isNaN(p.t));
    chartPts = pts;
    $('#chartNote').textContent = (S.historico || []).length + ' registros · 1 por ciclo enquanto o gerador está rodando';
    if (pts.length < 2) {
      el.innerHTML = '<div class="empty"><div><b>Ainda sem histórico</b>O gráfico aparece a partir do primeiro ciclo registrado.</div></div>';
      return;
    }
    const W = el.clientWidth || 800, H = el.clientHeight || 260, m = { l: 74, r: 16, t: 14, b: 26 };
    let lo = Math.min(cap, ...pts.map((p) => p.v)), hi = Math.max(cap, ...pts.map((p) => p.v));
    const pad = Math.max((hi - lo) * 0.15, cap * 0.004);
    lo -= pad; hi += pad;
    const tMin = pts[0].t, tMax = Math.max(pts[pts.length - 1].t, tMin + 60000);
    const x = (t) => m.l + ((t - tMin) / (tMax - tMin)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    const ticks = 4, yt = [], xt = [];
    for (let i = 0; i <= ticks; i++) yt.push(lo + ((hi - lo) * i) / ticks);
    for (let i = 0; i <= 4; i++) xt.push(tMin + ((tMax - tMin) * i) / 4);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join('');
    const area = path + 'L' + x(pts[pts.length - 1].t).toFixed(1) + ',' + (H - m.b) + 'L' + x(pts[0].t).toFixed(1) + ',' + (H - m.b) + 'Z';
    const hm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Patrimônio ao longo da sessão comparado ao capital inicial">' +
      '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f7bff" stop-opacity=".22"/><stop offset="1" stop-color="#8f7bff" stop-opacity="0"/></linearGradient></defs>' +
      '<g class="grid">' + yt.map((v) => '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>').join('') + '</g>' +
      '<g class="axis">' + yt.map((v) => '<text x="' + (m.l - 8) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + money(v) + '</text>').join('') +
      xt.map((t) => '<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle">' + hm(t) + '</text>').join('') + '</g>' +
      '<path class="area" d="' + area + '"/>' +
      '<line class="base" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(cap) + '" y2="' + y(cap) + '"/>' +
      '<text class="lbl-base" x="' + (W - m.r) + '" y="' + (y(cap) - 6) + '" text-anchor="end">capital inicial ' + money(cap) + '</text>' +
      '<path class="line" d="' + path + '"/>' +
      '<line class="cross" id="cross" y1="' + m.t + '" y2="' + (H - m.b) + '" visibility="hidden"/>' +
      '<circle class="dot" id="cdot" r="5" visibility="hidden"/>' +
      '<rect x="' + m.l + '" y="0" width="' + (W - m.l - m.r) + '" height="' + H + '" fill="transparent" id="hit"/></svg>';
    const svg = el.querySelector('svg'), tip = $('#tip');
    const move = (e) => {
      const b = svg.getBoundingClientRect(), mx = ((e.clientX - b.left) / b.width) * W;
      let best = pts[0];
      pts.forEach((p) => { if (Math.abs(x(p.t) - mx) < Math.abs(x(best.t) - mx)) best = p; });
      const cx = x(best.t), cy = y(best.v);
      svg.querySelector('#cross').setAttribute('x1', cx); svg.querySelector('#cross').setAttribute('x2', cx);
      svg.querySelector('#cross').setAttribute('visibility', 'visible');
      const d = svg.querySelector('#cdot'); d.setAttribute('cx', cx); d.setAttribute('cy', cy); d.setAttribute('visibility', 'visible');
      const diff = best.v - cap;
      tip.innerHTML = '<b>' + money(best.v) + '</b> <span class="' + tone(diff) + '">' + money(diff, true) + '</span><small>' +
        (best.p.inicio ? 'início da sessão (capital inicial)' : when(best.p.instante) + ' · ciclo ' + esc(best.p.ciclo)) + '</small>';
      tip.hidden = false;
      tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
    };
    const hit = svg.querySelector('#hit');
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => {
      tip.hidden = true;
      svg.querySelector('#cross').setAttribute('visibility', 'hidden');
      svg.querySelector('#cdot').setAttribute('visibility', 'hidden');
    });
  }

  function renderOps(S) {
    const ops = S.operacoes.slice().reverse();
    $('#opsNote').textContent = ops.length ? ops.length + ' operações · mais recentes primeiro' : '';
    if (!ops.length) {
      const c = S.contagem_decisoes || {}, n = Object.values(c).reduce((a, b) => a + b, 0);
      $('#ops').innerHTML = '<div class="empty"><div><b>Nenhuma compra ou venda ainda</b>' +
        'O motor analisou ' + n + ' vezes nesta sessão e decidiu: ' + Object.entries(c).map(([k, v]) => esc(k) + ' ' + v + '×').join(', ') +
        '.<br>Uma compra só acontece quando há sinal e o gestor de risco aprova.</div></div>';
      return;
    }
    $('#ops').innerHTML = '<table><thead><tr><th>Quando</th><th>Ativo</th><th>Lado</th><th class="r">Quantidade</th><th class="r">Preço</th><th class="r">Valor</th><th class="r">Taxa</th><th class="r">Resultado</th></tr></thead><tbody>' +
      ops.map((o) => {
        const buy = o.lado === 'COMPRA';
        return '<tr><td>' + when(o.instante) + '</td><td><b>' + esc(o.simbolo) + '</b></td><td><span class="side ' + (buy ? 'buy' : 'sell') + '">' + (buy ? '↓ COMPRA' : '↑ VENDA') + '</span></td>' +
          '<td class="r">' + qty(o.qtd) + '</td><td class="r">' + money(o.preco) + '</td><td class="r">' + (buy ? '−' : '+') + money(o.valor) + '</td>' +
          '<td class="r">' + money(o.taxa_cotacao) + '</td><td class="r">' + (o.resultado == null ? '<span class="muted">—</span>' : '<span class="' + tone(o.resultado) + '">' + arrow(o.resultado) + money(o.resultado, true) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderPos(S, r) {
    const pos = r.posicoes || {}, ks = Object.keys(pos);
    $('#pos').innerHTML = ks.length ? '<table><thead><tr><th>Ativo</th><th class="r">Quantidade</th><th class="r">Custo</th><th class="r">Stop ref.</th></tr></thead><tbody>' +
      ks.map((s) => '<tr><td><b>' + esc(s) + '</b></td><td class="r">' + qty(pos[s].qtd) + '</td><td class="r">' + money((S.posicoes_custo[s] || {}).custo) + '</td><td class="r">' +
        (pos[s].stop_referencia && pos[s].stop_referencia !== 'None' ? money(pos[s].stop_referencia) : '—') + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="empty" style="min-height:70px">Nenhuma posição aberta. Todo o patrimônio está em saldo.</div>';
    $('#rej').innerHTML = S.rejeicoes.length ? '<table><thead><tr><th>Quando</th><th>Ativo</th><th>Motivo</th></tr></thead><tbody>' +
      S.rejeicoes.slice().reverse().map((x) => '<tr><td>' + when(x.instante) + '</td><td><b>' + esc(x.simbolo) + '</b> ' + esc(x.lado) + '</td><td style="white-space:normal">' + esc(x.acao) + ': ' + esc((x.motivos || []).join('; ')) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="empty" style="min-height:60px">Nenhuma ordem bloqueada.</div>';
  }

  function renderDec(S) {
    const c = S.contagem_decisoes || {};
    $('#decNote').innerHTML = Object.entries(c).map(([k, v]) => esc(k) + ': ' + v).join(' · ');
    const L = { ema_rapida: 'EMA rápida', ema_lenta: 'EMA lenta', rsi: 'RSI', macd_hist: 'MACD hist.', atr: 'ATR', fechamento: 'Fechamento' };
    $('#dec').innerHTML = (S.ultimas_decisoes || []).map((d) => {
      const k = String(d.decisao).toLowerCase();
      const cls = k.includes('abster') ? 'abster' : k.includes('sinal') ? 'sinal' : k.includes('execut') ? 'executada' : k.includes('rejeit') ? 'rejeitada' : k.includes('observ') ? 'observar' : '';
      return '<div class="dec"><div class="dec-h"><b>' + esc(d.simbolo) + '</b><span class="badge ' + cls + '">' + esc(d.decisao) + '</span></div>' +
        (d.motivos.length ? '<ul>' + d.motivos.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
        '<div class="ind">' + Object.entries(d.indicadores || {}).map(([n, v]) => '<span>' + esc(L[n] || n) + ' <b>' + esc(n === 'fechamento' ? money(v) : qty(v)) + '</b></span>').join('') + '</div>' +
        (d.incertezas.length ? '<small>Incertezas: ' + esc(d.incertezas.join(' · ')) + '</small>' : '') +
        '<small>' + when(d.instante) + ' · ciclo ' + esc(d.ciclo) + '</small></div>';
    }).join('') || '<div class="empty">Sem decisões registradas.</div>';
  }

  // Versão publicada: busca o JSON enviado pelo Mac (window.CERBERO_FONTE_REMOTA).
  const REMOTA = window.CERBERO_FONTE_REMOTA;
  function reloadRemote() {
    fetch(REMOTA + (REMOTA.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { window.CERBERO_FETCH_FALHOU = false; window.CERBERO_ATIVIDADE = d; render(); })
      .catch(() => { window.CERBERO_FETCH_FALHOU = true; if (window.CERBERO_ATIVIDADE) render(); if (!window.CERBERO_ATIVIDADE) $('#hero').innerHTML = '<div class="card empty">Não foi possível carregar os dados agora. Tente de novo em alguns minutos.</div>'; });
  }
  // Recarrega o arquivo de dados (funciona abrindo direto do Finder, sem servidor).
  function reload() {
    const old = $('#dataScript'), s = document.createElement('script');
    s.src = 'assets/atividade-data.js?t=' + Date.now();
    s.id = 'dataScript';
    s.onload = () => { old.remove(); render(); };
    s.onerror = () => s.remove();
    document.body.appendChild(s);
  }
  if (REMOTA) { reloadRemote(); setInterval(reloadRemote, 60000); }
  else if (window.CERBERO_FOTO) render();
  else { render(); setInterval(reload, 20000); }
  setInterval(() => { if (window.CERBERO_ATIVIDADE?.modo === 'observacao') render(); const a = $('#age'); if (a && window.CERBERO_ATIVIDADE) a.textContent = ago(window.CERBERO_ATIVIDADE.gerado_em); }, 5000);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
})();
