/* Gotcha Control: dashboard UI */
(function () {
  'use strict';
  var T = window.Gotcha, ST = T.ST;

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }
  function now() { return performance.now(); }
  function clock(ts) { var d = new Date(ts); return d.toTimeString().slice(0, 8); }
  function ago(ms) {
    if (ms == null) return 'never';
    if (ms < 1000) return 'just now';
    if (ms < 60000) return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' s ago';
    return Math.round(ms / 60000) + ' min ago';
  }

  var ICONS = {
    wallet: '<path d="M4 7.5h14.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V8"/><path d="M3 8a2.5 2.5 0 0 1 2.5-2.5H16V7.5"/><circle cx="16.5" cy="13.75" r="1.1"/>',
    pouch: '<path d="M4.5 9h15l-1.3 9.4a2 2 0 0 1-2 1.6H7.8a2 2 0 0 1-2-1.6L4.5 9Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>',
    keys: '<circle cx="8" cy="15.5" r="4"/><path d="M10.9 12.6 19 4.5M16 7.5l2.2 2.2M13.8 9.7l1.8 1.8"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2.5 19.5h19"/>',
    badge: '<rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="9" cy="11" r="2.1"/><path d="M5.8 16c.9-1.8 5.5-1.8 6.4 0M14.5 10h4M14.5 13.5h3"/>',
    bag: '<path d="M6 8h12a1.5 1.5 0 0 1 1.5 1.5V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V9.5A1.5 1.5 0 0 1 6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M4.5 13h15"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0Z"/><circle cx="8" cy="8" r="1.5"/>',
    today: '<circle cx="12" cy="12" r="2.2"/><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/>',
    lists: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.8 4.7M3.5 12 5 13.5l2.8-2.8M3.5 18 5 19.5l2.8-2.8"/>',
    log: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    walk: '<circle cx="13.5" cy="4.5" r="1.8"/><path d="m9 21 2.5-6 2.8 2.6V21M7.5 12.5 9.8 8.6l4 .9 2 3.5M11.5 15l.8-6"/>',
    still: '<circle cx="12" cy="4.5" r="1.8"/><path d="M12 8v7M8 11h8M9.5 21 12 15l2.5 6"/>',
    batt: '<rect x="2.5" y="7.5" width="17" height="9" rx="2"/><path d="M21.5 10.5v3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    radar: '<circle cx="12" cy="12" r="9"/><path d="M12 12 18 6"/><circle cx="12" cy="12" r="1.5"/>',
    rule: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>'
  };
  function icon(name, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.tag) + '</svg>'; }
  var ITEM_ICONS = ['wallet', 'pouch', 'keys', 'phone', 'laptop', 'badge', 'bag', 'tag'];

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('gotcha.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('gotcha.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del: function (k) { try { localStorage.removeItem('gotcha.' + k); } catch (e) { /* ignore */ } }
  };

  function seed() {
    return {
      v: 1,
      tags: [
        { id: 'tag-wallet', name: 'Wallet', icon: 'wallet', kind: 'tag' },
        { id: 'tag-pouch', name: 'Tool pouch', icon: 'pouch', kind: 'tag' },
        { id: 'phone-1', name: 'Phone', icon: 'phone', kind: 'phone' }
      ],
      lists: [
        { id: 'site', name: 'Site visit', tags: ['tag-wallet', 'tag-pouch', 'phone-1'] },
        { id: 'campus', name: 'Campus', tags: ['tag-wallet', 'phone-1'] }
      ],
      activeList: 'site',
      rev: 0,
      saved: null,
      settings: { mode: 'sim', url: '', confirmMs: 3000, heardRssi: -80, sound: true, vibrate: true, theme: null }
    };
  }

  var D = store.get('data', null);
  if (!D || D.v !== 1) D = seed();
  function save() { store.set('data', D); }

  var META = {
    waiting:    { label: 'Waiting',      tone: 'idle',  desc: 'Not seen yet this session' },
    nearby:     { label: 'Nearby',       tone: 'ok',    desc: 'With you' },
    rechecking: { label: 'Rechecking',   tone: 'warn',  desc: 'Signal dropped, checking again' },
    away:       { label: 'Away · quiet', tone: 'info',  desc: 'Left while you were still, no alert' },
    check:      { label: 'Check item',   tone: 'alert', desc: 'Left behind as you moved' },
    recovered:  { label: 'Recovered',    tone: 'ok',    desc: 'Back with you' },
    unknown:    { label: 'Unknown',      tone: 'idle',  desc: 'No current data' },
    unsaved:    { label: 'Not on bracelet', tone: 'idle', desc: 'Save the list to start monitoring' }
  };
  var TONE_VAR = { ok: 'var(--ok)', warn: 'var(--warn)', alert: 'var(--alert)', idle: 'var(--idle)', info: 'var(--info)' };

  /* ---------------- runtime ---------------- */
  var R = {
    transport: null, world: null, speed: 1,
    snap: null, snapAt: 0, prevUptime: null, lastEventId: 0, connectedAt: 0,
    link: 'connecting', events: [], alerts: [], trials: [], unseen: 0,
    sync: { state: 'idle' }, ringing: {}, ringQueue: {},
    view: 'today', scenario: null, scenarioUntil: 0, banner: null, lab: null
  };

  function tagById(id) { for (var i = 0; i < D.tags.length; i++) if (D.tags[i].id === id) return D.tags[i]; return null; }
  function listById(id) { for (var i = 0; i < D.lists.length; i++) if (D.lists[i].id === id) return D.lists[i]; return null; }
  function activeList() { return listById(D.activeList); }
  function snapItem(id) { if (!R.snap) return null; var a = R.snap.items || []; for (var i = 0; i < a.length; i++) if (a[i].tag_id === id) return a[i]; return null; }

  function logLocal(type, msg, name) {
    R.events.unshift({ at: Date.now(), type: type, msg: msg, name: name || null });
    if (R.events.length > 300) R.events.pop();
    if (R.view === 'log') renderEvents();
  }

  /* ---------------- transport ---------------- */
  function buildTransport() {
    if (R.transport) R.transport.stop();
    R.snap = null; R.snapAt = 0; R.lastEventId = 0; R.prevUptime = null; R.link = 'connecting';
    R.connectedAt = now();
    if (D.settings.mode === 'sim') {
      if (!R.world) {
        R.world = new T.SimWorld({ cfg: { confirmMs: D.settings.confirmMs, heardRssi: D.settings.heardRssi } });
        D.tags.forEach(function (t) { R.world.addTag({ tag_id: t.id, name: t.name, kind: t.kind }); });
        R.world.onTrial = onTrial;
      }
      R.transport = new T.SimTransport(R.world);
      R.transport.speed = R.speed;
    } else {
      R.transport = new T.HttpTransport(D.settings.url);
    }
    R.transport.start(onSnapshot);
    if (D.settings.mode === 'sim' && !R.world.flash) syncActive();
    document.body.dataset.mode = D.settings.mode;
    renderAll();
  }

  function onSnapshot(snap) {
    var first = !R.snap;
    if (R.prevUptime != null && snap.uptime_ms < R.prevUptime) R.lastEventId = 0;
    R.prevUptime = snap.uptime_ms;
    R.snap = snap; R.snapAt = now();
    (snap.events || []).forEach(function (e) {
      if (e.id > R.lastEventId) { R.lastEventId = e.id; handleEvent(e, first); }
    });
  }

  function handleEvent(e, replay) {
    logLocal(e.type, e.msg, e.name);
    emitDemo('event', e);
    if (e.type === 'alert' && !replay) {
      var a = { id: R.alerts.length + 1, at: Date.now(), tag_id: e.tag_id, name: e.name, mark: null };
      R.alerts.push(a);
      fireAlert(e);
    }
    if ((e.type === 'recovered' || (e.type === 'state' && e.state === 'nearby')) && R.banner === e.tag_id) hideBanner();
  }

  function onTrial(tr) {
    R.trials.push(tr);
    var parts = tr.leftBehind.map(function (o) { return o.name + ': ' + outcomeText(o); });
    if (tr.nuisance.length) parts.push('false alert on ' + tr.nuisance.map(function (n) { return n.name; }).join(', '));
    if (!parts.length) parts.push('nothing left behind, stayed quiet');
    emitDemo('trial', tr);
    logLocal('trial', 'Departure #' + tr.id + ' (' + tr.label + '): ' + parts.join('; '));
    if (R.view === 'log') renderLog();
  }

  function linkState() {
    if (!R.snapAt) return now() - R.connectedAt > 6000 ? 'offline' : 'connecting';
    var age = now() - R.snapAt;
    return age < 2500 ? 'live' : age < 7000 ? 'stale' : 'offline';
  }

  /* ---------------- sync ---------------- */
  function buildPayload(list, rev) {
    return {
      id: list.id, name: list.name, rev: rev,
      tags: list.tags.map(tagById).filter(Boolean).map(function (t) { return { tag_id: t.id, name: t.name, kind: t.kind }; })
    };
  }

  var syncTimer = null;
  function syncSoon() { clearTimeout(syncTimer); R.sync = { state: 'pending', listId: D.activeList }; renderSyncBits(); syncTimer = setTimeout(syncActive, 700); }

  function syncActive() {
    clearTimeout(syncTimer);
    var list = activeList();
    if (!list || !R.transport) return;
    var rev = ++D.rev; save();
    R.sync = { state: 'saving', listId: list.id, rev: rev };
    renderSyncBits();
    R.transport.syncCarry(buildPayload(list, rev)).then(function () {
      if (R.sync.rev !== rev) return;
      R.sync = { state: 'saved', listId: list.id, rev: rev, at: Date.now() };
      D.saved = { listId: list.id, rev: rev, at: Date.now() }; save();
      renderSyncBits();
    }, function (err) {
      if (R.sync.rev !== rev) return;
      R.sync = { state: 'failed', listId: list.id, rev: rev, error: err.message };
      toast('Not saved: ' + err.message, 'err');
      logLocal('link', 'List save failed: ' + err.message);
      renderSyncBits();
    });
  }

  /* What the receiver actually holds, compared with what the app wants */
  function syncStatus() {
    var s = R.sync;
    if (s.state === 'saving') return { cls: 'saving', text: 'Saving to bracelet…', spin: true };
    if (s.state === 'pending') return { cls: 'saving', text: 'Saving to bracelet…', spin: true };
    if (s.state === 'failed') return { cls: 'failed', text: 'Not saved: bracelet did not confirm', retry: true };
    if (R.snap && D.saved) {
      var l = R.snap.list;
      if (!l || l.id !== D.activeList || l.rev !== D.saved.rev) return { cls: 'pending', text: 'Bracelet has a different list', retry: true };
      return { cls: 'saved', text: 'Saved on bracelet · rev ' + l.rev };
    }
    if (D.saved && D.saved.listId === D.activeList) return { cls: 'pending', text: 'Waiting for bracelet to confirm' };
    return { cls: 'pending', text: 'Not saved to bracelet yet', retry: true };
  }

  /* ---------------- ringing ---------------- */
  function reachable(si) {
    return si && R.link === 'live' && si.last_heard_ms != null && si.last_heard_ms < 2000;
  }
  /* Ringing is a toggle: it rings until stopped (the receiver auto-stops after 60 s to save the tag battery).
     R.ringing[id] holds the state we just asked for, until the receiver's status confirms it. */
  function isRinging(id) {
    var p = R.ringing[id];
    if (p && Date.now() < p.until) return p.on;
    var si = snapItem(id);
    return !!(si && si.ringing);
  }
  function setRing(id, on) {
    var t = tagById(id), name = t ? t.name : 'tag';
    R.ringing[id] = { on: on, until: Date.now() + 2500 };
    delete R.ringQueue[id];
    R.transport.ring(id, on).then(function () {
      toast(on ? 'Ringing ' + name + '. Tap Stop when you find it' : 'Stopped ringing ' + name);
    }, function (err) {
      delete R.ringing[id];
      toast('Could not ' + (on ? 'ring' : 'stop') + ': ' + err.message, 'err');
      renderLive();
    });
    renderLive();
  }
  function onRingClick(id) {
    if (isRinging(id)) { setRing(id, false); return; }
    var si = snapItem(id);
    if (reachable(si)) setRing(id, true);
    else if (R.ringQueue[id]) { delete R.ringQueue[id]; toast('Ring cancelled'); }
    else { R.ringQueue[id] = true; toast('It will start ringing as soon as it reconnects'); }
    renderLive();
  }
  function ringLabel(id) {
    if (isRinging(id)) return 'Stop ringing';
    if (reachable(snapItem(id))) return 'Ring';
    return R.ringQueue[id] ? 'Queued ✓' : 'Ring when back';
  }
  /* buttons outside Today's cards: My items list and the alert banner */
  function renderRingButtons() {
    $$('[data-ring]').forEach(function (b) {
      var on = isRinging(b.dataset.ring);
      setText(b, on ? 'Stop ringing' : 'Ring');
      b.classList.toggle('ringing', on);
    });
    if (R.banner) {
      var ab = $('#alertRing'), on = isRinging(R.banner);
      setText(ab, on ? 'Stop ringing' : 'Ring');
      ab.classList.toggle('ringing', on);
    }
  }
  function processRingQueue() {
    Object.keys(R.ringQueue).forEach(function (id) {
      var si = snapItem(id);
      if (reachable(si) && (si.state === ST.RECOVERED || si.state === ST.NEARBY || si.state === ST.CHECK)) setRing(id, true);
    });
  }

  /* ---------------- alerts / feedback ---------------- */
  var audioCtx = null;
  function unlockAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } } }
  function beep() {
    if (!D.settings.sound || !audioCtx) return;
    try {
      [0, 0.18].forEach(function (off) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + off;
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
        o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 0.16);
      });
    } catch (e) { /* ignore */ }
  }

  function fireAlert(e) {
    var t = tagById(e.tag_id);
    R.banner = e.tag_id;
    $('#alertTitle').textContent = 'Check your ' + (t ? t.name : e.name);
    $('#alertSub').textContent = 'Your bracelet is vibrating · ' + clock(Date.now());
    $('.alert-icon').innerHTML = icon(t ? t.icon : 'bell');
    $('#alertBanner').hidden = false;
    var art = $('#bandArt');
    art.classList.remove('tap'); void art.offsetWidth; art.classList.add('tap');
    setTimeout(function () { art.classList.remove('tap'); }, 2400);
    beep();
    if (D.settings.vibrate && navigator.vibrate) { try { navigator.vibrate([140, 90, 140]); } catch (x) { /* ignore */ } }
    if (R.view !== 'log') { R.unseen++; renderNav(); }
    lockNotify(e);
    emitDemo('alert', e);
  }
  function hideBanner() { R.banner = null; $('#alertBanner').hidden = true; }

  var toastTimer = 0;
  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = msg;
    var box = $('#toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { el.remove(); }, 2800);
    toastTimer++;
  }

  /* ---------------- navigation ---------------- */
  var VIEWS = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'items', label: 'My items', icon: 'tag' },
    { id: 'lists', label: 'Lists', icon: 'lists' },
    { id: 'log', label: 'Activity', icon: 'log' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];
  function renderNav() {
    var html = VIEWS.map(function (v) {
      var badge = v.id === 'log' && R.unseen ? '<span class="badge">' + R.unseen + '</span>' : '';
      return '<button class="nav-btn" type="button" data-goto="' + v.id + '"' + (R.view === v.id ? ' aria-current="page"' : '') + '>' + icon(v.icon) + '<span>' + v.label + '</span>' + badge + '</button>';
    }).join('');
    $('.tabbar').innerHTML = html;
  }
  function goto(view) {
    if (!VIEWS.some(function (v) { return v.id === view; })) view = 'today';
    R.view = view;
    if (view === 'log') R.unseen = 0;
    $$('.view').forEach(function (s) { s.hidden = s.dataset.view !== view; });
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    renderNav();
    renderView();
    window.scrollTo(0, 0);
  }

  /* ---------------- TODAY ---------------- */
  var cardEls = {};
  function mergedItems() {
    var list = activeList();
    if (!list) return [];
    return list.tags.map(tagById).filter(Boolean).map(function (t) {
      var si = snapItem(t.id);
      return { tag: t, si: si };
    });
  }

  function itemView(m, link) {
    var si = m.si, stateKey = si ? si.state : (R.snap ? 'unsaved' : 'unknown');
    if (link === 'offline' || link === 'connecting') stateKey = 'unknown';
    return { key: stateKey, meta: META[stateKey] || META.unknown };
  }

  function renderHero(items, link) {
    var list = activeList(), tone = 'idle', title, sub = '';
    var byState = function (s) { return items.filter(function (m) { return m.si && m.si.state === s; }).map(function (m) { return m.tag.name; }); };
    var check = byState('check'), rech = byState('rechecking'), wait = byState('waiting'), away = byState('away');
    var rec = byState('recovered');
    var age = R.snapAt ? now() - R.snapAt : null;
    if (!list || !list.tags.length) { title = 'Choose what to carry'; sub = 'Pick a carry list so the bracelet knows what to watch.'; }
    else if (link === 'connecting') { title = 'Connecting to bracelet…'; sub = D.settings.mode === 'live' ? 'Polling ' + (D.settings.url || 'this device') + '/api/status' : ''; }
    else if (link === 'offline') { title = 'Bracelet offline'; sub = R.snapAt ? 'No update for ' + Math.round(age / 1000) + ' s. Item status below is unknown, not "safe".' : 'No response yet. Check the bracelet is on and you are on its Wi-Fi.'; }
    else if (!R.snap.list || R.snap.list.id !== list.id) { title = 'List not on bracelet'; sub = 'Save "' + list.name + '" so the bracelet starts watching.'; }
    else if (check.length) { tone = 'alert'; title = 'Check your ' + joinNames(check); sub = 'Your bracelet is vibrating. Head back, then ring the tag to find it.'; }
    else if (rech.length) { tone = 'warn'; title = 'Rechecking ' + joinNames(rech) + '…'; sub = 'Signal dropped. Waiting for more readings before the bracelet vibrates.'; }
    else if (rec.length) { tone = 'ok'; title = 'Found it: ' + joinNames(rec) + ' is back'; sub = 'Back in range. Tap Ring if you still cannot see it.'; }
    else if (wait.length) { title = 'Waiting for ' + joinNames(wait); sub = 'Bring it near the bracelet to arm monitoring.'; }
    else if (away.length) { tone = 'ok'; title = (items.length - away.length) + ' of ' + items.length + ' items with you'; sub = joinNames(away) + ' left while you were sitting still, so no alert (loan rule).'; }
    else { tone = 'ok'; title = items.length === 1 ? 'Your ' + items[0].tag.name.toLowerCase() + ' is with you' : 'All ' + items.length + ' items with you'; sub = away.length ? joinNames(away) + ' left while you were sitting still, so no alert (loan rule).' : 'Your bracelet vibrates if something stays behind. You can keep your phone in your pocket.'; }
    if (link === 'stale') { sub = 'Last update ' + Math.round(age / 1000) + ' s ago. Reconnecting…'; }

    var hero = $('#hero');
    hero.dataset.tone = link === 'stale' ? 'warn' : tone;
    $('#bandArt').dataset.tone = tone;
    $('#heroEyebrow').textContent = "Today's carry" + (list ? ' · ' + list.name : '');
    setText($('#heroTitle'), title);
    setText($('#heroSub'), sub);

    var pills = [];
    var ss = syncStatus();
    pills.push('<span class="pill ' + (ss.cls === 'saved' ? 'ok' : ss.cls === 'failed' ? 'alert' : 'warn') + '">' + (ss.spin ? '<span class="spinner"></span>' : icon(ss.cls === 'saved' ? 'check' : 'alert')) + esc(ss.text) + '</span>');
    if (R.snap && link !== 'offline') {
      var moving = R.snap.motion === 'moving';
      pills.push('<span class="pill ' + (moving ? 'accent' : '') + '">' + icon(moving ? 'walk' : 'still') + (moving ? 'You are moving' : 'Still') + '</span>');
      if (R.snap.battery_pct != null) pills.push('<span class="pill">' + icon('batt') + 'Band ' + R.snap.battery_pct + '%</span>');
      var cm = R.snap.config ? R.snap.config.confirm_ms : D.settings.confirmMs;
      pills.push('<span class="pill">' + icon('rule') + (cm ? 'Rule ' + cm / 1000 + ' s' : 'Immediate rule') + '</span>');
    }
    if (link === 'stale') pills.push('<span class="pill warn">Stale · ' + Math.round(age / 1000) + ' s</span>');
    setHTML($('#heroMeta'), pills.join(''));
  }

  function joinNames(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
  function setHTML(el, h) { if (el._h !== h) { el.innerHTML = h; el._h = h; } }

  function bars(rssi) {
    var n = rssi == null ? 0 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : rssi > -90 ? 1 : 0;
    var s = '<span class="bars" title="' + (rssi == null ? 'No signal' : rssi + ' dBm') + '">';
    for (var i = 1; i <= 4; i++) s += '<b class="' + (i <= n ? 'on' : '') + '"></b>';
    return s + '</span>';
  }
  function batt(p) {
    if (p == null) return '';
    return '<span class="batt' + (p < 20 ? ' low' : '') + '" title="Tag battery"><span class="shell"><span class="lvl" style="width:' + Math.max(6, p) + '%"></span></span>' + p + '%</span>';
  }

  function ensureCard(tag) {
    var el = cardEls[tag.id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'item-card';
      el.innerHTML = '<div class="item-icon"></div><div class="item-name"><span class="nm"></span><em class="item-state"></em></div>' +
        '<div class="item-actions"><button class="btn sm ring" type="button"></button></div><div class="item-detail"></div>';
      el.querySelector('.ring').addEventListener('click', function () { onRingClick(tag.id); });
      cardEls[tag.id] = el;
    }
    return el;
  }

  function renderStatusCards(items, link) {
    var box = $('#statusList');
    var list = activeList();
    if (!items.length) {
      setHTML(box, '<div class="empty">No items in ' + (list ? '"' + esc(list.name) + '"' : 'a carry list') + ' yet.<br><button class="btn primary" type="button" data-goto="lists">Choose items</button></div>');
      return;
    }
    if (box._h) { box.innerHTML = ''; box._h = null; }
    var ids = items.map(function (m) { return m.tag.id; }).join('|');
    if (box._ids !== ids) {
      box.innerHTML = '';
      items.forEach(function (m) { box.appendChild(ensureCard(m.tag)); });
      box._ids = ids;
    }
    var nowWall = Date.now(), age = R.snapAt ? now() - R.snapAt : 0;
    items.forEach(function (m) {
      var el = ensureCard(m.tag), v = itemView(m, link), si = m.si;
      el.dataset.tone = v.meta.tone;
      el.classList.toggle('stale', link === 'stale');
      setHTML(el.querySelector('.item-icon'), icon(m.tag.icon));
      el.querySelector('.item-icon').dataset.ic = m.tag.icon;
      setText(el.querySelector('.nm'), m.tag.name);
      setText(el.querySelector('.item-state'), v.meta.label);
      var detail;
      if (link === 'offline' || link === 'connecting') {
        detail = '<span>' + (si ? 'Last known: ' + (META[si.state] || META.unknown).label + ' · ' : '') + 'Dashboard offline</span>';
      } else if (!si) {
        detail = '<span>' + META.unsaved.desc + '</span>';
      } else {
        var heard = si.last_heard_ms == null ? 'Not heard yet' : 'Heard ' + ago(si.last_heard_ms + (link === 'stale' ? age : 0));
        if (isRinging(m.tag.id)) heard = '<b class="ringing-now">Ringing now</b>';
        detail = bars(link === 'stale' ? null : si.rssi) + '<span>' + heard + '</span>' + batt(si.battery_pct);
        if (v.key === 'check') detail = '<span><b style="color:var(--alert)">Left behind.</b></span>' + detail;
        if (v.key === 'away') detail = '<span>' + META.away.desc + '</span>' + detail;
      }
      setHTML(el.querySelector('.item-detail'), detail);
      var btn = el.querySelector('.ring');
      if (m.tag.kind === 'phone') { btn.hidden = true; return; }
      btn.hidden = false;
      var label = ringLabel(m.tag.id);
      setText(btn, label);
      btn.disabled = link === 'offline' || link === 'connecting';
      btn.classList.toggle('ringing', label === 'Stop ringing');
      btn.classList.toggle('primary', (v.key === 'check' || v.key === 'recovered') && label === 'Ring');
    });
    var heard = items.filter(function (m) { return m.si && (m.si.state === 'nearby' || m.si.state === 'recovered'); }).length;
    setText($('#itemsHeadMeta'), heard + ' of ' + items.length + ' nearby');
  }

  function renderLinkChip(link) {
    var chip = $('#linkChip'), txt;
    chip.dataset.link = link;
    var nm = (R.snap && R.snap.receiver) || 'Bracelet';
    if (link === 'live') txt = nm + ' · Connected';
    else if (link === 'stale') txt = 'Stale · ' + Math.round((now() - R.snapAt) / 1000) + ' s';
    else if (link === 'offline') txt = 'Bracelet offline';
    else txt = 'Connecting…';
    setText(chip.querySelector('.link-text'), txt);
  }

  var lastLink = null;
  function renderLive() {
    var link = linkState();
    if (link !== lastLink) {
      if (lastLink === 'live' && link === 'stale') logLocal('link', 'Dashboard lost its link. Showing last known status as stale');
      if (link === 'offline' && lastLink && lastLink !== 'connecting') logLocal('link', 'Bracelet offline. Item status unknown');
      if (link === 'live' && (lastLink === 'stale' || lastLink === 'offline')) logLocal('link', 'Link restored');
      lastLink = link;
    }
    R.link = link;
    processRingQueue();
    renderRingButtons();
    renderLinkChip(link);
    if (R.banner && link !== 'live') { /* keep banner; it is about a past event */ }
    if (R.view === 'today') {
      var items = mergedItems();
      renderHero(items, link);
      renderStatusCards(items, link);
    }
    if (R.view === 'lists') renderSyncBits();
  }

  /* ---------------- demo hooks (driven by the pitch stage, index.html) ---------------- */
  var listeners = [];
  function emitDemo(type, data) { listeners.forEach(function (fn) { try { fn(type, data); } catch (e) { /* listener error */ } }); }

  function runScenario(k) {
    if (!R.world || !T.SCENARIOS[k]) return false;
    var list = activeList(), tags = list ? list.tags.map(tagById).filter(Boolean) : [];
    var wallet = tags.filter(function (t) { return t.icon === 'wallet'; })[0] || tags.filter(function (t) { return t.kind !== 'phone'; })[0];
    var phone = tags.filter(function (t) { return t.kind === 'phone'; })[0];
    if ((k === 'loan' && !phone) || (k !== 'loan' && k !== 'carry' && !wallet)) return false;
    T.SCENARIOS[k].run(R.world, { primary: wallet && wallet.id, phone: phone && phone.id });
    hideBanner();
    closeSheet();
    if (R.view !== 'today') goto('today');
    return { wallet: wallet, phone: phone };
  }

  function demoAct(a) {
    var w = R.world;
    if (!w) return;
    if (a === 'walkOut') w.walkOut();
    else if (a === 'walkBack') w.walkBack();
    else if (a === 'stop') w.wearer.target = w.wearer.x;
    else if (a === 'reset') { w.resetRoom(); hideBanner(); }
    else if (a === 'reboot') w.reboot(4000);
    else if (a === 'linkDrop') R.transport.linkDownUntil = now() + 10000;
    else if (a === 'failAck') R.transport.failNextAck = true;
  }

  /* ---------------- lock screen ---------------- */
  function hm(d) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''); }
  function renderLockClock() {
    var d = new Date();
    setText($('#lockTime'), hm(d));
    setText($('#lockDate'), d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }));
    setText($('#sbTime'), hm(d));
  }
  function setLocked(on) {
    R.locked = !!on;
    $('#lock').hidden = !R.locked;
    document.body.classList.toggle('locked', R.locked);
    if (R.locked) { $('#lockNotes').innerHTML = ''; renderLockClock(); closeSheet(); }
    emitDemo('lock', R.locked);
  }
  function lockNotify(e) {
    if (!R.locked) return;
    var t = tagById(e.tag_id), name = t ? t.name : e.name;
    var n = document.createElement('button');
    n.type = 'button';
    n.className = 'notif';
    n.innerHTML = '<span class="notif-head"><span class="notif-app"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9"/><circle cx="10" cy="16" r="4"/><circle cx="23" cy="16" r="2.6"/></svg>GOTCHA</span><span>now</span></span>' +
      '<b>Check your ' + esc(name) + '</b><span>Your bracelet is vibrating. Left behind as you moved.</span>';
    n.addEventListener('click', function (ev) { ev.stopPropagation(); setLocked(false); goto('today'); });
    $('#lockNotes').insertBefore(n, $('#lockNotes').firstChild);
  }

  /* ---------------- MY ITEMS ---------------- */
  function renderItems() {
    var box = $('#itemsList');
    if (!D.tags.length) { box.innerHTML = '<div class="empty">No items yet. Pair your first tag.</div>'; return; }
    box.innerHTML = D.tags.map(function (t) {
      var si = snapItem(t.id), inLists = D.lists.filter(function (l) { return l.tags.indexOf(t.id) >= 0; }).map(function (l) { return l.name; });
      var kind = t.kind === 'phone' ? 'Phone · paired handset (pilot feature)' : 'Gotcha tag · ' + t.id;
      var status = si ? ' · ' + (META[si.state] || META.unknown).label : '';
      return '<div class="card tag-row"><div class="item-icon" data-ic="' + esc(t.icon) + '">' + icon(t.icon) + '</div><div style="min-width:0"><div class="item-name"><span>' + esc(t.name) + '</span></div>' +
        '<div class="tag-meta">' + esc(kind) + esc(status) + '</div><div class="tag-meta">' + (inLists.length ? 'In ' + esc(inLists.join(', ')) : 'Not in any list') + (si && si.battery_pct != null ? ' · ' + batt(si.battery_pct) : '') + '</div></div>' +
        '<div class="tag-actions">' + (t.kind !== 'phone' ? '<button class="btn sm" type="button" data-ring="' + t.id + '">Ring</button>' : '') +
        '<button class="btn sm" type="button" data-edit="' + t.id + '">Edit</button><button class="btn sm danger" type="button" data-remove="' + t.id + '">Remove</button></div></div>';
    }).join('');
  }

  function iconPicker(sel) {
    return '<div class="icon-pick" role="group" aria-label="Icon">' + ITEM_ICONS.map(function (i) {
      return '<button type="button" data-icon="' + i + '" aria-pressed="' + (i === sel) + '" aria-label="' + i + '">' + icon(i) + '</button>';
    }).join('') + '</div>';
  }
  function bindIconPicker(root) {
    $$('.icon-pick button', root).forEach(function (b) {
      b.addEventListener('click', function () { $$('.icon-pick button', root).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); });
    });
  }
  function pickedIcon(root) { var b = $('.icon-pick [aria-pressed="true"]', root); return b ? b.dataset.icon : 'tag'; }

  function openAddTag() {
    openSheet('Add a tag', '<div class="pulse-radar"></div><p class="muted" style="text-align:center">Looking for tags near your bracelet…<br><span class="small">Hold the new tag close to the band.</span></p>');
    R.transport.scan(D.tags.map(function (t) { return t.id; })).then(function (found) {
      if ($('#sheet').hidden) return;
      if (!found.length) { $('#sheetBody').innerHTML = '<p class="muted">No new tags found. Make sure the tag is charged and close to the bracelet.</p><div class="sheet-actions"><button class="btn" type="button" data-close>Close</button></div>'; return; }
      $('#sheetBody').innerHTML = '<p class="muted small">Found ' + found.length + ' tag' + (found.length > 1 ? 's' : '') + '. Choose the one you are holding (it has the strongest signal).</p><div class="scan-list">' +
        found.sort(function (a, b) { return b.rssi - a.rssi; }).map(function (f) {
          return '<button class="scan-row" type="button" data-pick="' + f.tag_id + '" data-hint="' + esc(f.hint || '') + '">' + icon('tag') + '<span class="grow"><b>' + esc(f.tag_id) + '</b><br><span class="muted small">Gotcha tag</span></span>' + bars(f.rssi) + '</button>';
        }).join('') + '</div>';
      $$('[data-pick]', $('#sheetBody')).forEach(function (b) { b.addEventListener('click', function () { nameNewTag(b.dataset.pick, b.dataset.hint); }); });
    }, function (err) {
      $('#sheetBody').innerHTML = '<p class="muted">Scan failed: ' + esc(err.message) + '</p><div class="sheet-actions"><button class="btn" type="button" data-close>Close</button></div>';
    });
  }

  function nameNewTag(id, hint) {
    var list = activeList();
    var guess = { Keys: 'keys', 'Laptop bag': 'laptop', Badge: 'badge' }[hint] || 'tag';
    $('#sheetTitle').textContent = 'Name your tag';
    $('#sheetBody').innerHTML = '<label class="field"><span>Name</span><input type="text" id="newTagName" maxlength="24" value="' + esc(hint || '') + '" placeholder="e.g. Keys"></label>' +
      iconPicker(guess) +
      (list ? '<label class="switch"><input type="checkbox" id="addToActive" checked><span>Add to "' + esc(list.name) + '"</span></label>' : '') +
      '<div class="sheet-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="pairBtn">Pair tag</button></div>';
    bindIconPicker($('#sheetBody'));
    var inp = $('#newTagName'); inp.focus(); inp.select();
    $('#pairBtn').addEventListener('click', function () {
      var name = inp.value.trim() || 'New tag';
      var t = { id: id, name: name, icon: pickedIcon($('#sheetBody')), kind: 'tag' };
      D.tags.push(t);
      var add = $('#addToActive') && $('#addToActive').checked;
      if (add && list) list.tags.push(id);
      save();
      if (R.world) R.world.addTag({ tag_id: t.id, name: t.name, kind: 'tag' });
      closeSheet();
      toast(name + ' paired');
      logLocal('pair', 'Paired ' + name + ' (' + id + ')');
      if (add) syncActive();
      renderAll();
    });
  }

  function openEditTag(id) {
    var t = tagById(id); if (!t) return;
    openSheet('Edit ' + t.name, '<label class="field"><span>Name</span><input type="text" id="editName" maxlength="24" value="' + esc(t.name) + '"></label>' + iconPicker(t.icon) +
      '<div class="sheet-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="saveEdit">Save</button></div>');
    bindIconPicker($('#sheetBody'));
    $('#saveEdit').addEventListener('click', function () {
      t.name = $('#editName').value.trim() || t.name;
      t.icon = pickedIcon($('#sheetBody'));
      save();
      if (R.world) R.world.renameTag(t.id, t.name);
      closeSheet();
      if (activeList() && activeList().tags.indexOf(id) >= 0) syncActive();
      renderAll();
    });
  }

  function confirmRemove(id) {
    var t = tagById(id); if (!t) return;
    openSheet('Remove ' + t.name + '?', '<p class="muted">It will be unpaired and removed from every carry list. You can pair it again later.</p>' +
      '<div class="sheet-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="doRemove" style="background:var(--alert)">Remove</button></div>');
    $('#doRemove').addEventListener('click', function () {
      var wasActive = activeList() && activeList().tags.indexOf(id) >= 0;
      D.tags = D.tags.filter(function (x) { return x.id !== id; });
      D.lists.forEach(function (l) { l.tags = l.tags.filter(function (x) { return x !== id; }); });
      save();
      if (R.world) R.world.removeTag(id);
      delete cardEls[id];
      closeSheet();
      toast(t.name + ' removed');
      if (wasActive) syncActive();
      renderAll();
    });
  }

  /* ---------------- LISTS ---------------- */
  function renderLists() {
    var box = $('#listsList');
    box.innerHTML = D.lists.map(function (l) {
      var active = l.id === D.activeList;
      var chips = D.tags.map(function (t) {
        var on = l.tags.indexOf(t.id) >= 0;
        return '<button type="button" class="chip" data-list="' + l.id + '" data-chip="' + t.id + '" aria-pressed="' + on + '">' + icon(t.icon) + esc(t.name) + '</button>';
      }).join('');
      return '<div class="card list-card' + (active ? ' active' : '') + '"><div class="card-head" style="margin:0"><div><h3>' + esc(l.name) + (active ? ' <span class="pill accent" style="margin-left:6px">Active</span>' : '') + '</h3>' +
        '<p class="muted small">' + l.tags.length + ' item' + (l.tags.length === 1 ? '' : 's') + '</p></div>' +
        '<div class="row gap"><button class="btn ghost sm" type="button" data-rename-list="' + l.id + '">Rename</button>' + (D.lists.length > 1 ? '<button class="btn ghost sm danger" type="button" data-del-list="' + l.id + '">Delete</button>' : '') + '</div></div>' +
        '<div class="chips">' + (chips || '<span class="muted small">Pair a tag first.</span>') + '</div>' +
        '<div class="list-foot">' + (active ? '<span class="sync-state" data-sync></span>' : '<span class="muted small">Not active</span>') +
        (active ? '<button class="btn sm" type="button" data-retry hidden>Save to bracelet</button>' : '<button class="btn primary sm" type="button" data-activate="' + l.id + '">Use today</button>') + '</div></div>';
    }).join('');
    renderSyncBits();
  }

  function renderSyncBits() {
    var ss = syncStatus();
    $$('[data-sync]').forEach(function (el) {
      el.className = 'sync-state ' + ss.cls;
      setHTML(el, (ss.spin ? '<span class="spinner"></span>' : icon(ss.cls === 'saved' ? 'check' : 'alert')) + esc(ss.text));
    });
    $$('[data-retry]').forEach(function (b) { b.hidden = !ss.retry; });
    if (R.view === 'today') renderHero(mergedItems(), linkState());
  }

  function openListName(id) {
    var l = id ? listById(id) : null;
    openSheet(l ? 'Rename list' : 'New carry list', '<label class="field"><span>Name</span><input type="text" id="listName" maxlength="24" value="' + esc(l ? l.name : '') + '" placeholder="e.g. Gym, Client visit"></label>' +
      '<div class="sheet-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="saveList">' + (l ? 'Save' : 'Create') + '</button></div>');
    $('#listName').focus();
    $('#saveList').addEventListener('click', function () {
      var name = $('#listName').value.trim(); if (!name) return;
      if (l) { l.name = name; if (l.id === D.activeList) syncActive(); }
      else D.lists.push({ id: uid('list'), name: name, tags: [] });
      save(); closeSheet(); renderLists();
    });
  }

  /* ---------------- LOG ---------------- */
  function outcomeText(o) {
    if (o.outcome === 'missed') return 'missed';
    return (o.outcome === 'before-door' ? 'warned before door' : 'warned after door') + ' (' + o.secs.toFixed(1) + ' s)';
  }

  function renderLog() {
    var sim = D.settings.mode === 'sim';
    $('#trialSource').textContent = sim ? 'Pilot log' : 'Mark each alert';
    $('#trialSource').style.display = '';
    var k;
    if (sim) {
      var left = 0, before = 0, missed = 0, nuis = 0, secs = [];
      R.trials.forEach(function (tr) {
        tr.leftBehind.forEach(function (o) { left++; if (o.outcome === 'before-door') before++; if (o.outcome === 'missed') missed++; if (o.secs != null) secs.push(o.secs); });
        nuis += tr.nuisance.length;
      });
      secs.sort(function (a, b) { return a - b; });
      k = [
        { k: 'Departures', v: R.trials.length, s: 'logged this session' },
        { k: 'Warned before door', v: left ? before + '/' + left : '·', s: 'items left behind' },
        { k: 'False alerts', v: nuis, s: 'item was with you' },
        { k: 'Median warning', v: secs.length ? secs[Math.floor(secs.length / 2)].toFixed(1) + ' s' : '·', s: missed + ' missed' }
      ];
      var rows = R.trials.slice().reverse().map(function (tr) {
        var res = tr.leftBehind.map(function (o) { return '<b>' + esc(o.name) + '</b>: ' + outcomeText(o); });
        tr.nuisance.forEach(function (n) { res.push('<span style="color:var(--alert)">False alert: ' + esc(n.name) + (n.shielded ? ' (shielded)' : n.dead ? ' (dead tag)' : '') + '</span>'); });
        if (!res.length) res.push('<span style="color:var(--ok)">Quiet, correct</span>');
        return '<tr><td>' + tr.id + '</td><td>' + esc(tr.label) + '</td><td>' + (tr.rule ? tr.rule / 1000 + ' s' : 'Immediate') + '</td><td>' + res.join('<br>') + '</td></tr>';
      }).join('');
      $('#trialTable').innerHTML = '<thead><tr><th>#</th><th>Scenario</th><th>Rule</th><th>Result</th></tr></thead><tbody>' +
        (rows || '<tr class="empty-row"><td colspan="4">Run a scenario from Demo controls. Each departure is logged here automatically.</td></tr>') + '</tbody>';
    } else {
      var t = R.alerts.filter(function (a) { return a.mark === 'true'; }).length, n = R.alerts.filter(function (a) { return a.mark === 'nuisance'; }).length;
      k = [
        { k: 'Alerts', v: R.alerts.length, s: 'this session' },
        { k: 'Real', v: t, s: 'item was left' },
        { k: 'Nuisance', v: n, s: 'item was with you' },
        { k: 'Unmarked', v: R.alerts.length - t - n, s: 'tap to classify' }
      ];
      var rows2 = R.alerts.slice().reverse().map(function (a) {
        return '<tr><td>' + a.id + '</td><td>' + clock(a.at) + '</td><td>' + esc(a.name) + '</td><td><div class="row gap">' +
          '<button class="btn sm' + (a.mark === 'true' ? ' primary' : '') + '" type="button" data-mark="' + a.id + '" data-v="true">Real</button>' +
          '<button class="btn sm' + (a.mark === 'nuisance' ? ' primary' : '') + '" type="button" data-mark="' + a.id + '" data-v="nuisance">Nuisance</button></div></td></tr>';
      }).join('');
      $('#trialTable').innerHTML = '<thead><tr><th>#</th><th>Time</th><th>Item</th><th>Was it real?</th></tr></thead><tbody>' +
        (rows2 || '<tr class="empty-row"><td colspan="4">No alerts yet. Each alert from the bracelet appears here for you to classify.</td></tr>') + '</tbody>';
    }
    $('#kpis').innerHTML = k.map(function (x) { return '<div class="kpi"><div class="k">' + esc(x.k) + '</div><div class="v">' + esc(String(x.v)) + '</div><div class="s">' + esc(x.s) + '</div></div>'; }).join('');
    renderEvents();
  }

  function renderEvents() {
    var ol = $('#eventList');
    if (!R.events.length) { ol.innerHTML = '<li><span></span><span class="muted">Nothing yet.</span></li>'; return; }
    ol.innerHTML = R.events.slice(0, 150).map(function (e) {
      return '<li><time>' + clock(e.at) + '</time><span class="ev-' + esc(e.type) + '">' + esc(e.msg) + '</span></li>';
    }).join('');
  }

  function exportCSV() {
    var src = D.settings.mode === 'sim' ? 'SIMULATED' : 'LIVE';
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [['source', 'kind', 'time', 'scenario', 'rule_ms', 'item', 'result', 'secs_from_departure'].join(',')];
    R.trials.forEach(function (tr) {
      tr.leftBehind.forEach(function (o) { lines.push([src, 'departure', tr.id, tr.label, tr.rule, o.name, o.outcome, o.secs == null ? '' : o.secs.toFixed(2)].map(q).join(',')); });
      tr.nuisance.forEach(function (n) { lines.push([src, 'departure', tr.id, tr.label, tr.rule, n.name, 'false-alert', ''].map(q).join(',')); });
      if (!tr.leftBehind.length && !tr.nuisance.length) lines.push([src, 'departure', tr.id, tr.label, tr.rule, '', 'quiet', ''].map(q).join(','));
    });
    R.alerts.forEach(function (a) { lines.push([src, 'alert', new Date(a.at).toISOString(), '', '', a.name, a.mark || 'unmarked', ''].map(q).join(',')); });
    R.events.slice().reverse().forEach(function (e) { lines.push([src, 'event:' + e.type, new Date(e.at).toISOString(), '', '', e.name || '', e.msg, ''].map(q).join(',')); });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gotcha-log-' + src.toLowerCase() + '-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------------- SETTINGS ---------------- */
  function isDark() {
    var t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme() { if (D.settings.theme) document.documentElement.dataset.theme = D.settings.theme; else delete document.documentElement.dataset.theme; }

  function renderSettings() {
    var s = D.settings;
    $$('#modeSeg button').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === s.mode); });
    $('#liveFields').hidden = s.mode !== 'live';
    $('#rxUrl').value = s.url;
    $$('#ruleSeg button').forEach(function (b) { b.setAttribute('aria-checked', +b.dataset.rule === s.confirmMs); });
    $('#rssiRange').value = s.heardRssi;
    $('#rssiVal').textContent = s.heardRssi + ' dBm' + (s.mode === 'sim' && R.world ? ' · about ' + R.world.rangeMeters().toFixed(1) + ' m in the sim' : '');
    $('#optSound').checked = s.sound;
    $('#optVibrate').checked = s.vibrate;
    $('#optTheme').checked = isDark();
  }

  function pushConfig() {
    save();
    if (!R.transport) return;
    R.transport.setConfig({ confirmMs: D.settings.confirmMs, heardRssi: D.settings.heardRssi }).then(function () {
      toast('Bracelet updated: ' + (D.settings.confirmMs ? D.settings.confirmMs / 1000 + ' s rule' : 'immediate rule') + ', ' + D.settings.heardRssi + ' dBm');
    }, function (e) { toast('Could not update bracelet: ' + e.message, 'err'); });
  }

  /* ---------------- sheet ---------------- */
  var lastFocus = null;
  function openSheet(title, body) {
    lastFocus = document.activeElement;
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = body;
    $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
    setTimeout(function () { var f = $('#sheet input, #sheet button:not(#sheetClose)'); if (f) f.focus(); }, 30);
  }
  function closeSheet() {
    $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- render dispatch ---------------- */
  function renderView() {
    if (R.view === 'today') { $('#statusList')._ids = null; renderLive(); }
    if (R.view === 'items') renderItems();
    if (R.view === 'lists') renderLists();
    if (R.view === 'log') renderLog();
    if (R.view === 'settings') renderSettings();
  }
  function renderAll() {
    renderNav(); renderView(); renderLinkChip(linkState());
    emitDemo('render', null);
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    unlockAudio();
    var t = e.target.closest('button, [data-goto]');
    if (!t) return;
    var d = t.dataset;
    if (d.goto) { goto(d.goto); return; }
    if (d.close != null) { closeSheet(); return; }
    if (d.ring) { onRingClick(d.ring); return; }
    if (d.edit) { openEditTag(d.edit); return; }
    if (d.remove) { confirmRemove(d.remove); return; }
    if (d.chip) {
      var l = listById(d.list), i = l.tags.indexOf(d.chip);
      if (i >= 0) l.tags.splice(i, 1); else l.tags.push(d.chip);
      save();
      if (l.id === D.activeList) { $('#statusList')._ids = null; syncSoon(); }
      renderLists(); return;
    }
    if (d.activate) { D.activeList = d.activate; save(); $('#statusList')._ids = null; syncActive(); renderLists(); toast('"' + activeList().name + '" is now today\'s carry'); return; }
    if (d.retry != null) { syncActive(); return; }
    if (d.renameList) { openListName(d.renameList); return; }
    if (d.delList) {
      D.lists = D.lists.filter(function (x) { return x.id !== d.delList; });
      if (D.activeList === d.delList) { D.activeList = D.lists[0].id; syncActive(); }
      save(); renderLists(); return;
    }
    if (d.mark) { var a = R.alerts[+d.mark - 1]; if (a) { a.mark = a.mark === d.v ? null : d.v; renderLog(); } return; }
  });



  $('#alertDismiss').addEventListener('click', hideBanner);
  $('#alertRing').addEventListener('click', function () { if (R.banner) onRingClick(R.banner); });
  $('#addTagBtn').addEventListener('click', openAddTag);
  $('#newListBtn').addEventListener('click', function () { openListName(null); });
  $('#exportBtn').addEventListener('click', exportCSV);
  $('#clearLog').addEventListener('click', function () { R.events = []; renderEvents(); });
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  $('#lock').addEventListener('click', function () { setLocked(false); });

  $$('#modeSeg button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (D.settings.mode === b.dataset.mode) return;
      D.settings.mode = b.dataset.mode; save();
      hideBanner();
      if (D.settings.mode === 'sim') buildTransport(); else { renderSettings(); if (R.transport) R.transport.stop(); R.transport = new T.HttpTransport(D.settings.url); R.snap = null; R.snapAt = 0; R.connectedAt = now(); R.transport.start(onSnapshot); document.body.dataset.mode = 'live'; renderAll(); }
    });
  });
  $('#connectBtn').addEventListener('click', function () {
    D.settings.url = $('#rxUrl').value.trim(); save();
    buildTransport();
    toast('Connecting to ' + (D.settings.url || 'this device') + '…');
  });
  $$('#ruleSeg button').forEach(function (b) {
    b.addEventListener('click', function () { D.settings.confirmMs = +b.dataset.rule; renderSettings(); pushConfig(); });
  });
  $('#rssiRange').addEventListener('input', function (e) { D.settings.heardRssi = +e.target.value; renderSettings(); });
  $('#rssiRange').addEventListener('change', pushConfig);
  $('#optSound').addEventListener('change', function (e) { D.settings.sound = e.target.checked; save(); });
  $('#optVibrate').addEventListener('change', function (e) { D.settings.vibrate = e.target.checked; save(); });
  $('#optTheme').addEventListener('change', function (e) { D.settings.theme = e.target.checked ? 'dark' : 'light'; save(); applyTheme(); });
  $('#resetBtn').addEventListener('click', function () {
    openSheet('Reset demo data?', '<p class="muted">Restores the sample items, lists and settings on this device. Logs from this session are cleared.</p><div class="sheet-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="doReset">Reset</button></div>');
    $('#doReset').addEventListener('click', function () { store.del('data'); location.hash = ''; location.reload(); });
  });
  window.addEventListener('hashchange', function () { goto(location.hash.slice(1)); });

  /* ---------------- boot ---------------- */
  applyTheme();
  R.view = (location.hash.slice(1)) || 'today';
  buildTransport();
  goto(R.view);
  if (/[?&]frame=1/.test(location.search)) document.body.classList.add('framed');
  renderLockClock();
  setInterval(function () { renderLive(); }, 250);
  setInterval(renderLockClock, 10000);

  window.GotchaDemo = {
    runScenario: runScenario, act: demoAct,
    setSpeed: function (x) { R.speed = x; if (R.transport) R.transport.speed = x; },
    getSpeed: function () { return R.speed; },
    world: function () { return R.world; }, transport: function () { return R.transport; },
    tags: function () { return D.tags; }, activeList: activeList, tagById: tagById,
    META: META, TONE_VAR: TONE_VAR, mode: function () { return D.settings.mode; },
    setLocked: setLocked, isLocked: function () { return !!R.locked; },
    goto: goto, subscribe: function (fn) { listeners.push(fn); }
  };
  if (window.parent !== window) { try { window.parent.postMessage({ gotcha: 'ready' }, location.origin); } catch (e) { /* ignore */ } }
})();
