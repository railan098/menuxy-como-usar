
(() => {
  'use strict';
  const GRUPOS = window.MENUXY_GUIA || [];
  const TOPICOS = GRUPOS.flatMap(g => g.topicos.map(t => ({ ...t, grupo: g.titulo, grupoIcone: g.icone })));
  const POR_ID = Object.fromEntries(TOPICOS.map(t => [t.id, t]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TRILHAS = [
    { id: 'primeiro-dia', nome: 'Primeiro dia', icone: 'bi-flag-fill', texto: 'Deixe a loja pronta para vender: dados, cardápio, PIX e caixa.',
      topicos: ['visao-geral', 'dados-loja', 'categorias', 'produtos', 'opcionais', 'cardapio-digital', 'aparencia-cardapio', 'pix', 'entrega-bairro', 'caixa', 'pdv'] },
    { id: 'dono', nome: 'Dono ou gerente', icone: 'bi-briefcase-fill', texto: 'Tudo da loja: vendas, dinheiro, equipe, relatórios e configurações.',
      topicos: TOPICOS.map(t => t.id) },
    { id: 'caixa', nome: 'Caixa', icone: 'bi-cash-coin', texto: 'Vender no balcão, receber mesas e pedidos, abrir e fechar o caixa.',
      topicos: ['caixa', 'pdv', 'dividir-conta', 'delivery', 'notificacoes', 'clientes', 'contas-receber', 'pix'] },
    { id: 'garcom', nome: 'Garçom', icone: 'bi-cup-hot-fill', texto: 'Abrir mesa, lançar pedidos, mandar para a cozinha e dividir a conta.',
      topicos: ['mesas', 'dividir-conta', 'vender-por-peso', 'opcionais'] },
    { id: 'cozinha', nome: 'Cozinha', icone: 'bi-fire', texto: 'Ver a fila de pedidos no tablet e marcar o que ficou pronto.',
      topicos: ['cozinha', 'notificacoes', 'impressao'] },
  ].map(t => ({ ...t, topicos: t.topicos.filter(id => POR_ID[id]) }));

  // ---------- Progresso (só neste navegador) ----------
  const CHAVE = 'menuxy-como-usar:v1';
  const progresso = (() => {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
  })();
  progresso.feitos = progresso.feitos || [];
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(progresso)); } catch (e) { /* navegador sem armazenamento: o guia segue funcionando */ } };
  const feito = id => progresso.feitos.includes(id);

  // ---------- Estado ----------
  const estado = {
    topico: null,
    passo: 0,
    modo: 'ver',
    trilha: progresso.trilha && TRILHAS.find(t => t.id === progresso.trilha) ? progresso.trilha : null,
    busca: '',
    vistos: new Set(),
  };

  const normalizar = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Números do topo ----------
  $('[data-total-topicos]').textContent = TOPICOS.length;
  $('[data-total-passos]').textContent = TOPICOS.reduce((n, t) => n + t.passos.length, 0);

  function atualizarProgresso() {
    const total = TOPICOS.length, feitos = progresso.feitos.filter(id => POR_ID[id]).length;
    const p = Math.round(feitos / total * 100);
    $('[data-anel-geral]').style.setProperty('--p', p);
    $('[data-geral-num]').textContent = p + '%';
    $('[data-geral-feitos]').textContent = feitos;
    $('[data-geral-total]').textContent = total;
    renderTrilhas();
  }

  // ---------- Trilhas ----------
  function renderTrilhas() {
    $('[data-trilhas]').innerHTML = TRILHAS.map(t => {
      const n = t.topicos.filter(feito).length;
      return `<button type="button" class="trilha" role="listitem" data-trilha="${t.id}" aria-pressed="${estado.trilha === t.id}">
        <span class="trilha-icone" aria-hidden="true"><i class="bi ${t.icone}"></i></span>
        <h3>${esc(t.nome)}</h3>
        <p>${esc(t.texto)}</p>
        <span class="trilha-rodape"><span class="barra"><i style="width:${n / t.topicos.length * 100}%"></i></span>${n}/${t.topicos.length}</span>
      </button>`;
    }).join('');
  }

  function escolherTrilha(id, rolar = true) {
    estado.trilha = id;
    progresso.trilha = id; salvar();
    const t = TRILHAS.find(x => x.id === id);
    const caixa = $('[data-trilha-ativa]');
    caixa.hidden = !t;
    if (t) $('[data-trilha-ativa-nome]').textContent = 'Trilha: ' + t.nome;
    renderTrilhas();
    renderIndice();
    if (t) {
      const proximo = t.topicos.find(x => !feito(x)) || t.topicos[0];
      abrirTopico(proximo, { rolar });
    }
  }

  // ---------- Índice e busca ----------
  function visiveis() {
    const trilha = TRILHAS.find(t => t.id === estado.trilha);
    let lista = trilha ? trilha.topicos.map(id => POR_ID[id]) : TOPICOS;
    const q = normalizar(estado.busca).trim();
    if (q) {
      const palavras = q.split(/\s+/);
      lista = TOPICOS.map(t => {
        const titulo = normalizar(t.titulo), resto = normalizar([t.resumo, t.termos, t.passos.join(' '), t.dica, t.exemplo].join(' '));
        let pontos = 0;
        for (const p of palavras) {
          if (titulo.includes(p)) pontos += 3;
          else if (resto.includes(p)) pontos += 1;
          else return null;
        }
        return { t, pontos };
      }).filter(Boolean).sort((a, b) => b.pontos - a.pontos).map(x => x.t);
    }
    return lista;
  }

  function renderIndice() {
    const lista = visiveis();
    const nav = $('[data-indice]');
    if (!lista.length) {
      nav.innerHTML = `<p class="vazio">Nada encontrado para "${esc(estado.busca)}". Tente outra palavra, como "mesa", "pix" ou "senha".</p>`;
      return;
    }
    const ordenarPorGrupo = !estado.busca;
    const blocos = ordenarPorGrupo
      ? GRUPOS.map(g => ({ g, itens: lista.filter(t => t.grupo === g.titulo) })).filter(b => b.itens.length)
      : [{ g: { titulo: 'Resultados', icone: 'bi-search' }, itens: lista }];
    nav.innerHTML = blocos.map(({ g, itens }) => `<div class="grupo">
      <p class="grupo-titulo"><i class="bi ${g.icone}" aria-hidden="true"></i>${esc(g.titulo)}</p>
      ${itens.map(t => `<button type="button" class="item${feito(t.id) ? ' feito' : ''}" data-topico="${t.id}" aria-current="${estado.topico && estado.topico.id === t.id}">
        <i class="bi ${t.icone}" aria-hidden="true"></i><span>${esc(t.titulo)}</span><i class="bi bi-check-circle-fill ok" aria-label="${feito(t.id) ? 'aprendido' : ''}"></i>
      </button>`).join('')}
    </div>`).join('');
    const atual = $('.item[aria-current="true"]', nav);
    if (atual && matchMedia('(max-width: 960px)').matches) atual.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // ---------- Tópico ----------
  const img = $('[data-tela-img]');
  const tela = $('[data-tela]');
  const rolagem = $('[data-rolagem]');

  function abrirTopico(id, { rolar = false, passo = 0 } = {}) {
    const t = POR_ID[id] || TOPICOS[0];
    estado.topico = t;
    estado.vistos = new Set();
    $('[data-topico-icone]').className = 'bi ' + t.icone;
    $('[data-topico-grupo]').textContent = t.grupo;
    $('[data-topico-titulo]').textContent = t.titulo;
    $('[data-topico-resumo]').textContent = t.resumo;
    $('[data-topico-exemplo]').textContent = t.exemplo;
    $('[data-topico-dica]').textContent = t.dica;
    img.src = t.tela.img;
    img.width = t.tela.w; img.height = t.tela.h;
    img.alt = 'Tela do Menuxy: ' + t.titulo;
    rolagem.scrollTop = 0;

    $('[data-pontos]').innerHTML = t.tela.pontos.map((p, i) => p
      ? `<button type="button" class="alvo" style="left:${p.x}%;top:${p.y}%" data-ir-passo="${i}" aria-label="Passo ${i + 1}"><b>${i + 1}</b></button>`
      : '').join('');
    $('[data-passos]').innerHTML = t.passos.map((txt, i) => `<li class="passo" data-passo="${i}"><button type="button" data-ir-passo="${i}">
      <span>${esc(txt)}${t.tela.pontos[i] ? '' : '<span class="sem-marcador">Este passo acontece fora desta tela.</span>'}</span></button></li>`).join('');

    const carimbo = $('[data-carimbo]');
    carimbo.className = 'carimbo' + (feito(t.id) ? ' fixo' : '');
    $('[data-proximo-topico]').hidden = true;
    renderIndice();
    try { history.replaceState(null, '', '#t=' + t.id); } catch (e) { /* arquivo aberto sem servidor */ }
    irPasso(passo, { rolarTela: false });
    if (rolar) $('#estudio').scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth' });
  }

  function irPasso(i, { rolarTela = true } = {}) {
    const t = estado.topico;
    i = Math.max(0, Math.min(t.passos.length - 1, i));
    estado.passo = i;
    estado.vistos.add(i);
    const pratica = estado.modo === 'praticar';
    $$('.passo').forEach((li, k) => {
      li.classList.toggle('atual', k === i);
      li.classList.toggle('feito', k < i || (estado.vistos.has(k) && k !== i && k < i));
    });
    $$('[data-pontos] .alvo').forEach(b => {
      const k = +b.dataset.irPasso;
      b.classList.toggle('feito', k < i);
      b.classList.toggle('futuro', k > i);
      b.classList.toggle('oculto', pratica && k >= i);
    });
    $('[data-comanda-cont]').textContent = `${i + 1}/${t.passos.length}`;
    $('[data-anterior]').disabled = i === 0;
    const ultimo = i === t.passos.length - 1;
    const prox = $('[data-proximo]');
    prox.innerHTML = ultimo ? 'Concluir <i class="bi bi-check2" aria-hidden="true"></i>' : 'Próximo passo <i class="bi bi-arrow-right" aria-hidden="true"></i>';
    $('[data-toque]').hidden = true;

    const ponto = t.tela.pontos[i];
    const aviso = $('[data-aviso]');
    if (!ponto) aviso.textContent = 'Este passo acontece em outra tela ou no momento da venda. Leia e siga para o próximo.';
    else if (pratica) aviso.textContent = `Toque na tela onde você clicaria para: "${t.passos[i]}"`;
    else aviso.textContent = '';
    tela.classList.toggle('praticando', pratica && !!ponto);
    if (ponto && rolarTela) rolarAte(ponto);
  }

  function rolarAte(ponto) {
    const alvoY = ponto.y / 100 * tela.offsetHeight;
    const meio = rolagem.clientHeight / 2;
    if (rolagem.scrollHeight > rolagem.clientHeight) {
      rolagem.scrollTo({ top: Math.max(0, alvoY - meio), behavior: semMovimento ? 'auto' : 'smooth' });
    }
  }

  function avancar() {
    const t = estado.topico;
    if (estado.passo < t.passos.length - 1) irPasso(estado.passo + 1);
    else concluir();
  }

  function concluir() {
    const t = estado.topico;
    $$('.passo').forEach(li => li.classList.add('feito'));
    $$('[data-pontos] .alvo').forEach(b => { b.classList.add('feito'); b.classList.remove('futuro', 'oculto'); });
    const novo = !feito(t.id);
    if (novo) { progresso.feitos.push(t.id); salvar(); }
    const carimbo = $('[data-carimbo]');
    carimbo.className = 'carimbo';
    void carimbo.offsetWidth;
    carimbo.classList.add('batido');
    if (novo) mostrarToast(`<i class="bi bi-patch-check-fill" aria-hidden="true"></i> "${esc(t.titulo)}" aprendido`);
    const seguinte = proximoTopico();
    const btn = $('[data-proximo-topico]');
    if (seguinte) {
      btn.hidden = false;
      btn.innerHTML = `<span>Próximo assunto<br><strong>${esc(seguinte.titulo)}</strong></span><i class="bi bi-arrow-right-circle-fill" aria-hidden="true"></i>`;
      btn.dataset.alvo = seguinte.id;
    } else {
      btn.hidden = true;
      if (novo) mostrarToast('<i class="bi bi-trophy-fill" aria-hidden="true"></i> Você terminou esta trilha!');
    }
    atualizarProgresso();
    renderIndice();
  }

  function proximoTopico() {
    const lista = visiveis();
    const i = lista.findIndex(t => t.id === estado.topico.id);
    const depois = lista.slice(i + 1).concat(lista.slice(0, i));
    return depois.find(t => !feito(t.id)) || null;
  }

  let toastTimer;
  function mostrarToast(html) {
    const el = $('[data-toast]');
    el.innerHTML = html; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------- Modo praticar: tocar onde clicaria ----------
  tela.addEventListener('click', e => {
    if (estado.modo !== 'praticar' || e.target.closest('.alvo')) return;
    const ponto = estado.topico.tela.pontos[estado.passo];
    if (!ponto) return;
    const r = tela.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    // Tolerância em pixels da tela original: uns 70 px para os lados.
    const dx = (x - ponto.x) / 100 * estado.topico.tela.w, dy = (y - ponto.y) / 100 * estado.topico.tela.h;
    const acertou = Math.hypot(dx, dy) < 90;
    const toque = $('[data-toque]');
    toque.hidden = false;
    toque.className = 'tela-toque' + (acertou ? ' certo' : '');
    toque.style.left = x + '%'; toque.style.top = y + '%';
    void toque.offsetWidth;
    const aviso = $('[data-aviso]');
    if (acertou) {
      aviso.textContent = 'Isso mesmo!';
      setTimeout(avancar, semMovimento ? 0 : 650);
    } else {
      aviso.textContent = 'Quase. Procure o botão ou texto citado no passo; o número laranja aparece para ajudar.';
      const dica = $(`[data-pontos] .alvo[data-ir-passo="${estado.passo}"]`);
      if (dica) { dica.classList.remove('oculto'); rolarAte(ponto); }
    }
  });

  function trocarModo(modo) {
    estado.modo = modo;
    $$('[data-modo]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.modo === modo)));
    irPasso(estado.passo);
  }

  // ---------- Eventos ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-topico],[data-ir-passo],[data-trilha],[data-modo],[data-anterior],[data-proximo],[data-proximo-topico],[data-limpar-trilha],[data-ir-trilha],[data-lupa],[data-lupa-fechar],[data-zerar]');
    if (!el) return;
    if (el.matches('[data-topico]')) abrirTopico(el.dataset.topico);
    else if (el.matches('[data-ir-passo]')) {
      if (estado.modo === 'praticar' && el.classList.contains('alvo')) { avancar(); return; }
      irPasso(+el.dataset.irPasso);
    }
    else if (el.matches('[data-trilha]')) escolherTrilha(el.dataset.trilha);
    else if (el.matches('[data-ir-trilha]')) { e.preventDefault(); escolherTrilha(el.dataset.irTrilha); }
    else if (el.matches('[data-modo]')) trocarModo(el.dataset.modo);
    else if (el.matches('[data-anterior]')) irPasso(estado.passo - 1);
    else if (el.matches('[data-proximo]')) avancar();
    else if (el.matches('[data-proximo-topico]')) abrirTopico(el.dataset.alvo, { rolar: true });
    else if (el.matches('[data-limpar-trilha]')) { estado.trilha = null; progresso.trilha = null; salvar(); $('[data-trilha-ativa]').hidden = true; renderTrilhas(); renderIndice(); }
    else if (el.matches('[data-lupa]')) { $('[data-lupa-img]').src = img.src; $('[data-lupa-img]').alt = img.alt; $('[data-lupa-dialogo]').showModal(); }
    else if (el.matches('[data-lupa-fechar]')) $('[data-lupa-dialogo]').close();
    else if (el.matches('[data-zerar]')) {
      if (!confirm('Apagar o progresso salvo neste navegador?')) return;
      progresso.feitos = []; progresso.trilha = null; estado.trilha = null; salvar();
      $('[data-trilha-ativa]').hidden = true;
      atualizarProgresso(); abrirTopico(TOPICOS[0].id);
    }
  });
  $('[data-lupa-dialogo]').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  $('[data-busca]').addEventListener('input', e => { estado.busca = e.target.value; renderIndice(); });
  $('[data-busca]').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const primeiro = $('[data-indice] .item'); if (primeiro) abrirTopico(primeiro.dataset.topico); }
  });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); avancar(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); irPasso(estado.passo - 1); }
  });

  // ---------- Demonstração do topo: a comanda da mesa se explicando ----------
  (function demo() {
    const t = POR_ID.mesas;
    const alvo = $('[data-demo-alvo]'), legenda = $('[data-demo-legenda]'), num = $('[data-demo-num]');
    if (!t) { alvo.hidden = true; return; }
    $('[data-demo] img').src = t.tela.img;
    const passos = t.passos.map((txt, i) => ({ txt, p: t.tela.pontos[i], i })).filter(x => x.p);
    let k = 0, timer = null;
    const mostrar = () => {
      const { txt, p, i } = passos[k];
      alvo.style.left = p.x + '%'; alvo.style.top = p.y + '%';
      num.textContent = i + 1;
      legenda.textContent = txt;
      k = (k + 1) % passos.length;
    };
    mostrar();
    if (semMovimento) return;
    const iniciar = () => { if (!timer) timer = setInterval(mostrar, 3200); };
    const parar = () => { clearInterval(timer); timer = null; };
    new IntersectionObserver(([en]) => (en.isIntersecting ? iniciar() : parar())).observe($('.demo'));
  })();

  // ---------- Início ----------
  const deLink = (location.hash.match(/^#t=([\w-]+)/) || [])[1];
  if (estado.trilha) {
    $('[data-trilha-ativa]').hidden = false;
    $('[data-trilha-ativa-nome]').textContent = 'Trilha: ' + TRILHAS.find(t => t.id === estado.trilha).nome;
  }
  atualizarProgresso();
  abrirTopico(deLink && POR_ID[deLink] ? deLink : (estado.trilha ? (TRILHAS.find(t => t.id === estado.trilha).topicos.find(id => !feito(id)) || TOPICOS[0].id) : TOPICOS[0].id), { rolar: !!deLink });
})();
