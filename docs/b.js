(() => {
  'use strict';
  const id = 'scratch-assist-v1';
  if (window[id]?.showPanel) { window[id].showPanel(); return; }
  const isDP = /^\?D/i.test(location.search) || !!document.querySelector('[data-demo-dp]');
  const scratchImage = /\/(?:s|r|sm|rm)\.gif$/;
  const nodes = [...document.querySelectorAll('img[src]')].filter(img => {
    try { return scratchImage.test(new URL(img.getAttribute('src'), location.href).pathname) && (img.closest('table') || img.closest('[data-demo-measure]'))?.querySelector('[id^="mes"]'); }
    catch { return false; }
  });
  if (!nodes.length) { alert('TexTage\u306e\u8b5c\u9762\u30da\u30fc\u30b8\u3092\u958b\u3044\u3066\u304b\u3089\u8d77\u52d5\u3057\u3066\u304f\u3060\u3055\u3044\u3002'); return; }
  const originalVisibility = nodes.map(img => ({
    img,
    value: img.style.getPropertyValue('visibility'),
    priority: img.style.getPropertyPriority('visibility')
  }));

  // Android Chrome\u304cviewport\u6307\u5b9a\u306e\u306a\u3044\u8b5c\u9762\u3092PC\u5e45\u306b\u7e2e\u5c0f\u3057\u305f\u5834\u5408\u3060\u3051\u3001\u5b9f\u753b\u9762\u5e45\u3067\u8868\u793a\u3059\u308b\u3002
  let addedViewport = null;
  if (/Android/i.test(window.navigator?.userAgent || '') && !document.querySelector('meta[name="viewport"]')) {
    addedViewport = document.createElement('meta');
    addedViewport.name = 'viewport';
    addedViewport.content = 'width=device-width,initial-scale=1';
    document.head.append(addedViewport);
  }
  let manual = new Map(), markedArrows = new Set(), arrowOverrides = new Map();
  const defaults = { gap: 2, firstColor: 'red', start: 'up', startRight: 'up', arrows: 'end12', counts: 'off', rhythm: 'off', ammitsu: 'off' };
  const arrowGaps = { end4: 1, end6: 2 / 3, end8: 1 / 2, end12: 1 / 3, end16: 1 / 4, end24: 1 / 6, end32: 1 / 8 };
  let settings = { ...defaults };
  const past = [], future = [];
  const style = document.createElement('style');
  style.textContent = `
    #${id}-layer { position:absolute!important; top:0!important; left:0!important;
      width:0!important; height:0!important; z-index:2147483640!important; pointer-events:none!important; }
    .${id}-hit { position:absolute!important; width:36px!important; height:var(--sc-height,8px)!important;
      box-sizing:border-box!important; border-radius:4px!important; cursor:pointer!important;
      touch-action:manipulation; pointer-events:auto!important; }
    .${id}-hit::after { content:''; display:block; position:absolute; left:0; top:0;
      width:36px; height:var(--sc-line-height,5px); background:var(--sc-color); border-radius:4px;
      box-shadow:0 0 5px var(--sc-color); outline:var(--sc-early-outline,none); }
    .${id}-hit[data-forced='1']::after { outline:1px solid #fff; outline-offset:1px; }
    .${id}-arrow { position:absolute!important; width:15px!important; height:15px!important;
      padding:0!important; border:0!important; border-radius:4px; background:#13223ce6;
      text-align:center; font:bold 12px/15px system-ui,sans-serif!important;
      color:#fff!important; pointer-events:none!important; }
    .${id}-arrow[data-markable='1'] { pointer-events:auto!important; cursor:pointer!important; touch-action:manipulation; }
    .${id}-arrow[data-marked='1'] { width:20px!important; height:20px!important;
      border-radius:5px; background:#ffdc47; color:#1b2440!important;
      font:bold 16px/20px system-ui,sans-serif!important; box-shadow:0 0 6px #ffdc47; }
    .${id}-count { position:absolute!important; width:35px!important; height:18px!important;
      border:1px solid #8aa1bd!important; border-radius:5px!important; background:#15243de8!important;
      color:#fff!important; text-align:center!important; font:bold 12px/16px system-ui,sans-serif!important;
      white-space:nowrap!important; pointer-events:none!important; }
    .${id}-rhythm-count { position:absolute!important; width:66px!important; height:18px!important;
      box-sizing:border-box!important; border:1px solid var(--sc-rhythm-edge)!important;
      border-radius:5px!important; background:#15243dee!important; color:#fff!important;
      text-align:center!important; font:bold 11px/16px system-ui,sans-serif!important;
      white-space:nowrap!important; pointer-events:none!important; }
    .${id}-rhythm-count[data-tempo='1'] { width:78px!important; height:28px!important;
      white-space:pre!important; font-size:11px!important; line-height:12px!important; padding-top:1px!important; }
  `;
  document.head.append(style);
  const bar = document.createElement('div');
  bar.id = id + '-bar';
  bar.dataset.collapsed = '0';
  bar.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;bottom:16px!important;top:auto!important;right:auto!important;margin:0!important;padding:0!important;display:block!important;';
  const shadow = bar.attachShadow({ mode: 'open' });
  const arrowSelect = '<select data-setting="arrows"><option value="end4">4\u5206\u301c</option><option value="end6">6\u5206\u301c</option><option value="end8">8\u5206\u301c</option><option value="end12" selected>12\u5206\u301c</option><option value="end16">16\u5206\u301c</option><option value="end24">24\u5206\u301c</option><option value="end32">32\u5206\u301c</option><option value="all">\u5168\u76bf</option><option value="none">\u306a\u3057</option></select>';
  shadow.innerHTML = `<style>
    :host { box-sizing:border-box; -webkit-text-size-adjust:100%; text-size-adjust:100%; }
    *, *::before, *::after { box-sizing:border-box; }
    .panel { display:block; width:100%; padding:6px; border:1px solid #7287b0;
      border-radius:14px; background:#101d33f5; color:#fff;
      font:14px/1.3 system-ui,-apple-system,sans-serif; box-shadow:0 8px 28px #000a; }
    .reopen { display:none; width:64px!important; min-width:64px!important; max-width:64px!important;
      height:28px!important; min-height:28px!important; max-height:28px!important;
      margin:0!important; padding:2px 4px!important; overflow:hidden; white-space:nowrap;
      border-radius:8px; background:#243a60; color:#fff;
      box-shadow:0 3px 12px #000a; font:12px/22px system-ui,-apple-system,sans-serif!important; }
    .header { display:flex; align-items:center; gap:3px; margin-bottom:4px; }
    .title { flex:1; min-width:0; font-size:14px; font-weight:700; }
    .history { display:flex; gap:3px; }
    .history button { width:auto; min-width:32px; min-height:28px; padding:3px 4px; font-size:11px; }
    .controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; }
    .controls.sp { grid-template-columns:repeat(4,minmax(0,1fr)); }
    .controls.dp { grid-template-columns:repeat(6,minmax(0,1fr)); }
    .controls.dp label { grid-column:span 2; }
    .controls.dp label.side { grid-column:span 3; }
    @media (max-width:300px) { .controls.sp { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    label { display:block; min-width:0; font:12px/1.25 system-ui,-apple-system,sans-serif; white-space:nowrap; }
    select, button { display:block; width:100%; min-width:0; min-height:32px; margin-top:1px;
      padding:4px 5px; border:1px solid #7890bc; border-radius:8px;
      background:#243a60; color:#fff; font:14px/1.3 system-ui,-apple-system,sans-serif; }
    .actions { display:grid; grid-template-columns:1.2fr .85fr .6fr .6fr;
      grid-template-rows:30px!important; height:30px!important; max-height:30px!important;
      gap:4px; margin-top:4px; align-items:stretch; }
    .actions button { display:flex!important; align-items:center; justify-content:center;
      -webkit-appearance:none; appearance:none; width:100%; height:30px!important;
      min-height:30px!important; max-height:30px!important;
      margin:0!important; padding:2px!important; font:11px/20px system-ui,-apple-system,sans-serif!important; }
    .history button[data-action='ammitsu'] { min-width:44px; font-size:10px; }
    .history button[data-action='ammitsu'][aria-pressed='true'] { border-color:#ffdc47; color:#ffdc47; }
    .actions button[data-action='rhythm'][aria-pressed='true'] { border-color:#b788f7; box-shadow:inset 0 0 0 1px #b788f7; }
    button { margin-top:0; cursor:pointer; }
    button:disabled { opacity:.48; cursor:default; }
  </style><div class="panel"><div class="header"><strong class="title">\u76bf\u306e\u62bc\u3057\u5f15\u304d</strong>
    <div class="history"><button data-action="ammitsu" type="button" aria-pressed="false" title="\u76bf\u9921\u871c\uff1a\u65e9\u5165\u308a\u4e0a\u9650116.7ms">\u76bf\u9921\u871c</button><button data-action="undo" type="button" title="\u3072\u3068\u3064\u623b\u3059">\u623b\u3059</button><button data-action="redo" type="button" title="\u3072\u3068\u3064\u9032\u3080">\u9032\u3080</button><button data-action="reset" type="button" title="\u5909\u66f4\u3068\u8a2d\u5b9a\u3092\u521d\u671f\u72b6\u614b\u306b\u623b\u3059">\u30ea\u30bb\u30c3\u30c8</button></div></div>
    <div class="controls ${isDP ? 'dp' : 'sp'}">
      <label>\u9593\u9694<select data-setting="gap"><option value="0.5">0.5\u62cd</option><option value="1">1\u62cd</option><option value="2" selected>2\u62cd</option><option value="4">4\u62cd</option><option value="8">8\u62cd</option><option value="9999">\u306a\u3057</option></select></label>
      <label>\u59cb\u70b9<select data-setting="firstColor"><option value="red" selected>\u8d64\u2192\u9752</option><option value="blue">\u9752\u2192\u8d64</option></select></label>
      ${isDP ? '<label>\u77e2\u5370' + arrowSelect + '</label>' : '<label>\u8d64\u5411\u304d<select data-setting="start"><option value="up">\u62bc\u3059 \u2191</option><option value="down">\u5f15\u304f \u2193</option></select></label>'}
      ${isDP ? '<label class="side">1P \u8d64\u5411\u304d<select data-setting="start"><option value="up">\u62bc\u3059 \u2191</option><option value="down">\u5f15\u304f \u2193</option></select></label><label class="side">2P \u8d64\u5411\u304d<select data-setting="startRight"><option value="up">\u62bc\u3059 \u2191</option><option value="down">\u5f15\u304f \u2193</option></select></label>' : '<label>\u77e2\u5370' + arrowSelect + '</label>'}
    </div><div class="actions"><button data-action="rhythm" type="button" aria-pressed="false">\u5909\u901f\u76bf OFF</button><button data-action="counts" type="button" aria-pressed="false">\u679a\u6570 OFF</button><button data-action="hide" type="button">\u96a0\u3059</button><button data-action="close" type="button">\u7d42\u4e86</button></div></div><button class="reopen" data-action="show" type="button" aria-label="\u8a2d\u5b9a\u3092\u8868\u793a">\u8868\u793a\u3059\u308b</button>`;
  const panel = shadow.querySelector('.panel');
  const reopen = shadow.querySelector('.reopen');
  document.body.append(bar);
  const positionBar = () => {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const offset = viewport?.offsetLeft || 0;
    bar.style.setProperty('width', (bar.dataset.collapsed === '1' ? 64 : Math.max(240, Math.min(300, width - 24))) + 'px', 'important');
    bar.style.setProperty('left', offset + width / 2 + 'px', 'important');
    bar.style.setProperty('transform', 'translateX(-50%)', 'important');
  };
  positionBar();
  const setCollapsed = hidden => {
    bar.dataset.collapsed = hidden ? '1' : '0';
    panel.style.setProperty('display', hidden ? 'none' : 'block', 'important');
    reopen.style.setProperty('display', hidden ? 'block' : 'none', 'important');
    positionBar();
  };
  const layer = document.createElement('div');
  layer.id = id + '-layer';
  document.body.append(layer);
  const containerOf = img => img.closest('table') || img.closest('[data-demo-measure]');
  const stamp = (img, top = parseFloat(img.style.top)) => {
    const number = Number(containerOf(img).querySelector('[id^="mes"]').id.slice(3));
    const height = img.parentElement.getBoundingClientRect().height || 128;
    return (number - 1) * 4 + (height - 5 - top) / (height / 4);
  };
  const beatKey = beat => Math.round(beat * 1000) / 1000;
  const info = [];
  const unique = new Map();
  nodes.forEach((img, index) => {
    const beat = stamp(img), left = parseFloat(img.style.left) || 0;
    if (!Number.isFinite(beat)) return;
    const key = `${left}:${beatKey(beat)}`;
    const prior = unique.get(key);
    // MSS\u306e\u4e2d\u9593\u70b9\u3084\u5c0f\u7bc0\u5883\u754c\u306f\u540c\u3058\u6642\u523b\u306e\u753b\u50cf\u304c\u91cd\u8907\u3059\u308b\u3002
    if (prior) {
      if (parseFloat(prior.img.style.top) < 0 && parseFloat(img.style.top) >= 0) prior.img = img;
      if (/\/(?:sm|rm)\.gif$/.test(img.getAttribute('src'))) prior.kind = 'mss';
      return;
    }
    const note = { img, index, key, beat, left, kind: /\/(?:sm|rm)\.gif$/.test(img.getAttribute('src')) ? 'mss' : 'normal' };
    unique.set(key, note); info.push(note);
  });
  // \u9577\u76bf\u306e\u5e2f\uff08ls.gif\uff09\u306e\u4e21\u7aef\u3092\u7d50\u3073\u3001\u62cd\u6570\u8a2d\u5b9a\u306b\u3088\u308b\u9014\u4e2d\u30ea\u30bb\u30c3\u30c8\u3092\u9632\u3050\u3002
  const links = new Set();
  for (const strip of document.querySelectorAll('img[src]')) {
    let path;
    try { path = new URL(strip.getAttribute('src'), location.href).pathname; } catch { continue; }
    if (!/\/l[rs]\.gif$/.test(path) || !containerOf(strip)) continue;
    const top = parseFloat(strip.style.top), height = parseFloat(strip.style.height);
    const left = (parseFloat(strip.style.left) || 0) - 2;
    if (!Number.isFinite(top + height)) continue;
    const low = `${left}:${beatKey(stamp(strip, top + height - 4))}`;
    const high = `${left}:${beatKey(stamp(strip, top - 4))}`;
    if (unique.has(low) && unique.has(high)) links.add(`${low}>${high}`);
  }
  // TexTage\u306e\u76bf\u306f1P\u304cleft=0\u30012P\u304cleft=91\u307e\u305f\u306f98\u3002\u6a21\u64ecDP\u306f\u5148\u884c\u3059\u308bSP\u4f8b\u3068\u3082\u5206\u3051\u308b\u3002
  const sides = new Map();
  for (const n of info) {
    const side = (containerOf(n.img).hasAttribute('data-demo-dp') ? 'demo-' : '') + (n.left >= 50 ? 'right' : 'left');
    if (!sides.has(side)) sides.set(side, []);
    sides.get(side).push(n);
  }
  function edgeType(a, b) {
    if (!a || !b) return null;
    if (links.has(`${a.key}>${b.key}`)) return 'long';
    const delta = b.beat - a.beat;
    // \u8a31\u5bb9\u7bc4\u56f2\u304c\u91cd\u306a\u308b24\u5206\u30fb32\u5206\u3082\u3001\u6700\u3082\u8fd1\u3044\u9593\u9694\u3067\u5224\u5b9a\u3059\u308b\u3002
    let nearest = null, distance = .025;
    for (const [kind, duration] of [['12', 1 / 3], ['16', .25], ['24', 1 / 6], ['32', .125]]) {
      const error = Math.abs(delta - duration);
      if (error < distance) { nearest = kind; distance = error; }
    }
    return nearest;
  }
  const rhythmTypesFor = (notes, types) => {
    const rhythmTypes = types.slice();
    // 32\u5206\u304c2\u9593\u9694\u4ee5\u4e0a\u7d9a\u304f\u533a\u9593\u306e\u7aef\u3067\u306f\u3001\u753b\u50cf\u5ea7\u6a19\u306e1px\u5dee\u3092\u5438\u53ce\u3059\u308b\u3002
    // \u96a3\u306b24\u5206\u304c\u7d9a\u304f\u5834\u5408\u306f\u88dc\u6b63\u305b\u305a\u3001\u72ec\u7acb\u3057\u305f24\u5206\u533a\u9593\u3092\u7dad\u6301\u3059\u308b\u3002
    for (let edge = 1; edge < notes.length; edge++) {
      if (types[edge] !== '24') continue;
      const before32 = types[edge - 1] === '32' && types[edge - 2] === '32';
      const after32 = types[edge + 1] === '32' && types[edge + 2] === '32';
      const boundary = type => !type || type === 'long' || type === '12' || type === '16';
      if (!(before32 && boundary(types[edge + 1])) && !(after32 && boundary(types[edge - 1]))) continue;
      const height = notes[edge].img.parentElement.getBoundingClientRect().height || 128;
      const delta = notes[edge].beat - notes[edge - 1].beat;
      if (Math.abs(delta - .125) <= 4 / height + .001) rhythmTypes[edge] = '32';
    }
    return rhythmTypes;
  };
  const snapshot = () => ({ manual: new Map(manual), markedArrows: new Set(markedArrows), arrowOverrides: new Map(arrowOverrides), settings: { ...settings } });
  const remember = () => { past.push(snapshot()); future.length = 0; };
  const restore = state => {
    manual = new Map(state.manual);
    markedArrows = new Set(state.markedArrows);
    arrowOverrides = new Map(state.arrowOverrides);
    settings = { ...state.settings };
    for (const select of shadow.querySelectorAll('[data-setting]')) select.value = settings[select.dataset.setting];
    render();
  };
  let activeOverlays = [], activeCounts = [], scrollFrame = 0;
  const rhythmColors = { '12': '#f5aa39', '24': '#b788f7', '32': '#35cbae' };
  // \u516c\u5f0f\u306e\u73fe\u884c\u76bf\u5224\u5b9a\u4e0a\u9650\u3067\u306f\u306a\u304f\u3001\u8a66\u9a13\u7248\u306e\u4fdd\u5b88\u7684\u306a\u65e9\u5165\u308a\u5236\u9650\u3002
  const earlyLimitMs = 116.7;
  const bpmValue = String(window.bpm ?? document.querySelector('[data-demo-bpm]')?.getAttribute('data-demo-bpm') ?? '').trim();
  const fixedBpm = /^\d+(?:\.\d+)?$/.test(bpmValue) && Number(bpmValue) > 0 ? Number(bpmValue) : null;
  let earlyShifts = new Map();
  const measureBodies = new Map();
  for (const marker of document.querySelectorAll('[id^="mes"]')) {
    const container = marker.closest('table') || marker.closest('[data-demo-measure]');
    const img = container?.querySelector('img[src]');
    if (img) measureBodies.set(Number(marker.id.slice(3)), img.parentElement);
  }
  const displayRect = img => {
    const rect = img.getBoundingClientRect(), shift = earlyShifts.get(img) || 0;
    if (!shift) return rect;
    const beat = stamp(img) - shift;
    const number = Math.floor((beat + .000001) / 4) + 1;
    const body = measureBodies.get(number);
    if (!body) return rect;
    const frame = body.getBoundingClientRect();
    return { left: frame.left + (parseFloat(img.style.left) || 0),
      top: frame.top + frame.height - 5 - (beat - (number - 1) * 4) * frame.height / 4,
      height: rect.height, width: rect.width };
  };
  const planEarlyShifts = (notes, types, maxEarlyBeats) => {
    const shifts = new Map(), fast = type => type === '24' || type === '32';
    if (!Number.isFinite(maxEarlyBeats) || maxEarlyBeats <= 0) return shifts;
    const protectedNote = i => notes[i].kind === 'mss' ||
      links.has(`${notes[i - 1]?.key}>${notes[i].key}`) ||
      links.has(`${notes[i].key}>${notes[i + 1]?.key}`);
    // \u901a\u5e38\u306e\u5883\u76ee\u3082\u6700\u4f4e16\u5206\u3092\u78ba\u4fdd\u3002\u5143\u304c\u305d\u308c\u3088\u308a\u901f\u3044\u5834\u5408\u306f\u5143\u306e\u9593\u9694\u3092\u4e0b\u56de\u3089\u306a\u3044\u3002
    const gaps = notes.map((n, i) => i ? Math.min(.25, n.beat - notes[i - 1].beat) : 0);
    const chartStart = (Math.min(...measureBodies.keys()) - 1) * 4;
    const schedule = required => {
      const target = notes.map(n => n.beat);
      for (let i = notes.length - 2; i >= 0; i--) {
        target[i] = Math.min(target[i], target[i + 1] - required[i + 1]);
        if (notes[i].beat - target[i] > maxEarlyBeats + 1e-9 ||
            (protectedNote(i) && notes[i].beat - target[i] > 1e-9) ||
            target[i] < chartStart - 1e-9 ||
            !measureBodies.has(Math.floor((target[i] + .000001) / 4) + 1)) return null;
      }
      return target;
    };
    // 16\u5206\u3092\u631f\u3093\u3067\u7d9a\u304f\u901f\u3044\u533a\u9593\u306f\u307e\u3068\u3081\u3066\u8abf\u6574\u3059\u308b\u3002
    // \u6700\u521d\u306e\u533a\u9593\u3060\u3051\u3067\u65e9\u5165\u308a\u4e0a\u9650\u3092\u4f7f\u3044\u5207\u308a\u3001\u5f8c\u306e\u533a\u9593\u304c\u52d5\u304b\u306a\u304f\u306a\u308b\u306e\u3092\u9632\u3050\u3002
    for (let edge = 1; edge < notes.length;) {
      if (!fast(types[edge]) || protectedNote(edge - 1) || protectedNote(edge)) { edge++; continue; }
      let end = edge + 1;
      while (end < notes.length && notes[end].beat - notes[end - 1].beat <= .25 + .025 &&
          !protectedNote(end)) end++;
      const proposal = fraction => gaps.map((gap, i) => i >= edge && i < end && fast(types[i]) ?
        gap + Math.max(0, .25 - gap) * fraction : gap);
      let required = proposal(1);
      if (!schedule(required)) {
        let low = 0, high = 1;
        for (let attempt = 0; attempt < 40; attempt++) {
          const middle = (low + high) / 2;
          if (schedule(proposal(middle))) low = middle;
          else high = middle;
        }
        required = proposal(low);
      }
      if (schedule(required)) gaps.splice(0, gaps.length, ...required);
      edge = end;
    }
    const target = schedule(gaps);
    if (target) notes.forEach((n, i) => {
      const shift = Math.max(0, n.beat - target[i]);
      if (shift > .000001) shifts.set(n.img, shift);
    });
    return shifts;
  };
  const arrowEndsFor = (notes, arrowGap) => {
    const ends = new Set();
    let runStart = 0;
    for (let i = 1; i < notes.length; i++) {
      const before = notes[i - 1], after = notes[i];
      const linked = links.has(`${before.key}>${after.key}`);
      const gap = after.beat - (earlyShifts.get(after.img) || 0) -
        before.beat + (earlyShifts.get(before.img) || 0);
      if (!linked && gap >= arrowGap - .001) {
        if (i - runStart >= 2) ends.add(i - 1);
        runStart = i;
      }
    }
    return ends;
  };
  const placeArrow = (arrow, x, y) => {
    const marked = arrow.dataset.marked === '1';
    const size = marked ? 20 : 15;
    // \u753b\u9762\u7aef\u3067\u306f\u4f4d\u7f6e\u3092\u5207\u308a\u66ff\u3048\u305a\u3001\u5bfe\u8c61\u306e\u76bf\u30ec\u30fc\u30f3\u5de6\u5074\u3092\u57fa\u6e96\u306b\u3059\u308b\u3002
    arrow.style.left = (x - size - 5) + 'px';
    arrow.style.top = (y - (marked ? 8 : 6)) + 'px';
  };
  const countSegmentsFor = (notes, owned) => {
    if (settings.ammitsu !== 'on' || !fixedBpm || owned.length < 2) return [{ owned }];
    const groups = [];
    for (let edge = 1; edge < owned.length; edge++) {
      const before = notes[owned[edge - 1]], after = notes[owned[edge]];
      const gap = after.beat - (earlyShifts.get(after.img) || 0) -
        before.beat + (earlyShifts.get(before.img) || 0);
      const tempo = Math.abs(gap - .25) < .000001 ? '16' : 'equivalent';
      const last = groups[groups.length - 1];
      if (last && last.tempo === tempo) {
        last.end = edge;
        last.gap = Math.min(last.gap, gap);
      } else groups.push({ tempo, gap, start: edge - 1, end: edge });
    }
    // \u901f\u3044\u533a\u9593\u5185\u306e\u77ed\u304416\u5206\uff082\u9593\u9694\u307e\u3067\uff09\u306f\u3001\u7d30\u5207\u308c\u306b\u305b\u305a\u540c\u3058\u533a\u9593\u306b\u542b\u3081\u308b\u3002
    for (let i = 1; i + 1 < groups.length; i++) {
      if (groups[i].tempo === '16' && groups[i].end - groups[i].start <= 2 &&
          groups[i - 1].tempo === 'equivalent' && groups[i + 1].tempo === 'equivalent') {
        groups[i].tempo = 'equivalent';
      }
    }
    const merged = [];
    for (const group of groups) {
      const last = merged[merged.length - 1];
      if (last && last.tempo === group.tempo) {
        last.end = group.end;
        last.gap = Math.min(last.gap, group.gap);
      } else merged.push({ ...group });
    }
    return merged.map((group, index) => {
      let { start, end } = group;
      const before = merged[index - 1], after = merged[index + 1];
      // \u5883\u76ee\u306e\u76bf\u306f\u3001\u9593\u9694\u304c\u77ed\u3044\uff08\u901f\u3044\uff09\u5074\u3067\u4e00\u5ea6\u3060\u3051\u6570\u3048\u308b\u3002
      if (before && before.gap <= group.gap) start++;
      if (after && after.gap < group.gap) end--;
      return { owned: owned.slice(start, end + 1), gap: group.gap };
    }).filter(group => group.owned.length);
  };
  const setRhythmLabel = (badge, kind, notes, owned, useCurrent = false, interval) => {
    badge.textContent = (kind ? kind + '\u5206 ' : '') + owned.length + '\u679a';
    if (settings.ammitsu !== 'on') return;
    const gaps = [], originalGaps = [];
    for (let i = 1; i < owned.length; i++) {
      const before = notes[owned[i - 1]], after = notes[owned[i]];
      originalGaps.push(after.beat - before.beat);
      gaps.push(after.beat - (earlyShifts.get(after.img) || 0) -
        before.beat + (earlyShifts.get(before.img) || 0));
    }
    if (interval !== undefined) gaps.splice(0, gaps.length, interval);
    if (!gaps.length || !gaps.every(gap => gap > 0) ||
        (interval === undefined && !useCurrent && gaps.every((gap, i) => Math.abs(gap - originalGaps[i]) < .000001))) return;
    const shortestGap = Math.min(...gaps);
    const equivalentBpm = fixedBpm * .25 / shortestGap;
    const exact16 = gaps.every(gap => Math.abs(gap - .25) < .000001);
    badge.dataset.tempo = exact16 ? '0' : '1';
    badge.textContent = exact16 ? '16\u5206 ' + owned.length + '\u679a' :
      'BPM' + Math.round(equivalentBpm) + '\n16\u5206\u76f8\u5f53 ' + owned.length + '\u679a';
    badge.title = (kind ? '\u5143\uff1a' + kind + '\u5206 / ' : '') + '\u9921\u871c\u5f8c\uff1a' +
      'BPM' + equivalentBpm.toFixed(1) + '\u306e16\u5206\u76f8\u5f53\uff08\u9593\u9694' + Math.min(...gaps).toFixed(3) +
      '\u301c' + Math.max(...gaps).toFixed(3) + '\u62cd\uff09';
  };
  const placeCount = ({ first, last, center, badge, offset }) => {
    const a = displayRect(first), b = displayRect(last);
    const middle = displayRect(center);
    // \u5c0f\u7bc0\u304c\u6b21\u306e\u5217\u306b\u6298\u308a\u8fd4\u3059\u5834\u5408\u3082\u3001\u533a\u9593\u4e2d\u592e\u306e\u76bf\u306e\u305d\u3070\u306b\u7f6e\u304f\u3002
    const y = Math.abs(a.left - b.left) < 24 ? (a.top + b.top) / 2 : middle.top;
    const x = middle.left + window.scrollX;
    // \u77e2\u5370\u304c\u3042\u308b\u6642\u306f\u3001\u305d\u306e\u3055\u3089\u306b\u5de6\u306b\u7f6e\u3044\u3066\u91cd\u306a\u308a\u3092\u907f\u3051\u308b\u3002
    const shift = badge.dataset.tempo === '1' ? 100 : offset || (settings.arrows === 'none' ? 39 : 61);
    badge.style.left = (x - shift) + 'px';
    badge.style.top = (y + window.scrollY - (badge.dataset.tempo === '1' ? 14 : 8)) + 'px';
  };
  const reposition = () => {
    for (const { img, hit, arrow } of activeOverlays) {
      const rect = displayRect(img);
      const x = rect.left + window.scrollX, y = rect.top + window.scrollY;
      hit.style.left = x + 'px';
      hit.style.top = (y - 1) + 'px';
      if (arrow) {
        placeArrow(arrow, x, y);
      }
    }
    for (const count of activeCounts) placeCount(count);
  };
  const scheduleReposition = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => { scrollFrame = 0; reposition(); });
  };
  function render() {
    layer.replaceChildren();
    activeOverlays = [];
    activeCounts = [];
    earlyShifts = new Map();
    const ammitsuButton = shadow.querySelector('[data-action="ammitsu"]');
    ammitsuButton.textContent = '\u76bf\u9921\u871c';
    ammitsuButton.title = '\u76bf\u9921\u871c ' + (settings.ammitsu === 'on' ? 'ON' : 'OFF') + '\uff08\u65e9\u5165\u308a\u4e0a\u9650116.7ms\uff09' + (fixedBpm ? '' : '\uff1aBPM\u3092\u78ba\u5b9a\u3067\u304d\u306a\u3044\u305f\u3081\u5909\u63db\u306a\u3057');
    ammitsuButton.setAttribute('aria-pressed', settings.ammitsu === 'on' ? 'true' : 'false');
    shadow.querySelector('[data-action="undo"]').disabled = !past.length;
    shadow.querySelector('[data-action="redo"]').disabled = !future.length;
    shadow.querySelector('[data-action="reset"]').disabled = !manual.size && !markedArrows.size && !arrowOverrides.size && Object.keys(defaults).every(key => settings[key] === defaults[key]);
    const countButton = shadow.querySelector('[data-action="counts"]');
    countButton.textContent = '\u679a\u6570 ' + (settings.counts === 'on' ? 'ON' : 'OFF');
    countButton.setAttribute('aria-pressed', settings.counts === 'on' ? 'true' : 'false');
    const rhythmButton = shadow.querySelector('[data-action="rhythm"]');
    rhythmButton.textContent = '\u5909\u901f\u76bf ' + (settings.rhythm === 'on' ? 'ON' : 'OFF');
    rhythmButton.setAttribute('aria-pressed', settings.rhythm === 'on' ? 'true' : 'false');
    for (const [side, notes] of sides) {
      notes.sort((a, b) => a.beat - b.beat || a.index - b.index);
      let prev = null, parity = 0;
      const parities = [], types = [];
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const linked = prev && links.has(`${prev.key}>${n.key}`);
        const reset = !prev || (!linked && n.beat - prev.beat >= settings.gap - 0.001);
        parity = manual.has(n.key) ? manual.get(n.key) : reset ? (settings.firstColor === 'red' ? 1 : 0) : 1 - parity;
        parities.push(parity);
        types.push(edgeType(prev, n));
        prev = n;
      }
      if (settings.ammitsu === 'on') {
        for (const [img, shift] of planEarlyShifts(notes, rhythmTypesFor(notes, types), fixedBpm ? earlyLimitMs * fixedBpm / 60000 : 0)) earlyShifts.set(img, shift);
      }
      // \u57fa\u6e96\u30fb\u7d42\u7aef\u30eb\u30fc\u30eb\u306f\u305d\u306e\u307e\u307e\u3001\u9921\u871c\u6642\u306f\u79fb\u52d5\u5f8c\u306e\u9593\u9694\u3067\u81ea\u52d5\u77e2\u5370\u3092\u5224\u5b9a\u3059\u308b\u3002
      const ends = arrowEndsFor(notes, arrowGaps[settings.arrows] ?? .5);
      const variableRhythmOn = settings.rhythm === 'on';
      const rhythmNoteKinds = new Map();
      if (variableRhythmOn) {
        const rhythmTypes = rhythmTypesFor(notes, types);
        // \u76bf\u540c\u58eb\u306e\u9593\u9694\u3067\u533a\u9593\u3092\u4f5c\u308b\u3002\u901f\u3044\u533a\u9593\u306b\u631f\u307e\u308c\u305f\u9045\u30441\u9593\u9694\u306f\u533a\u5207\u308a\u3068\u3057\u3066\u6271\u3046\u3002
        const groups = [];
        for (let edge = 1; edge < notes.length;) {
          const kind = rhythmTypes[edge];
          if (!rhythmColors[kind]) { edge++; continue; }
          let end = edge + 1;
          while (end < notes.length && rhythmTypes[end] === kind) end++;
          groups.push({ kind, startEdge: edge, endEdge: end, firstIndex: edge - 1, lastIndex: end - 1 });
          edge = end;
        }
        const visibleGroups = [];
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
          const group = groups[groupIndex];
          const { kind, startEdge, endEdge, firstIndex, lastIndex } = group;
          const before = groups[groupIndex - 1], after = groups[groupIndex + 1];
          if (endEdge - startEdge === 1 && before?.endEdge === startEdge && after?.startEdge === endEdge &&
              Number(before.kind) > Number(kind) && Number(after.kind) > Number(kind)) continue;
          visibleGroups.push(group);
          for (let i = firstIndex; i <= lastIndex; i++) {
            // \u5883\u76ee\u306e\u76bf\u306f\u901f\u3044\u533a\u9593\u306b\u6240\u5c5e\u3055\u305b\u3001\u3069\u306e\u533a\u9593\u3067\u3082\u4e00\u5ea6\u3060\u3051\u6570\u3048\u308b\u3002
            if (Number(kind) > Number(rhythmNoteKinds.get(i) || 0)) rhythmNoteKinds.set(i, kind);
          }
        }
        if (settings.counts === 'on') {
          for (const { kind, firstIndex, lastIndex } of visibleGroups) {
            const originalOwned = [];
            for (let i = firstIndex; i <= lastIndex; i++) {
              if (rhythmNoteKinds.get(i) === kind) originalOwned.push(i);
            }
            if (originalOwned.length < 2) continue;
            for (const { owned, gap } of countSegmentsFor(notes, originalOwned)) {
              const badge = document.createElement('span');
              badge.className = id + '-rhythm-count';
              badge.style.setProperty('--sc-rhythm-edge', rhythmColors[kind]);
              setRhythmLabel(badge, kind, notes, owned, false, gap);
              const count = { first: notes[owned[0]].img, last: notes[owned[owned.length - 1]].img,
                center: notes[owned[Math.floor(owned.length / 2)]].img, badge, offset: 88 };
              layer.append(badge);
              activeCounts.push(count);
              placeCount(count);
            }
          }
        }
      }
      if (settings.counts === 'on') {
        // OFF\u306f\u9023\u7d9a\u3059\u308b16\u30fb24\u30fb32\u5206\u3092\u307e\u3068\u3081\u3001ON\u306f16\u5206\u3092\u5909\u901f\u533a\u9593\u3068\u5206\u3051\u308b\u3002
        const currentCounts = !variableRhythmOn && settings.ammitsu === 'on' && fixedBpm;
        const included = edge => {
          if (currentCounts) {
            const before = notes[edge - 1], after = notes[edge];
            const gap = after.beat - (earlyShifts.get(after.img) || 0) -
              before.beat + (earlyShifts.get(before.img) || 0);
            return gap > 0 && gap <= .25 + .025;
          }
          const type = types[edge];
          return variableRhythmOn ? type === '16' : type === '16' || type === '24' || type === '32';
        };
        for (let edge = 1; edge < notes.length;) {
          if (!included(edge)) { edge++; continue; }
          let end = edge + 1;
          while (end < notes.length && included(end)) end++;
          const owned = [];
          for (let i = edge - 1; i < end; i++) {
            if (!rhythmNoteKinds.has(i)) owned.push(i);
          }
          if (owned.length >= 2) {
            for (const segment of countSegmentsFor(notes, owned)) {
              const segmentOwned = segment.owned;
              const badge = document.createElement('span');
              badge.className = id + (variableRhythmOn || currentCounts ? '-rhythm-count' : '-count');
              if (variableRhythmOn || currentCounts) badge.style.setProperty('--sc-rhythm-edge', variableRhythmOn ? '#ed4e61' : '#8aa1bd');
              if (variableRhythmOn) setRhythmLabel(badge, '16', notes, segmentOwned, false, segment.gap);
              else if (currentCounts) setRhythmLabel(badge, null, notes, segmentOwned, true, segment.gap);
              else badge.textContent = owned.length + '\u679a';
              const count = { first: notes[segmentOwned[0]].img, last: notes[segmentOwned[segmentOwned.length - 1]].img,
                center: notes[segmentOwned[Math.floor(segmentOwned.length / 2)]].img, badge,
                offset: variableRhythmOn || currentCounts ? 88 : undefined };
              layer.append(badge);
              activeCounts.push(count);
              placeCount(count);
            }
          }
          edge = end;
        }
      }
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i], rect = displayRect(n.img);
        const x = rect.left + window.scrollX, y = rect.top + window.scrollY;
        const before = i ? displayRect(notes[i - 1].img) : null;
        const after = i + 1 < notes.length ? displayRect(notes[i + 1].img) : null;
        const distance = Math.min(before ? Math.abs(rect.top - before.top) : Infinity,
          after ? Math.abs(rect.top - after.top) : Infinity);
        const height = Number.isFinite(distance) ? Math.max(2, Math.min(8, distance - 1)) : 8;
        const hit = document.createElement('span');
        hit.className = id + '-hit';
        if (earlyShifts.has(n.img)) {
          const earlyMs = Math.round(earlyShifts.get(n.img) * 60000 / fixedBpm * 1e6) / 1e6;
          const outlineColor = earlyMs > 110 ? '#ff982e' : '#ffdc47';
          hit.style.setProperty('--sc-early-outline', '1px solid ' + outlineColor);
        }
        hit.style.left = x + 'px';
        hit.style.top = (y - 1) + 'px';
        hit.style.setProperty('--sc-color', parities[i] ? '#ed4e61' : (rhythmColors[rhythmNoteKinds.get(i)] || '#32aaff'));
        hit.style.setProperty('--sc-height', height + 'px');
        hit.style.setProperty('--sc-line-height', Math.min(5, height) + 'px');
        hit.dataset.forced = manual.has(n.key) ? '1' : '0';
        hit.title = (earlyShifts.has(n.img) ? '\u65e9\u5165\u308a ' + (earlyShifts.get(n.img) * 60000 / fixedBpm).toFixed(1) + 'ms / ' : '') + (types[i] ? '\u30bf\u30c3\u30d7\u3067\u77e2\u5370\u3092\u4ed8\u3051\u5916\u3057' : '\u30bf\u30c3\u30d7\u3067\u62bc\u3057\u5f15\u304d\u5207\u66ff');
        hit.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          if (types[i]) {
            remember();
            const auto = settings.arrows === 'all' || (arrowGaps[settings.arrows] !== undefined && ends.has(i));
            const visible = arrowOverrides.has(n.key) ? arrowOverrides.get(n.key) : auto;
            arrowOverrides.set(n.key, !visible);
            render();
            return;
          }
          remember();
          if (manual.has(n.key)) manual.delete(n.key);
          else manual.set(n.key, 1 - parities[i]);
          render();
        });
        layer.append(hit);
        const autoArrow = settings.arrows === 'all' || (arrowGaps[settings.arrows] !== undefined && ends.has(i));
        const showArrow = arrowOverrides.has(n.key) ? arrowOverrides.get(n.key) : autoArrow;
        if (showArrow) {
          const markable = ends.has(i) || arrowOverrides.get(n.key) === true;
          const arrow = document.createElement(markable ? 'button' : 'span');
          arrow.className = id + '-arrow';
          if (markable) {
            arrow.type = 'button';
            arrow.dataset.markable = '1';
            arrow.dataset.marked = markedArrows.has(n.key) ? '1' : '0';
            arrow.title = markedArrows.has(n.key) ? '\u91cd\u8981\u30dd\u30a4\u30f3\u30c8\u306e\u5370\u3092\u5916\u3059' : '\u91cd\u8981\u30dd\u30a4\u30f3\u30c8\u3068\u3057\u3066\u77e2\u5370\u3092\u5f37\u8abf';
            arrow.addEventListener('click', e => {
              e.preventDefault(); e.stopPropagation();
              remember();
              if (markedArrows.has(n.key)) markedArrows.delete(n.key);
              else markedArrows.add(n.key);
              render();
            });
          }
          const up = ((side.endsWith('right') && isDP ? settings.startRight : settings.start) === 'up') === Boolean(parities[i]);
          arrow.textContent = up ? '\u2191' : '\u2193';
          placeArrow(arrow, x, y);
          layer.append(arrow);
          activeOverlays.push({ img: n.img, hit, arrow });
        } else {
          activeOverlays.push({ img: n.img, hit });
        }
      }
    }
  }
  shadow.addEventListener('change', e => {
    if (e.target.dataset.setting) {
      remember();
      settings[e.target.dataset.setting] = e.target.dataset.setting === 'gap' ? Number(e.target.value) : e.target.value;
      render();
    }
  });
  const close = () => {
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    window.removeEventListener('resize', render);
    window.removeEventListener('resize', positionBar);
    window.removeEventListener('scroll', scheduleReposition);
    document.removeEventListener('scroll', scheduleReposition, true);
    window.visualViewport?.removeEventListener('resize', positionBar);
    window.visualViewport?.removeEventListener('scroll', positionBar);
    window.visualViewport?.removeEventListener('resize', scheduleReposition);
    window.visualViewport?.removeEventListener('scroll', scheduleReposition);
    for (const { img, value, priority } of originalVisibility) {
      if (value) img.style.setProperty('visibility', value, priority);
      else img.style.removeProperty('visibility');
    }
    layer.remove(); bar.remove(); style.remove(); addedViewport?.remove(); delete window[id];
  };
  shadow.addEventListener('click', e => {
    if (e.target.dataset.action === 'undo' && past.length) {
      future.push(snapshot()); restore(past.pop());
    }
    if (e.target.dataset.action === 'redo' && future.length) {
      past.push(snapshot()); restore(future.pop());
    }
    if (e.target.dataset.action === 'reset' && !e.target.disabled) {
      remember(); restore({ manual: new Map(), markedArrows: new Set(), arrowOverrides: new Map(), settings: defaults });
    }
    if (e.target.dataset.action === 'counts') {
      remember(); settings.counts = settings.counts === 'on' ? 'off' : 'on'; render();
    }
    if (e.target.dataset.action === 'ammitsu') {
      remember(); settings.ammitsu = settings.ammitsu === 'on' ? 'off' : 'on'; render();
    }
    if (e.target.dataset.action === 'rhythm') {
      remember(); settings.rhythm = settings.rhythm === 'on' ? 'off' : 'on'; render();
    }
    if (e.target.dataset.action === 'hide') setCollapsed(true);
    if (e.target.dataset.action === 'show') setCollapsed(false);
    if (e.target.dataset.action === 'close') close();
  });
  window.addEventListener('resize', render);
  window.addEventListener('resize', positionBar);
  window.addEventListener('scroll', scheduleReposition);
  document.addEventListener('scroll', scheduleReposition, true);
  window.visualViewport?.addEventListener('resize', positionBar);
  window.visualViewport?.addEventListener('scroll', positionBar);
  window.visualViewport?.addEventListener('resize', scheduleReposition);
  window.visualViewport?.addEventListener('scroll', scheduleReposition);
  window[id] = { close, showPanel: () => setCollapsed(false) };
  render();
  for (const { img } of originalVisibility) img.style.setProperty('visibility', 'hidden', 'important');
})();
