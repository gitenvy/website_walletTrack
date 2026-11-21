/* Tali pitch stage: drives the app inside the phone frame and narrates each moment */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var iframe = $('#app'), demo = null, appWin = null;
  var wide = window.matchMedia('(min-width: 900px)').matches;
  iframe.src = 'app.html' + (wide ? '?frame=1' : '');

  /* Each moment: timed steps (sim ms after start) and event-driven steps.
     {item} is replaced with the wallet's name, {phone} with the phone's name. */
  var MOMENTS = [
    { k: 'leave', title: 'You forget your wallet', desc: 'Leave the wallet on the table and walk out with your phone in your pocket.', steps: [
      { at: 0, t: 'At a customer site, your {item}, tool pouch and {phone} are all with you, and Tali shows them as Nearby.' },
      { at: 1200, t: 'You put your {item} down on the table.' },
      { at: 2200, t: 'Job done. You pocket your phone and head for the door.', lock: true },
      { on: 'alert', t: 'Before you reach the door, the band taps your wrist once and your phone names the {item}.', alert: true, next: 'Press "Walk back" to return.' },
      { on: 'recovered', t: 'Back at the table, the {item} reconnects and shows as Recovered. Tap Ring and it keeps ringing until you tap Stop.', next: 'Tap "Ring" on the Wallet card, then "Stop ringing" once you find it.' }
    ] },
    { k: 'carry', title: 'You leave with everything', desc: 'Everything goes in your bag. Tali should stay silent.', steps: [
      { at: 0, t: 'Your {item}, pouch and {phone} all go in your bag.' },
      { at: 1500, t: 'You walk out.', lock: true },
      { on: 'quiet', t: 'You are outside and the band never tapped. No nuisance alerts when nothing is missing.' }
    ] },
    { k: 'loan', title: 'A friend borrows your phone', desc: 'They walk off with it while you sit. Lending should not raise an alarm.', steps: [
      { at: 0, t: 'You are sitting down with your {phone}, {item} and pouch.' },
      { at: 1000, t: 'A friend borrows your {phone} and walks away. You stay seated.' },
      { on: 'suppressed', t: 'The {phone} left while you were still, so Tali treats it as a loan and stays quiet.' },
      { at: 11000, t: 'Later you get up and leave. Still quiet, because the {phone} was already away before you moved.' }
    ] },
    { k: 'shielded', title: 'Wallet in a foil-lined bag', desc: 'Honest limitation: a shielded tag can cause a false alert.', lim: true, steps: [
      { at: 0, t: 'Your {item} is inside a foil-lined bag.' },
      { at: 1200, t: 'The lining blocks the tag\'s Bluetooth signal.' },
      { at: 2200, t: 'You walk out with everything.', lock: true },
      { on: 'alert', t: 'False alert: the receiver can\'t hear a shielded tag. We measure how often this happens in the pilot.', alert: true }
    ] },
    { k: 'dead', title: 'Tag battery dies', desc: 'Honest limitation: a dead tag looks the same as a missing one.', lim: true, steps: [
      { at: 0, t: 'Everything is with you.' },
      { at: 1500, t: 'You walk out.', lock: true },
      { at: 4500, t: 'The {item} tag\'s battery dies on the way.' },
      { on: 'alert', t: 'The band taps because the tag went silent. The app keeps the last battery reading so you can tell why.', alert: true }
    ] }
  ];

  var run = null;   // { m, names, shown: [stepIdx], startedAt }

  /* ---------------- connect to the app ---------------- */
  function attach() {
    if (demo) return;
    try { appWin = iframe.contentWindow; demo = appWin.TaliDemo; } catch (e) { $('#fileNotice').hidden = false; return; }
    if (!demo) return;
    demo.subscribe(onApp);
    renderMoments();
    renderSimItems(true);
    renderSpeed();
    setInterval(tick, 50);
  }
  iframe.addEventListener('load', function () {
    attach();
    if (!demo) setTimeout(function () { attach(); if (!demo) $('#fileNotice').hidden = false; }, 1200);
  });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.tali === 'ready') attach(); });

  function onApp(type, data) {
    if (type === 'alert') {
      var w = $('#wrist');
      w.classList.remove('tap'); void w.offsetWidth; w.classList.add('tap');
      setTimeout(function () { w.classList.remove('tap'); }, 3200);
      fireStep('alert');
    } else if (type === 'event') {
      if (data.type === 'recovered') fireStep('recovered');
      if (data.type === 'suppressed') fireStep('suppressed');
    } else if (type === 'trial') {
      if (!data.leftBehind.length && !data.nuisance.length) fireStep('quiet');
    } else if (type === 'lock') {
      $('#lockBtn').textContent = data ? 'Unlock phone' : 'Lock phone';
    } else if (type === 'render') {
      renderSimItems(true);
    }
  }

  /* ---------------- moments & narration ---------------- */
  function renderMoments() {
    $('#moments').innerHTML = MOMENTS.map(function (m, i) {
      return '<button type="button" class="moment' + (run && run.m === m ? ' running' : '') + '" data-moment="' + m.k + '"><span class="n">' + (i + 1) + '</span>' +
        '<b>' + esc(m.title) + (m.lim ? ' <em class="lim">Limitation</em>' : '') + '</b><span class="d">' + esc(m.desc) + '</span></button>';
    }).join('');
  }

  function fill(t) { return t.replace(/\{item\}/g, run.names.item).replace(/\{phone\}/g, run.names.phone); }

  function startMoment(k) {
    if (!demo) return;
    var m = MOMENTS.filter(function (x) { return x.k === k; })[0];
    demo.setLocked(false);
    var res = demo.runScenario(k);
    if (!res) { setSingle(k === 'loan' ? 'Add a phone to today\'s carry list in the app first.' : 'Add a tag to today\'s carry list in the app first.'); return; }
    run = { m: m, names: { item: res.wallet ? res.wallet.name.toLowerCase() : 'wallet', phone: res.phone ? res.phone.name.toLowerCase() : 'phone' }, shown: [], current: -1 };
    var w = demo.world();
    m.steps.forEach(function (s, i) { if (s.at != null) w.at(s.at, function () { showStep(i); }); });
    renderSteps();
    renderMoments();
    renderSimItems(true);
    closePanel();
  }

  function fireStep(on) {
    if (!run) return;
    run.m.steps.forEach(function (s, i) { if (s.on === on && run.shown.indexOf(i) < 0) showStep(i); });
  }

  function showStep(i) {
    if (!run) return;
    var s = run.m.steps[i];
    if (run.shown.indexOf(i) < 0) run.shown.push(i);
    run.current = i;
    if (s.lock && $('#autoLock').checked && demo) demo.setLocked(true);
    renderSteps();
  }

  function renderSteps() {
    if (!run) return;
    var ol = $('#steps');
    var order = run.shown.slice();
    var cur = run.m.steps[run.current];
    ol.innerHTML = order.map(function (i) {
      var s = run.m.steps[i], on = i === run.current;
      return '<li class="' + (on ? 'on' : 'done') + (on && s.alert ? ' alert' : '') + '">' + esc(fill(s.t)) + '</li>';
    }).join('') || '<li class="on">Starting…</li>';
    $('#nowTitle').textContent = run.m.title;
    var badge = $('#nowBadge');
    badge.hidden = !run.m.lim;
    badge.className = 'pill warn';
    badge.textContent = 'Known limitation';
    var cf = $('#capFloat');
    cf.hidden = !cur;
    if (cur) { cf.textContent = fill(cur.t); cf.classList.toggle('alert', !!cur.alert); }
    var hint = $('#nextHint');
    hint.hidden = !(cur && cur.next);
    if (cur && cur.next) hint.textContent = 'Next: ' + cur.next;
  }

  function setSingle(text) {
    run = null;
    $('#nowTitle').textContent = "What's happening";
    $('#nowBadge').hidden = true;
    $('#nextHint').hidden = true;
    $('#steps').innerHTML = '<li class="on">' + esc(text) + '</li>';
    $('#capFloat').hidden = true;
    renderMoments();
  }

  /* ---------------- wrist + room ---------------- */
  var SX = function (m) { return 18 + m * (560 / 24); };
  function person(x, cls, band) {
    return '<g transform="translate(' + x.toFixed(1) + ',0)"><circle class="' + cls + '" cx="0" cy="92" r="10"/><rect class="' + cls + '" x="-10" y="105" width="20" height="40" rx="9"/>' +
      '<rect class="' + cls + '" x="-8" y="140" width="6.5" height="30" rx="3"/><rect class="' + cls + '" x="1.5" y="140" width="6.5" height="30" rx="3"/>' +
      (band ? '<circle class="' + band + '" cx="12" cy="130" r="4.5"/>' : '') + '</g>';
  }

  function tick() {
    if (!demo || demo.mode() !== 'sim') return;
    var w = demo.world(); if (!w) return;
    var META = demo.META, TV = demo.TONE_VAR;
    var states = [];
    if (w.rx) w.rx.items.forEach(function (it) { states.push(it.state); });
    var tone = states.indexOf('check') >= 0 ? 'alert' : states.indexOf('rechecking') >= 0 ? 'warn' : states.indexOf('waiting') >= 0 || !w.rx ? 'idle' : 'ok';
    var wrist = $('#wrist');
    wrist.dataset.tone = tone;
    var label = !w.rx ? 'Restarting' : tone === 'alert' ? (wrist.classList.contains('tap') ? 'Tap!' : 'Check item') : tone === 'warn' ? 'Rechecking' : tone === 'idle' ? 'Waiting' : 'Quiet';
    if ($('#wristState').textContent !== label) $('#wristState').textContent = label;

    var r = w.room, h = '';
    h += '<rect class="out" x="' + SX(r.doorX) + '" y="30" width="' + (600 - SX(r.doorX)) + '" height="140" rx="8"/>';
    h += '<text class="lbl" x="' + (SX(r.doorX) + 10) + '" y="50">Outside</text>';
    h += '<line class="floor" x1="4" y1="171" x2="596" y2="171"/>';
    var wx = SX(w.wearer.x), range = w.rangeMeters() * (560 / 24);
    h += '<ellipse class="range" cx="' + wx.toFixed(1) + '" cy="130" rx="' + range.toFixed(1) + '" ry="62"/>';
    h += '<rect class="tbl" x="' + SX(-0.5) + '" y="118" width="' + (SX(1.5) - SX(-0.5)) + '" height="6" rx="3"/><rect class="tbl" x="' + SX(-0.4) + '" y="124" width="4" height="47"/><rect class="tbl" x="' + (SX(1.4) - 4) + '" y="124" width="4" height="47"/>';
    h += '<text class="lbl" x="' + SX(-0.4) + '" y="188">Table</text>';
    h += '<line class="door" x1="' + SX(r.doorX) + '" y1="56" x2="' + SX(r.doorX) + '" y2="171"/><text class="lbl" x="' + (SX(r.doorX) - 16) + '" y="188">Door</text>';
    if (w.friend.x != null && w.friend.x < r.endX + 1) h += person(SX(w.friend.x), 'friend') + '<text class="lbl" x="' + (SX(w.friend.x) - 20) + '" y="74">Friend</text>';
    h += person(wx, 'me', 'band' + (tone === 'alert' ? ' alerting' : ''));
    h += '<text class="lbl" x="' + (wx - 13) + '" y="74">You</text>';
    var ci = 0, ti = 0;
    w.tags.forEach(function (t) {
      var tag = demo.tagById(t.id); if (!tag) return;
      var it = w.rx ? w.rx.items.get(t.id) : null;
      if (!it) return;
      var fillc = t.dead ? 'var(--line-strong)' : TV[(META[it.state] || META.unknown).tone];
      var x, y;
      if (t.carrier === 'wearer') { x = wx - 20 - ci * 13; y = 118 + (ci % 2) * 17; ci++; }
      else if (t.carrier === 'friend') { x = SX(t.x) + 15; y = 122; }
      else { x = SX(t.x) + ti * 22; y = 105; ti++; }
      h += '<g class="' + (t.ringingUntil > w.t ? 'ringing' : '') + '"><circle class="dot" cx="' + x.toFixed(1) + '" cy="' + y + '" r="10.5" style="fill:' + fillc + (t.shielded ? ';stroke:var(--warn);stroke-dasharray:3 2' : '') + '"/>' +
        '<text class="ini" x="' + x.toFixed(1) + '" y="' + (y + 4) + '" text-anchor="middle">' + esc(tag.name.charAt(0)) + '</text></g>';
    });
    if (!w.rx) h += '<text class="lbl" x="300" y="20" text-anchor="middle" style="fill:var(--info)">Receiver restarting…</text>';
    $('#room').innerHTML = h;
    renderSimItems(false);
  }

  /* ---------------- fine control ---------------- */
  var simSig = '';
  function renderSimItems(force) {
    if (!demo) return;
    var w = demo.world(), box = $('#simItems');
    if (!w) { box.innerHTML = '<p class="muted small">Available with the demo receiver.</p>'; return; }
    var tags = demo.tags();
    var sig = tags.map(function (t) { var s = w.tags.get(t.id); return t.id + t.name + (s ? s.carrier + s.shielded + s.dead : ''); }).join('|');
    if (!force && sig === simSig) return;
    simSig = sig;
    box.innerHTML = tags.map(function (t) {
      var s = w.tags.get(t.id); if (!s) return '';
      var opt = function (v, l) { return '<option value="' + v + '"' + (s.carrier === v ? ' selected' : '') + '>' + l + '</option>'; };
      return '<div class="sim-item" data-tag="' + esc(t.id) + '"><span class="nm">' + esc(t.name) + '</span><select aria-label="Where is ' + esc(t.name) + '">' +
        opt('wearer', 'With me') + opt('table', 'Left here') + opt('friend', 'Friend has it') + '</select>' +
        '<div class="tg"><button type="button" class="mini" data-toggle="shielded" aria-pressed="' + s.shielded + '">Shielded</button>' +
        '<button type="button" class="mini" data-toggle="dead" aria-pressed="' + s.dead + '">Dead battery</button></div></div>';
    }).join('');
  }

  function renderSpeed() {
    var sp = demo ? demo.getSpeed() : 1;
    $$('#speedSeg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.speed === sp); });
  }

  /* ---------------- panel (phones) ---------------- */
  function openPanel() { $('#panel').classList.add('open'); $('#backdrop').hidden = false; }
  function closePanel() { $('#panel').classList.remove('open'); $('#backdrop').hidden = true; }
  $('#fab').addEventListener('click', openPanel);
  $('#closePanel').addEventListener('click', closePanel);
  $('#backdrop').addEventListener('click', closePanel);

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !demo) return;
    var d = b.dataset;
    if (d.moment) startMoment(d.moment);
    else if (d.act) {
      demo.act(d.act);
      if (d.act === 'reset') { demo.setLocked(false); setSingle('Back at the table with everything. Pick a moment.'); }
      if (d.act === 'walkOut' && $('#autoLock').checked) demo.setLocked(true);
      if (d.act === 'walkOut' || d.act === 'walkBack' || d.act === 'reset') closePanel();
      renderSimItems(true);
    }
    else if (d.speed) { demo.setSpeed(+d.speed); renderSpeed(); }
    else if (d.toggle) {
      var s = demo.world().tags.get(b.closest('[data-tag]').dataset.tag);
      if (s) { s[d.toggle] = !s[d.toggle]; renderSimItems(true); }
    }
    else if (b.id === 'lockBtn') demo.setLocked(!demo.isLocked());
  });
  document.addEventListener('change', function (e) {
    var sel = e.target.closest('.sim-item select');
    if (!sel || !demo) return;
    var w = demo.world(), id = sel.closest('[data-tag]').dataset.tag;
    if (sel.value === 'wearer') w.carry(id); else if (sel.value === 'table') w.leave(id); else w.handToFriend(id);
    renderSimItems(true);
  });

  $('#runLab').addEventListener('click', function () {
    var b = $('#runLab'); b.textContent = 'Running…'; b.disabled = true;
    setTimeout(function () {
      var res = window.Tali.runRuleLab({ runs: 20 });
      b.textContent = 'Run again'; b.disabled = false;
      $('#labTable').innerHTML = '<thead><tr><th>Rule</th><th>Before door</th><th>After door</th><th>Missed</th><th>Median</th><th>Bag: false alerts</th></tr></thead><tbody>' +
        res.map(function (r) {
          return '<tr><td><b>' + (r.rule ? r.rule / 1000 + ' s' : 'Immediate') + '</b></td><td>' + r.table.before + '/' + r.runs + '</td><td>' + r.table.after + '/' + r.runs + '</td><td>' + r.table.missed + '/' + r.runs +
            '</td><td>' + (r.table.median != null ? r.table.median.toFixed(1) + ' s' : '·') + '</td><td>' + r.bag.nuisance + '/' + r.runs + '</td></tr>';
        }).join('') + '</tbody>';
    }, 30);
  });

  /* ---------------- scale the phone to fit ---------------- */
  function fit() {
    if (!window.matchMedia('(min-width: 900px)').matches) return;
    var col = $('.phone-col'), s = Math.min(1, (col.clientHeight - 40) / 876, (col.clientWidth - 40) / 417);
    $('#phoneWrap').style.transform = 'scale(' + s.toFixed(3) + ')';
  }
  window.addEventListener('resize', fit);
  fit();
})();
