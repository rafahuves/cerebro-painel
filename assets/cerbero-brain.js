/* CÉRBERO BRAIN 3D — painel local do grafo de conhecimento.
 * Dados: window.CERBERO_DATA (gerado de grafo/grafo.json por gerar_dados_painel.py).
 * Sem rede e sem IA. Renderização sob demanda: só desenha quando algo muda. */
(function () {
  'use strict';

  const D = window.CERBERO_DATA;
  const stage = document.getElementById('stage');
  if (!window.THREE || !THREE.OrbitControls || !THREE.CSS2DRenderer || !D) {
    stage.innerHTML = '<div class="fatal">Não foi possível carregar o painel.<br>' +
      'Verifique se <code>grafo/assets/</code> contém <code>vendor/</code> e <code>cerbero-data.js</code> ' +
      '(gere com <code>python3 grafo/assets/gerar_dados_painel.py</code>).</div>';
    return;
  }

  const $ = (s) => document.querySelector(s);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CORE_ID = '@cerbero';
  const CORE_COLOR = '#cfc6ff';
  const hubId = (areaId) => (areaId === 'nucleo' ? CORE_ID : '@area:' + areaId);

  /* ======================= modelo ======================= */
  const AREAS = [D.nucleo].concat(D.areas);
  const areaById = new Map(AREAS.map((a) => [a.id, a]));
  const nodeById = new Map(D.nodes.map((n) => [n.id, n]));
  const LINKS = D.links.map((l, i) => Object.assign({ i: i, typed: l.relation !== 'menciona' }, l));
  const outOf = new Map(), inOf = new Map();
  D.nodes.forEach((n) => { outOf.set(n.id, []); inOf.set(n.id, []); });
  LINKS.forEach((l) => { outOf.get(l.source).push(l); inOf.get(l.target).push(l); });
  const hubToArea = new Map(AREAS.map((a) => [hubId(a.id), a]));

  const colorOf = (id) => {
    if (id === CORE_ID) return CORE_COLOR;
    if (hubToArea.has(id)) return hubToArea.get(id).cor;
    return areaById.get(nodeById.get(id).area).cor;
  };
  const labelOf = (id) => (id === CORE_ID ? 'CÉRBERO' : hubToArea.has(id) ? hubToArea.get(id).nome : nodeById.get(id).label);

  const state = {
    expanded: new Set(), hiddenAreas: new Set(),
    showTyped: true, showMention: true, rel: '*', tipo: '*',
    selected: null, labels: 'all',
  };

  function rep(id, st) {
    const n = nodeById.get(id);
    if (st.hiddenAreas.has(n.area)) return null;
    if (st.tipo !== '*' && n.tipo !== st.tipo) return null;
    return st.expanded.has(n.area) ? id : hubId(n.area);
  }
  function linkPasses(l, st) {
    if (l.typed ? !st.showTyped : !st.showMention) return false;
    return st.rel === '*' || l.relation === st.rel;
  }

  /* Calcula o que é visível: cada relação original é desenhada entre seus
   * "representantes" (o próprio nó, se a constelação estiver aberta, ou o
   * centro da constelação, se estiver recolhida). Nada é criado ou descartado. */
  function computeView(st) {
    const vis = new Set([CORE_ID]);
    D.areas.forEach((a) => { if (!st.hiddenAreas.has(a.id)) vis.add(hubId(a.id)); });
    D.nodes.forEach((n) => { if (rep(n.id, st) === n.id) vis.add(n.id); });
    const groups = new Map();
    let internal = 0;
    LINKS.forEach((l) => {
      if (!linkPasses(l, st)) return;
      const a = rep(l.source, st), b = rep(l.target, st);
      if (!a || !b) return;
      if (a === b) { internal++; return; }
      const k = a < b ? a + '|' + b : b + '|' + a;
      let g = groups.get(k);
      if (!g) { g = { a: a, b: b, links: [] }; groups.set(k, g); }
      g.links.push(l);
    });
    let individual = 0, aggregated = 0;
    groups.forEach((g) => {
      g.real = nodeById.has(g.a) && nodeById.has(g.b);
      g.typed = g.links.some((l) => l.typed);
      if (g.real) individual += g.links.length; else aggregated += g.links.length;
    });
    const realVisible = [...vis].filter((id) => nodeById.has(id)).length;
    return {
      vis: vis, groups: [...groups.values()], realVisible: realVisible,
      individual: individual, aggregated: aggregated, internal: internal,
      outside: LINKS.length - individual - aggregated - internal,
    };
  }

  /* ======================= layout fixo (determinístico) ======================= */
  const V3 = THREE.Vector3;
  const pos = new Map();
  const R_RING = 500;
  pos.set(CORE_ID, new V3(0, 0, 0));
  const areaAngle = new Map();
  D.areas.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / D.areas.length;
    areaAngle.set(a.id, ang);
    pos.set(hubId(a.id), new V3(Math.cos(ang) * R_RING, (i % 2 ? 1 : -1) * 34, Math.sin(ang) * R_RING));
  });
  function ring(ids, center, r, start, dy) {
    ids.forEach((id, k) => {
      const t = start + (k * 2 * Math.PI) / ids.length;
      pos.set(id, new V3(center.x + Math.cos(t) * r, center.y + (k % 2 ? dy : -dy), center.z + Math.sin(t) * r));
    });
  }
  D.areas.forEach((a) => {
    const c = pos.get(hubId(a.id)), ang = areaAngle.get(a.id);
    const ag = a.nos.filter((id) => nodeById.get(id).tipo === 'agente');
    const ot = a.nos.filter((id) => nodeById.get(id).tipo !== 'agente');
    ring(ag, c, 88, ang + Math.PI / 2 + (ag.length > 1 ? Math.PI / ag.length / 2 : 0), 10);
    ring(ot, c, 160, ang + Math.PI / ot.length, 18);
  });
  ring(D.nucleo.nos, pos.get(CORE_ID), 170, Math.PI / 2 + Math.PI / D.areas.length, 12);

  /* ======================= cena ======================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);
  const labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.className = 'labels';
  stage.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 9000);
  const VIEW_DIR = new V3(0, 0.86, 0.5).normalize();
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;           // sem loop contínuo
  controls.screenSpacePanning = true;
  controls.zoomSpeed = 0.9;
  controls.rotateSpeed = 0.6;
  controls.minDistance = 60;
  controls.maxDistance = 3400;

  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    });
  }
  controls.addEventListener('change', requestRender);

  function tex(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    draw(c.getContext('2d'), 64);
    return new THREE.CanvasTexture(c);
  }
  const TEX_GLOW = tex((g, r) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.16, 'rgba(255,255,255,.5)');
    gr.addColorStop(0.42, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const TEX_DOT = tex((g, r) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.6, 'rgba(255,255,255,.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.5, 0, Math.PI * 2); g.fill();
  });
  const TEX_RING = tex((g, r) => {
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3.2;
    g.beginPath(); g.arc(r, r, r * 0.8, 0, Math.PI * 2); g.stroke();
  });
  const TEX_RING_DASH = tex((g, r) => {
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.4; g.setLineDash([7, 9]);
    g.beginPath(); g.arc(r, r, r * 0.86, 0, Math.PI * 2); g.stroke();
  });
  const TEX_DIAMOND = tex((g, r) => {
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.moveTo(r, r * 0.55); g.lineTo(r * 1.45, r); g.lineTo(r, r * 1.45); g.lineTo(r * 0.55, r); g.closePath(); g.fill();
  });

  // Céu estrelado estático (semente fixa → sempre igual).
  (function stars() {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const N = 900, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, rad = 1800 + rnd() * 2400, q = Math.sqrt(1 - u * u);
      arr[i * 3] = q * Math.cos(t) * rad; arr[i * 3 + 1] = u * rad; arr[i * 3 + 2] = q * Math.sin(t) * rad;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, color: 0x8b9be0, transparent: true, opacity: 0.55, depthWrite: false,
    })));
  })();

  function glowSprite(texture, size, color, opacity) {
    const m = new THREE.SpriteMaterial({
      map: texture, color: new THREE.Color(color), transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sp = new THREE.Sprite(m);
    sp.scale.set(size, size, 1);
    return sp;
  }

  // Nebulosas suaves atrás de cada constelação (estáticas).
  const nebulae = new Map();
  AREAS.forEach((a) => {
    const id = hubId(a.id);
    const neb = glowSprite(TEX_GLOW, a.id === 'nucleo' ? 600 : 440, a.id === 'nucleo' ? '#6d5cff' : a.cor, a.id === 'nucleo' ? 0.09 : 0.075);
    neb.position.copy(pos.get(id));
    neb.renderOrder = -2;
    scene.add(neb);
    nebulae.set(a.id, neb);
  });

  // Órbitas discretas das constelações abertas.
  const orbits = new Map();
  AREAS.forEach((a) => {
    const c = pos.get(hubId(a.id)), r = a.id === 'nucleo' ? 170 : 160, pts = [];
    for (let k = 0; k <= 96; k++) {
      const t = (k / 96) * Math.PI * 2;
      pts.push(new V3(c.x + Math.cos(t) * r, c.y, c.z + Math.sin(t) * r));
    }
    const loop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
      color: a.id === 'nucleo' ? CORE_COLOR : a.cor, transparent: true, opacity: 0.16, depthWrite: false,
    }));
    loop.visible = false;
    scene.add(loop);
    orbits.set(a.id, loop);
  });

  /* ---------- nós ---------- */
  const SIZE = { core: 92, hub: 46, agente: 26, comando: 14, outro: 19 };
  const VIS = new Map();

  function addVisual(id, kind) {
    const color = colorOf(id);
    const n = nodeById.get(id);
    const size = kind === 'core' ? SIZE.core : kind === 'hub' ? SIZE.hub
      : n.tipo === 'agente' ? SIZE.agente : n.tipo === 'comando' ? SIZE.comando : SIZE.outro;
    const grp = new THREE.Group();
    grp.position.copy(pos.get(id));
    const sprites = [];
    const add = (t, s, c, o) => { const sp = glowSprite(t, s, c, o); grp.add(sp); sprites.push([sp.material, o]); };
    const white = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6);
    add(TEX_GLOW, size * 1.9, color, kind === 'core' ? 1 : 0.85);
    if (n && n.tipo === 'comando') add(TEX_DIAMOND, size * 0.9, white, 1);
    else add(TEX_DOT, size * (kind === 'core' ? 0.5 : 0.55), white, 1);
    if (kind === 'core') { add(TEX_RING, size * 0.95, '#b7a8ff', 0.7); add(TEX_RING_DASH, size * 1.35, '#7f6bff', 0.45); }
    else if (kind === 'hub') add(TEX_RING_DASH, size * 1.05, color, 0.75);
    else if (n.tipo === 'agente') add(TEX_RING, size * 0.95, color, 0.85);
    else if (n.tipo === 'bloqueio') add(TEX_RING_DASH, size * 1.0, '#ff4d6d', 0.9);
    scene.add(grp);

    const el = document.createElement('div');
    el.className = 'lbl lbl-' + (kind === 'node' ? (n.tipo === 'agente' ? 'agente' : n.tipo === 'comando' ? 'comando' : 'nota') : kind);
    el.style.setProperty('--c', color);
    el.textContent = labelOf(id);
    const lbl = new THREE.CSS2DObject(el);
    lbl.position.copy(pos.get(id)).add(new V3(0, -size * 0.6, 0));
    scene.add(lbl);
    const v = { id: id, kind: kind, grp: grp, sprites: sprites, lbl: lbl, el: el, size: size, color: color };
    VIS.set(id, v);
    return v;
  }
  addVisual(CORE_ID, 'core');
  D.areas.forEach((a) => addVisual(hubId(a.id), 'hub'));
  D.nodes.forEach((n) => addVisual(n.id, 'node'));

  /* ---------- arestas (uma única malha, reconstruída a cada mudança) ---------- */
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const edgeMesh = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMat);
  edgeMesh.frustumCulled = false;
  scene.add(edgeMesh);
  const SEG = 16;
  let countLabels = [];

  function curvePoint(a, b, t, lift, out) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + lift, mz = (a.z + b.z) / 2;
    const u = 1 - t;
    out.set(u * u * a.x + 2 * u * t * mx + t * t * b.x,
      u * u * a.y + 2 * u * t * my + t * t * b.y,
      u * u * a.z + 2 * u * t * mz + t * t * b.z);
    return out;
  }

  function buildEdges(list) {
    const P = new Float32Array(list.length * SEG * 6), C = new Float32Array(list.length * SEG * 6);
    const p = new V3(), q = new V3(), ca = new THREE.Color(), cb = new THREE.Color(), c = new THREE.Color();
    let o = 0;
    list.forEach((e) => {
      const a = pos.get(e.a), b = pos.get(e.b);
      const lift = e.straight ? 0 : a.distanceTo(b) * 0.17 + 6;
      ca.set(colorOf(e.a)).multiplyScalar(e.w * 0.75);
      cb.set(colorOf(e.b)).multiplyScalar(e.w);
      for (let k = 0; k < SEG; k++) {
        const t0 = k / SEG, t1 = (k + 1) / SEG;
        curvePoint(a, b, t0, lift, p); curvePoint(a, b, t1, lift, q);
        P.set([p.x, p.y, p.z, q.x, q.y, q.z], o);
        c.copy(ca).lerp(cb, t0); C.set([c.r, c.g, c.b], o);
        c.copy(ca).lerp(cb, t1); C.set([c.r, c.g, c.b], o + 3);
        o += 6;
      }
    });
    edgeMesh.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    edgeMesh.geometry = g;
  }

  /* ======================= atualização da cena ======================= */
  let view = null;

  function neighborsOf(sel) {
    const set = new Set();
    if (!sel || !view) return set;
    view.groups.forEach((g) => {
      if (g.a === sel) set.add(g.b);
      else if (g.b === sel) set.add(g.a);
    });
    return set;
  }

  function update() {
    view = computeView(state);
    if (state.selected && !view.vis.has(state.selected)) state.selected = null;
    const sel = state.selected, nb = neighborsOf(sel);
    const focus = (id) => !sel || id === sel || nb.has(id);

    VIS.forEach((v, id) => {
      const on = view.vis.has(id);
      v.grp.visible = on;
      const f = focus(id) ? 1 : 0.16;
      v.sprites.forEach(([m, o]) => { m.opacity = o * f; });
      const major = v.kind !== 'node';
      const showLbl = on && (state.labels === 'all' || (state.labels === 'main' && (major || (sel && focus(id)))));
      v.lbl.visible = showLbl;
      v.el.classList.toggle('dim', !!sel && !focus(id));
      v.el.classList.toggle('hot', id === sel);
    });
    AREAS.forEach((a) => {
      const hidden = a.id !== 'nucleo' && state.hiddenAreas.has(a.id);
      nebulae.get(a.id).visible = !hidden;
      orbits.get(a.id).visible = !hidden && state.expanded.has(a.id);
    });

    // Linhas estruturais (agrupamento visual, não são relações do grafo).
    const list = [];
    const dimF = (x) => (sel ? x * 0.35 : x);
    D.areas.forEach((a) => {
      if (state.hiddenAreas.has(a.id)) return;
      list.push({ a: CORE_ID, b: hubId(a.id), w: dimF(0.1), straight: true });
    });
    view.vis.forEach((id) => {
      if (!nodeById.has(id)) return;
      list.push({ a: hubId(nodeById.get(id).area), b: id, w: dimF(0.07), straight: true });
    });
    // Relações originais (individuais ou agregadas).
    countLabels.forEach((l) => scene.remove(l));
    countLabels = [];
    const tmp = new V3();
    view.groups.forEach((g) => {
      const inc = sel && (g.a === sel || g.b === sel);
      let w = g.real ? (g.typed ? 0.46 : 0.15) : Math.min(0.09 + 0.03 * g.links.length, 0.42);
      if (sel) w = inc ? (g.real ? 1.0 : 0.9) : w * 0.12;
      // a cor da ponta mais forte segue o sentido da relação (origem → destino)
      const first = g.links[0];
      const fwd = rep(first.source, state) === g.a;
      list.push({ a: fwd ? g.a : g.b, b: fwd ? g.b : g.a, w: w });
      if (!g.real && g.links.length > 1) {
        const a = pos.get(g.a), b = pos.get(g.b);
        const el = document.createElement('div');
        el.className = 'cnt' + (sel && !inc ? ' dim' : '');
        el.textContent = g.links.length;
        const o = new THREE.CSS2DObject(el);
        o.position.copy(curvePoint(a, b, 0.5, a.distanceTo(b) * 0.17 + 6, tmp));
        scene.add(o);
        countLabels.push(o);
      }
    });
    buildEdges(list);
    renderHud();
    requestRender();
  }

  /* ======================= câmera ======================= */
  let tween = null;
  function flyTo(target, dist, dir) {
    const d = (dir || camera.position.clone().sub(controls.target)).clone().normalize();
    const endT = target.clone(), endP = target.clone().add(d.multiplyScalar(dist));
    if (REDUCED) {
      controls.target.copy(endT); camera.position.copy(endP); controls.update(); requestRender(); return;
    }
    const s = { t: controls.target.clone(), p: camera.position.clone(), t0: performance.now() };
    tween = s;
    const step = (now) => {
      if (tween !== s) return;
      const k = Math.min((now - s.t0) / 650, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      controls.target.lerpVectors(s.t, endT, e);
      camera.position.lerpVectors(s.p, endP, e);
      controls.update();
      if (k < 1) requestAnimationFrame(step); else tween = null;
    };
    requestAnimationFrame(step);
  }
  // Desloca o centro óptico para o espaço livre entre os painéis laterais.
  function applyViewOffset() {
    const W = innerWidth, H = innerHeight;
    const f = $('#filters'), left = f && f.offsetParent ? f.getBoundingClientRect().right : 0;
    const right = panel.hidden ? 0 : W - panel.getBoundingClientRect().left;
    const shift = W > 820 ? (left - right) / 2 : 0;
    camera.setViewOffset(W, H, -shift, W > 820 ? -24 : 0, W, H);
    requestRender();
  }
  function fitDistance(radius) {
    const free = innerWidth > 820 ? Math.max(innerWidth - 300 - (panel.hidden ? 0 : 410), 320) : innerWidth;
    const vf = (camera.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * (free / (innerHeight - 110)));
    return (radius / Math.sin(Math.min(vf, hf))) * 1.02;
  }
  function fit(dir) {
    const r = state.expanded.size ? R_RING + 150 : R_RING + 90;
    flyTo(new V3(0, 0, 0), fitDistance(r), dir || VIEW_DIR);
  }

  /* ======================= interação ======================= */
  const tip = $('#tip');
  let downAt = null;

  function pick(cx, cy) {
    const rect = renderer.domElement.getBoundingClientRect();
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    let best = null, bestD = Infinity;
    const p = new V3();
    VIS.forEach((v, id) => {
      if (!v.grp.visible) return;
      p.copy(v.grp.position).project(camera);
      if (p.z < -1 || p.z > 1) return;
      const sx = ((p.x + 1) / 2) * rect.width + rect.left, sy = ((1 - p.y) / 2) * rect.height + rect.top;
      const dist = camera.position.distanceTo(v.grp.position);
      const rPx = Math.max(9, ((v.size * 0.42) / (dist * tanH)) * (rect.height / 2));
      const d = Math.hypot(sx - cx, sy - cy);
      if (d <= rPx && d < bestD) { best = id; bestD = d; }
    });
    return best;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; tween = null; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || e.button !== 0) { downAt = null; return; }
    downAt = null;
    const id = pick(e.clientX, e.clientY);
    if (!id) { select(null); return; }
    activate(id);
  });
  let hoverId = null, moveQueued = false, lastMove = null;
  canvas.addEventListener('pointermove', (e) => {
    lastMove = e;
    if (moveQueued || e.buttons) { if (e.buttons) tip.hidden = true; return; }
    moveQueued = true;
    requestAnimationFrame(() => {
      moveQueued = false;
      const id = pick(lastMove.clientX, lastMove.clientY);
      canvas.style.cursor = id ? 'pointer' : '';
      if (id !== hoverId) {
        hoverId = id;
        if (id) {
          const n = nodeById.get(id);
          tip.innerHTML = esc(labelOf(id)) + '<small>' + (n ? esc(n.tipo) + ' · ' + esc(areaById.get(n.area).nome)
            : id === CORE_ID ? 'núcleo central' : 'constelação · ' + (state.expanded.has(hubToArea.get(id).id) ? 'clique para selecionar' : 'clique para abrir')) + '</small>';
        }
        tip.hidden = !id;
      }
      if (id) { tip.style.left = lastMove.clientX + 'px'; tip.style.top = lastMove.clientY + 'px'; }
    });
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; hoverId = null; });

  // Clique: constelação recolhida → abre; já aberta e selecionada → recolhe; nó → seleciona.
  function activate(id) {
    if (hubToArea.has(id)) {
      const a = hubToArea.get(id);
      if (!state.expanded.has(a.id)) state.expanded.add(a.id);
      else if (state.selected === id) state.expanded.delete(a.id);
    }
    select(id);
  }

  function select(id, opts) {
    state.selected = id;
    update();
    renderPanel();
    if (id && opts && opts.fly) {
      const isNode = nodeById.has(id);
      flyTo(pos.get(id), isNode ? 520 : id === CORE_ID ? fitDistance(R_RING + 120) : 620);
    }
  }

  // Abre a constelação do nó (se preciso) e o seleciona — usado pela busca e pelo painel.
  function goTo(id) {
    if (nodeById.has(id)) {
      const n = nodeById.get(id);
      state.hiddenAreas.delete(n.area);
      if (state.tipo !== '*' && state.tipo !== n.tipo) { state.tipo = '*'; $('#fTipo').value = '*'; }
      state.expanded.add(n.area);
      renderAreaList();
    } else if (hubToArea.has(id)) {
      state.hiddenAreas.delete(hubToArea.get(id).id);
      renderAreaList();
    }
    select(id, { fly: true });
  }

  /* ======================= painel lateral ======================= */
  const panel = $('#panel'), body = $('#panelBody');
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function md(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  const chip = (txt, cls, color) => '<span class="chip ' + (cls || '') + '"' + (color ? ' style="--c:' + color + '"' : '') + '>' + esc(txt) + '</span>';
  const itemLink = (id, inner) => '<li data-go="' + esc(id) + '">' + inner + '</li>';

  function connList(list, dirOut) {
    if (!list.length) return '<p class="none">Nenhuma.</p>';
    const byRel = new Map();
    list.forEach((l) => { const k = l.relation; if (!byRel.has(k)) byRel.set(k, []); byRel.get(k).push(l); });
    const rels = [...byRel.keys()].sort((a, b) => (a === 'menciona') - (b === 'menciona') || a.localeCompare(b));
    return rels.map((r) => '<div class="grp-title"><code>' + esc(r) + '</code> · ' + byRel.get(r).length + '</div><ul class="conn">' +
      byRel.get(r).map((l) => {
        const other = dirOut ? l.target : l.source, n = nodeById.get(other);
        const shown = linkPasses(l, state) && rep(other, state);
        return itemLink(other, '<span class="dot" style="--c:' + colorOf(other) + '"></span>' +
          '<span class="arrow">' + (dirOut ? '→' : '←') + '</span><span class="tgt">' + esc(n.label) + '</span>' +
          (shown ? '' : '<span class="hidden-note">oculta pelo filtro</span>'));
      }).join('') + '</ul>').join('');
  }

  function stateIcon(ok) { return ok === true ? '<span class="i-ok">✓</span>' : ok === false ? '<span class="i-bad">✕</span>' : '<span class="i-neu">•</span>'; }

  function nodePanel(n) {
    const a = areaById.get(n.area), d = n.detalhes, c = a.cor;
    const out = outOf.get(n.id), inn = inOf.get(n.id);
    const isAgent = n.tipo === 'agente';
    const badges = [];
    if (isAgent) badges.push(chip(D.agentes_instalados.includes(n.id) ? 'agente instalado' : 'agente sem definição', D.agentes_instalados.includes(n.id) ? 'ok' : 'bad'));
    if (d.meta.status) badges.push(chip('status: ' + d.meta.status, d.meta.status === 'nao-validada' ? 'warn' : ''));
    if (d.meta.modo) badges.push(chip('modo: ' + d.meta.modo, d.meta.modo === 'bloqueado' ? 'bad' : ''));
    let h = '<div class="p-head"><div class="orb" style="--c:' + c + '"></div><div><h3>' + esc(n.label) + '</h3><div class="chips">' +
      chip(n.tipo, 'c', c) + chip(a.nome, 'c', c) + badges.join('') + '</div></div></div>';
    h += '<h4>Descrição</h4>' + (d.descricao.filter(Boolean).length ? d.descricao.filter(Boolean).map((p) => '<p>' + md(p) + '</p>').join('') : '<p class="none">Não declarada no arquivo de origem.</p>');
    h += '<h4>' + (isAgent ? 'Responsabilidades' : 'Conteúdo registrado') + '</h4>' +
      (d.responsabilidades.length ? '<ul class="bul">' + d.responsabilidades.map((r) => '<li>' + md(r) + '</li>').join('') + '</ul>' : '<p class="none">Não declarado no arquivo de origem.</p>');
    if (d.regras.length) h += '<h4>Regras de saída</h4>' + d.regras.map((p) => '<p>' + md(p) + '</p>').join('');
    if (d.ferramentas) h += '<h4>Ferramentas</h4><p><code>' + esc(d.ferramentas) + '</code></p>';
    h += '<h4>Conexões · ' + (out.length + inn.length) + '</h4><div class="mini-grid"><div><b>' + out.length + '</b><span>saídas</span></div><div><b>' + inn.length + '</b><span>entradas</span></div></div>';
    h += '<h4>Saídas (' + out.length + ')</h4>' + connList(out, true);
    h += '<h4>Entradas (' + inn.length + ')</h4>' + connList(inn, false);
    h += '<h4>Estado de implementação</h4><ul class="state">' + d.estado.map((s) =>
      '<li>' + stateIcon(s.ok) + '<div>' + esc(s.item) + '<div class="v">' + esc(s.valor) + '</div></div></li>').join('') + '</ul>';
    h += '<div class="p-actions"><button class="btn primary" data-fly="' + esc(n.id) + '">Centralizar</button>' +
      '<a class="btn" href="../' + encodeURI(n.source_file) + '" target="_blank" rel="noopener">Abrir arquivo</a></div>';
    h += '<p class="foot">Estado derivado de arquivos locais: ✓ existe · ✕ ausente/bloqueado/não validado · • informativo. Fonte: <code>' + esc(n.source_file) + '</code></p>';
    return h;
  }

  function areaPanel(a) {
    const id = hubId(a.id), members = a.nos.map((x) => nodeById.get(x));
    const set = new Set(a.nos);
    let internal = 0;
    const ext = new Map();
    LINKS.forEach((l) => {
      const s = set.has(l.source), t = set.has(l.target);
      if (s && t) internal++;
      else if (s || t) {
        const other = areaById.get(nodeById.get(s ? l.target : l.source).area);
        ext.set(other.id, (ext.get(other.id) || 0) + 1);
      }
    });
    const open = state.expanded.has(a.id);
    let h = '<div class="p-head"><div class="orb" style="--c:' + (a.id === 'nucleo' ? CORE_COLOR : a.cor) + '"></div><div><h3>' +
      (a.id === 'nucleo' ? 'CÉRBERO' : esc(a.nome)) + '</h3><div class="chips">' +
      chip(a.id === 'nucleo' ? 'núcleo central' : 'constelação', 'c', a.cor) + chip(members.length + ' nós') +
      chip(members.filter((m) => m.tipo === 'agente').length + ' agentes') + '</div></div></div>';
    if (a.id === 'nucleo') h += corePanelExtra();
    h += '<h4>Nós ' + (a.id === 'nucleo' ? 'do núcleo' : 'da constelação') + '</h4><ul class="conn">' + members.map((m) =>
      itemLink(m.id, '<span class="dot" style="--c:' + a.cor + '"></span><span class="tgt">' + esc(m.label) + '</span><span class="hidden-note">' + esc(m.tipo) + '</span>')).join('') + '</ul>';
    h += '<h4>Relações originais</h4><div class="mini-grid"><div><b>' + internal + '</b><span>internas</span></div><div><b>' +
      [...ext.values()].reduce((x, y) => x + y, 0) + '</b><span>com outras áreas</span></div></div>';
    if (ext.size) {
      h += '<ul class="conn" style="margin-top:8px">' + [...ext.entries()].sort((x, y) => y[1] - x[1]).map(([aid, k]) =>
        itemLink(hubId(aid), '<span class="dot" style="--c:' + (aid === 'nucleo' ? CORE_COLOR : areaById.get(aid).cor) + '"></span><span class="tgt">' +
          esc(aid === 'nucleo' ? 'Núcleo CÉRBERO' : areaById.get(aid).nome) + '</span><span class="hidden-note">' + k + ' relações</span>')).join('') + '</ul>';
    }
    h += '<div class="p-actions"><button class="btn primary" data-toggle="' + esc(a.id) + '">' + (open ? 'Recolher nós' : 'Expandir nós') + '</button>' +
      '<button class="btn" data-fly="' + esc(id) + '">Centralizar</button></div>';
    h += '<p class="foot">' + (a.id === 'nucleo' ? 'O núcleo e as constelações' : 'As constelações') +
      ' são agrupamentos visuais definidos em <code>grafo/assets/gerar_dados_painel.py</code>; não são nós nem relações de <code>grafo.json</code>.</p>';
    return h;
  }

  function corePanelExtra() {
    const tipos = new Map();
    D.nodes.forEach((n) => tipos.set(n.tipo, (tipos.get(n.tipo) || 0) + 1));
    const agentsWithNode = D.agentes_instalados.filter((x) => nodeById.has(x) && nodeById.get(x).tipo === 'agente');
    let h = '<h4>Visão geral</h4><div class="mini-grid"><div><b>' + D.nodes.length + '</b><span>nós em grafo.json</span></div><div><b>' + LINKS.length +
      '</b><span>relações</span></div><div><b>' + LINKS.filter((l) => l.typed).length + '</b><span>tipadas</span></div><div><b>' +
      agentsWithNode.length + '/' + D.agentes_instalados.length + '</b><span>agentes com nota</span></div></div>';
    h += '<h4>Tipos de nó</h4><div class="chips">' + [...tipos.entries()].sort((a, b) => b[1] - a[1]).map(([t, k]) => chip(t + ' · ' + k)).join('') + '</div>';
    h += '<h4>Agentes instalados (.claude/agents)</h4><ul class="conn">' + D.agentes_instalados.map((x) => {
      const n = nodeById.get(x);
      return itemLink(x, '<span class="dot" style="--c:' + (n ? areaById.get(n.area).cor : '#888') + '"></span><span class="tgt">' + esc(x) +
        '</span><span class="hidden-note">' + (n ? esc(areaById.get(n.area).nome) : 'sem nó no grafo') + '</span>');
    }).join('') + '</ul>';
    h += '<h4>Constelações</h4><ul class="conn">' + D.areas.map((a) => itemLink(hubId(a.id), '<span class="dot" style="--c:' + a.cor + '"></span><span class="tgt">' +
      esc(a.nome) + '</span><span class="hidden-note">' + a.nos.length + ' nós</span>')).join('') + '</ul>';
    h += '<p class="foot">Graphify continua apenas como ferramenta de consulta estrutural (ex.: <code>graphify explain "gestor-risco" --graph grafo/grafo.json</code>). Este painel não executa Graphify nem chama IA.</p>';
    return h;
  }

  function renderPanel() {
    const id = state.selected;
    if (!id) {
      if (!panel.hidden) { panel.hidden = true; document.body.classList.remove('panel-open'); applyViewOffset(); }
      return;
    }
    body.innerHTML = nodeById.has(id) ? nodePanel(nodeById.get(id)) : areaPanel(hubToArea.get(id));
    const was = panel.hidden;
    panel.hidden = false;
    document.body.classList.add('panel-open');
    body.scrollTop = 0;
    if (was) applyViewOffset();
  }
  body.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'), fly = e.target.closest('[data-fly]'), tg = e.target.closest('[data-toggle]');
    if (go) goTo(go.dataset.go);
    else if (fly) select(fly.dataset.fly, { fly: true });
    else if (tg) {
      const aid = tg.dataset.toggle;
      if (state.expanded.has(aid)) state.expanded.delete(aid); else state.expanded.add(aid);
      update(); renderPanel(); renderAreaList();
    }
  });
  $('#panelClose').addEventListener('click', () => select(null));

  /* ======================= filtros e HUD ======================= */
  function renderAreaList() {
    $('#areaList').innerHTML = AREAS.map((a) => {
      const off = a.id !== 'nucleo' && state.hiddenAreas.has(a.id), open = state.expanded.has(a.id);
      return '<li class="' + (off ? 'off' : '') + '"><span class="dot" style="--c:' + (a.id === 'nucleo' ? CORE_COLOR : a.cor) + '"></span>' +
        '<button class="name" data-area="' + a.id + '">' + esc(a.id === 'nucleo' ? 'Núcleo CÉRBERO' : a.nome) + '</button>' +
        '<span class="n">' + a.nos.length + '</span>' +
        '<button class="exp' + (open ? ' on' : '') + '" data-exp="' + a.id + '" title="' + (open ? 'Recolher nós' : 'Expandir nós') + '">' + (open ? '◉' : '○') + '</button>' +
        (a.id === 'nucleo' ? '<span style="width:22px"></span>' : '<button class="eye" data-eye="' + a.id + '" title="' + (off ? 'Mostrar' : 'Ocultar') + ' constelação">' + (off ? '◌' : '●') + '</button>') + '</li>';
    }).join('');
    const full = AREAS.every((a) => state.expanded.has(a.id)), simple = state.expanded.size === 0;
    document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'full' && full) || (b.dataset.mode === 'simple' && simple)));
    $('#modeHint').textContent = simple ? 'Apenas núcleos. Clique numa constelação para expandir seus agentes e nós.'
      : full ? 'Todos os nós e relações de grafo.json visíveis.' : state.expanded.size + ' de ' + AREAS.length + ' constelações abertas.';
  }
  $('#areaList').addEventListener('click', (e) => {
    const nm = e.target.closest('[data-area]'), ex = e.target.closest('[data-exp]'), ey = e.target.closest('[data-eye]');
    if (nm) { goTo(hubId(nm.dataset.area)); return; }
    if (ex) { const a = ex.dataset.exp; if (state.expanded.has(a)) state.expanded.delete(a); else state.expanded.add(a); }
    if (ey) { const a = ey.dataset.eye; if (state.hiddenAreas.has(a)) state.hiddenAreas.delete(a); else state.hiddenAreas.add(a); }
    renderAreaList(); update(); renderPanel();
  });
  document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => {
    state.expanded = b.dataset.mode === 'full' ? new Set(AREAS.map((a) => a.id)) : new Set();
    renderAreaList(); update(); renderPanel(); fit();
  }));

  (function initFilters() {
    const typed = LINKS.filter((l) => l.typed).length;
    $('#cTyped').textContent = typed;
    $('#cMention').textContent = LINKS.length - typed;
    const rc = new Map();
    LINKS.forEach((l) => rc.set(l.relation, (rc.get(l.relation) || 0) + 1));
    $('#fRel').innerHTML = '<option value="*">Todos os tipos de relação (' + rc.size + ')</option>' +
      [...rc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r, k]) => '<option value="' + esc(r) + '">' + esc(r) + ' · ' + k + '</option>').join('');
    const tc = new Map();
    D.nodes.forEach((n) => tc.set(n.tipo, (tc.get(n.tipo) || 0) + 1));
    $('#fTipo').innerHTML = '<option value="*">Todos os tipos de nó (' + tc.size + ')</option>' +
      [...tc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, k]) => '<option value="' + esc(t) + '">' + esc(t) + ' · ' + k + '</option>').join('');
  })();
  $('#fTyped').addEventListener('change', (e) => { state.showTyped = e.target.checked; update(); renderPanel(); });
  $('#fMention').addEventListener('change', (e) => { state.showMention = e.target.checked; update(); renderPanel(); });
  $('#fRel').addEventListener('change', (e) => { state.rel = e.target.value; update(); renderPanel(); });
  $('#fTipo').addEventListener('change', (e) => { state.tipo = e.target.value; update(); renderPanel(); });

  function renderHud() {
    $('#sNodes').textContent = view.realVisible;
    $('#sNodesT').textContent = 'de ' + D.nodes.length + ' · +' + (view.vis.size - view.realVisible) + ' núcleos';
    $('#sLinks').textContent = view.individual + view.aggregated;
    $('#sLinksT').textContent = 'de ' + LINKS.length + ' em grafo.json';
    $('#breakdown').innerHTML =
      '<span><b>' + view.individual + '</b> individuais</span>' +
      '<span><b>' + view.aggregated + '</b> agregadas entre núcleos</span>' +
      '<span><b>' + view.internal + '</b> internas recolhidas</span>' +
      '<span><b>' + view.outside + '</b> fora dos filtros</span>';
  }

  // Verificações de integridade feitas no navegador sobre os dados carregados.
  (function integrity() {
    const ids = D.nodes.map((n) => n.id), uniq = new Set(ids).size === ids.length;
    const ends = LINKS.every((l) => nodeById.has(l.source) && nodeById.has(l.target));
    const triples = new Set(LINKS.map((l) => l.source + '\u0000' + l.target + '\u0000' + l.relation)).size === LINKS.length;
    const all = { expanded: new Set(AREAS.map((a) => a.id)), hiddenAreas: new Set(), showTyped: true, showMention: true, rel: '*', tipo: '*' };
    const fv = computeView(all);
    const fullOk = fv.individual === LINKS.length && fv.realVisible === D.nodes.length;
    const sv = computeView(Object.assign({}, all, { expanded: new Set() }));
    const simpleOk = sv.aggregated + sv.internal === LINKS.length;
    const agentsOk = D.agentes_instalados.every((a) => nodeById.has(a));
    const placed = D.nodes.every((n) => pos.has(n.id));
    const row = (ok, txt) => '<li><span class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓' : '✕') + '</span><span>' + txt + '</span></li>';
    $('#integrity').innerHTML = '<h2>Integridade</h2><ul>' +
      row(uniq && placed, D.nodes.length + ' nós únicos posicionados') +
      row(ends && triples, LINKS.length + ' relações válidas, sem duplicatas') +
      row(fullOk, 'Vista completa: ' + fv.individual + '/' + LINKS.length + ' relações individuais') +
      row(simpleOk, 'Vista simplificada: ' + (sv.aggregated + sv.internal) + '/' + LINKS.length + ' preservadas (agregadas)') +
      row(agentsOk, D.agentes_instalados.length + ' agentes de .claude/agents no grafo') +
      '</ul><small>Fonte: ' + esc(D.fonte) + ' · dados gerados em ' + esc(D.gerado_em) + '</small>';
    window.__cerbero = { state: state, computeView: computeView, data: D, checks: { uniq, ends, triples, fullOk, simpleOk, agentsOk, placed } };
    window.__cerbero.api = { activate: (id) => activate(id), goTo: (id) => goTo(id), select: (id) => select(id), pick: (x, y) => pick(x, y) };
  })();

  /* ======================= busca ======================= */
  const q = $('#q'), results = $('#results');
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const INDEX = [{ id: CORE_ID, label: 'CÉRBERO', meta: 'núcleo central', text: 'cerbero nucleo supervisor' }]
    .concat(D.areas.map((a) => ({ id: hubId(a.id), label: a.nome, meta: 'constelação', text: norm(a.nome + ' constelacao') })))
    .concat(D.nodes.map((n) => ({
      id: n.id, label: n.label, meta: n.tipo + ' · ' + areaById.get(n.area).nome,
      text: norm([n.label, n.tipo, areaById.get(n.area).nome].concat(n.detalhes.descricao).join(' ')),
    })));
  let hits = [], cur = 0;
  function search() {
    const t = norm(q.value.trim());
    if (!t) { results.hidden = true; return; }
    hits = INDEX.map((x) => {
      const l = norm(x.label);
      const score = l === t ? 0 : l.startsWith(t) ? 1 : l.includes(t) ? 2 : x.text.includes(t) ? 3 : 9;
      return [score, x];
    }).filter((s) => s[0] < 9).sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label)).slice(0, 10).map((s) => s[1]);
    cur = 0;
    results.innerHTML = hits.length ? hits.map((x, i) => '<li role="option" data-i="' + i + '" aria-selected="' + (i === cur) + '"><span class="dot" style="--c:' +
      colorOf(x.id) + '"></span>' + esc(x.label) + '<span class="meta">' + esc(x.meta) + '</span></li>').join('') : '<li class="empty">Nenhum nó encontrado.</li>';
    results.hidden = false;
  }
  function choose(i) {
    const x = hits[i];
    if (!x) return;
    results.hidden = true; q.blur();
    goTo(x.id);
  }
  q.addEventListener('input', search);
  q.addEventListener('focus', search);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      cur = (cur + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      results.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', i === cur));
    } else if (e.key === 'Enter') { choose(cur); }
    else if (e.key === 'Escape') { q.value = ''; results.hidden = true; q.blur(); }
  });
  results.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  q.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 120));

  /* ======================= barra de ferramentas ======================= */
  $('#bFit').addEventListener('click', () => fit());
  $('#bTop').addEventListener('click', () => fit(new V3(0, 1, 0.0001)));
  const LBL = [['all', 'todos'], ['main', 'principais'], ['none', 'ocultos']];
  $('#bLabels').addEventListener('click', (e) => {
    const i = (LBL.findIndex((x) => x[0] === state.labels) + 1) % LBL.length;
    state.labels = LBL[i][0];
    e.target.textContent = 'Rótulos: ' + LBL[i][1];
    update();
  });
  $('#bHelp').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });
  $('#bFilters').addEventListener('click', () => { document.body.classList.toggle('show-filters'); applyViewOffset(); });
  document.addEventListener('keydown', (e) => {
    if (e.target === q) return;
    if (e.key === '/') { e.preventDefault(); q.focus(); }
    else if (e.key === 'Escape') { select(null); $('#help').hidden = true; }
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    labelRenderer.setSize(innerWidth, innerHeight);
    applyViewOffset();
  });

  /* ======================= início ======================= */
  $('#subtitle').textContent = 'Constelação de conhecimento · ' + D.nodes.length + ' nós · ' + LINKS.length + ' relações · ' + D.agentes_instalados.length + ' agentes';
  renderAreaList();
  applyViewOffset();
  camera.position.copy(VIEW_DIR).multiplyScalar(fitDistance(R_RING + 90));
  controls.target.set(0, 0, 0);
  controls.update();
  update();
})();
