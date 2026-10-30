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
  if (!nodes.length) { alert('TexTageの譜面ページを開いてから起動してください。'); return; }
  const originalVisibility = nodes.map(img => ({
    img,
    value: img.style.getPropertyValue('visibility'),
    priority: img.style.getPropertyPriority('visibility')
  }));

  // Android Chromeがviewport指定のない譜面をPC幅に縮小した場合だけ、実画面幅で表示する。
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
  const arrowSelect = '<select data-setting="arrows"><option value="end4">4分〜</option><option value="end6">6分〜</option><option value="end8">8分〜</option><option value="end12" selected>12分〜</option><option value="end16">16分〜</option><option value="end24">24分〜</option><option value="end32">32分〜</option><option value="all">全皿</option><option value="none">なし</option></select>';
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
  </style><div class="panel"><div class="header"><strong class="title">皿の押し引き</strong>
    <div class="history"><button data-action="ammitsu" type="button" aria-pressed="false" title="皿餡蜜：早入り上限116.7ms">皿餡蜜</button><button data-action="undo" type="button" title="ひとつ戻す">戻す</button><button data-action="redo" type="button" title="ひとつ進む">進む</button><button data-action="reset" type="button" title="変更と設定を初期状態に戻す">リセット</button></div></div>
    <div class="controls ${isDP ? 'dp' : 'sp'}">
      <label>間隔<select data-setting="gap"><option value="0.5">0.5拍</option><option value="1">1拍</option><option value="2" selected>2拍</option><option value="4">4拍</option><option value="8">8拍</option><option value="9999">なし</option></select></label>
      <label>始点<select data-setting="firstColor"><option value="red" selected>赤→青</option><option value="blue">青→赤</option></select></label>
      ${isDP ? '<label>矢印' + arrowSelect + '</label>' : '<label>赤向き<select data-setting="start"><option value="up">押す ↑</option><option value="down">引く ↓</option></select></label>'}
      ${isDP ? '<label class="side">1P 赤向き<select data-setting="start"><option value="up">押す ↑</option><option value="down">引く ↓</option></select></label><label class="side">2P 赤向き<select data-setting="startRight"><option value="up">押す ↑</option><option value="down">引く ↓</option></select></label>' : '<label>矢印' + arrowSelect + '</label>'}
    </div><div class="actions"><button data-action="rhythm" type="button" aria-pressed="false">変速皿 OFF</button><button data-action="counts" type="button" aria-pressed="false">枚数 OFF</button><button data-action="hide" type="button">隠す</button><button data-action="close" type="button">終了</button></div></div><button class="reopen" data-action="show" type="button" aria-label="設定を表示">表示する</button>`;
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
    // MSSの中間点や小節境界は同じ時刻の画像が重複する。
    if (prior) {
      if (parseFloat(prior.img.style.top) < 0 && parseFloat(img.style.top) >= 0) prior.img = img;
      if (/\/(?:sm|rm)\.gif$/.test(img.getAttribute('src'))) prior.kind = 'mss';
      return;
    }
    const note = { img, index, key, beat, left, kind: /\/(?:sm|rm)\.gif$/.test(img.getAttribute('src')) ? 'mss' : 'normal' };
    unique.set(key, note); info.push(note);
  });
  // 長皿の帯（ls.gif）の両端を結び、拍数設定による途中リセットを防ぐ。
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
  // TexTageの皿は1Pがleft=0、2Pがleft=91または98。模擬DPは先行するSP例とも分ける。
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
    // 許容範囲が重なる24分・32分も、最も近い間隔で判定する。
    let nearest = null, distance = .025;
    for (const [kind, duration] of [['12', 1 / 3], ['16', .25], ['24', 1 / 6], ['32', .125]]) {
      const error = Math.abs(delta - duration);
      if (error < distance) { nearest = kind; distance = error; }
    }
    return nearest;
  }
  const rhythmTypesFor = (notes, types) => {
    const rhythmTypes = types.slice();
    // 32分が2間隔以上続く区間の端では、画像座標の1px差を吸収する。
    // 隣に24分が続く場合は補正せず、独立した24分区間を維持する。
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
  // 公式の現行皿判定上限ではなく、試験版の保守的な早入り制限。
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
    // 通常の境目も最低16分を確保。元がそれより速い場合は元の間隔を下回らない。
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
    // 16分を挟んで続く速い区間はまとめて調整する。
    // 最初の区間だけで早入り上限を使い切り、後の区間が動かなくなるのを防ぐ。
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
    // 画面端では位置を切り替えず、対象の皿レーン左側を基準にする。
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
    // 速い区間内の短い16分（2間隔まで）は、細切れにせず同じ区間に含める。
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
      // 境目の皿は、間隔が短い（速い）側で一度だけ数える。
      if (before && before.gap <= group.gap) start++;
      if (after && after.gap < group.gap) end--;
      return { owned: owned.slice(start, end + 1), gap: group.gap };
    }).filter(group => group.owned.length);
  };
  const setRhythmLabel = (badge, kind, notes, owned, useCurrent = false, interval) => {
    badge.textContent = (kind ? kind + '分 ' : '') + owned.length + '枚';
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
    badge.textContent = exact16 ? '16分 ' + owned.length + '枚' :
      'BPM' + Math.round(equivalentBpm) + '\n16分相当 ' + owned.length + '枚';
    badge.title = (kind ? '元：' + kind + '分 / ' : '') + '餡蜜後：' +
      'BPM' + equivalentBpm.toFixed(1) + 'の16分相当（間隔' + Math.min(...gaps).toFixed(3) +
      '〜' + Math.max(...gaps).toFixed(3) + '拍）';
  };
  const placeCount = ({ first, last, center, badge, offset }) => {
    const a = displayRect(first), b = displayRect(last);
    const middle = displayRect(center);
    // 小節が次の列に折り返す場合も、区間中央の皿のそばに置く。
    const y = Math.abs(a.left - b.left) < 24 ? (a.top + b.top) / 2 : middle.top;
    const x = middle.left + window.scrollX;
    // 矢印がある時は、そのさらに左に置いて重なりを避ける。
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
    ammitsuButton.textContent = '皿餡蜜';
    ammitsuButton.title = '皿餡蜜 ' + (settings.ammitsu === 'on' ? 'ON' : 'OFF') + '（早入り上限116.7ms）' + (fixedBpm ? '' : '：BPMを確定できないため変換なし');
    ammitsuButton.setAttribute('aria-pressed', settings.ammitsu === 'on' ? 'true' : 'false');
    shadow.querySelector('[data-action="undo"]').disabled = !past.length;
    shadow.querySelector('[data-action="redo"]').disabled = !future.length;
    shadow.querySelector('[data-action="reset"]').disabled = !manual.size && !markedArrows.size && !arrowOverrides.size && Object.keys(defaults).every(key => settings[key] === defaults[key]);
    const countButton = shadow.querySelector('[data-action="counts"]');
    countButton.textContent = '枚数 ' + (settings.counts === 'on' ? 'ON' : 'OFF');
    countButton.setAttribute('aria-pressed', settings.counts === 'on' ? 'true' : 'false');
    const rhythmButton = shadow.querySelector('[data-action="rhythm"]');
    rhythmButton.textContent = '変速皿 ' + (settings.rhythm === 'on' ? 'ON' : 'OFF');
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
      // 基準・終端ルールはそのまま、餡蜜時は移動後の間隔で自動矢印を判定する。
      const ends = arrowEndsFor(notes, arrowGaps[settings.arrows] ?? .5);
      const variableRhythmOn = settings.rhythm === 'on';
      const rhythmNoteKinds = new Map();
      if (variableRhythmOn) {
        const rhythmTypes = rhythmTypesFor(notes, types);
        // 皿同士の間隔で区間を作る。速い区間に挟まれた遅い1間隔は区切りとして扱う。
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
            // 境目の皿は速い区間に所属させ、どの区間でも一度だけ数える。
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
        // OFFは連続する16・24・32分をまとめ、ONは16分を変速区間と分ける。
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
              else badge.textContent = owned.length + '枚';
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
        hit.title = (earlyShifts.has(n.img) ? '早入り ' + (earlyShifts.get(n.img) * 60000 / fixedBpm).toFixed(1) + 'ms / ' : '') + (types[i] ? 'タップで矢印を付け外し' : 'タップで押し引き切替');
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
            arrow.title = markedArrows.has(n.key) ? '重要ポイントの印を外す' : '重要ポイントとして矢印を強調';
            arrow.addEventListener('click', e => {
              e.preventDefault(); e.stopPropagation();
              remember();
              if (markedArrows.has(n.key)) markedArrows.delete(n.key);
              else markedArrows.add(n.key);
              render();
            });
          }
          const up = ((side.endsWith('right') && isDP ? settings.startRight : settings.start) === 'up') === Boolean(parities[i]);
          arrow.textContent = up ? '↑' : '↓';
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
