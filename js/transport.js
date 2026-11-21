/* Transports: one interface, two implementations.
 *   start(onSnapshot)  stop()
 *   syncCarry(list) -> Promise<{ack, rev}>   (resolves ONLY when the receiver acknowledges)
 *   ring(tagId, on) -> Promise         (toggle: true starts ringing, false stops it)
 *   scan()          -> Promise<[{tag_id, rssi, kind}]>
 *   setConfig(cfg)  -> Promise
 * The dashboard never talks to SimWorld directly except for the simulated room view.
 */
(function (G) {
  'use strict';

  function SimTransport(world) {
    this.world = world;
    this.speed = 1;
    this.linkDownUntil = 0;
    this.failNextAck = false;
    this.unpaired = [
      { tag_id: 'tag-4f2a', kind: 'tag', hint: 'Keys' },
      { tag_id: 'tag-9c1e', kind: 'tag', hint: 'Laptop bag' },
      { tag_id: 'tag-b70d', kind: 'tag', hint: 'Badge' }
    ];
  }

  SimTransport.prototype.kind = 'sim';

  SimTransport.prototype.start = function (onSnap) {
    var self = this, last = performance.now(), since = 0;
    this.onSnap = onSnap;
    this.timer = setInterval(function () {
      var n = performance.now(), dt = Math.min(3000, n - last) * self.speed;
      last = n;
      while (dt > 0) { var s = Math.min(dt, 50); self.world.step(s); dt -= s; since += s; }
      if (since >= 400 * self.speed) { since = 0; self._emit(); }
    }, 50);
  };

  SimTransport.prototype.stop = function () { clearInterval(this.timer); };

  SimTransport.prototype.linkUp = function () { return performance.now() >= this.linkDownUntil; };

  SimTransport.prototype._emit = function () {
    var w = this.world;
    if (!w.rx || !this.linkUp()) return;
    this.onSnap(w.rx.snapshot(w.t, { receiver: 'Gotcha Bracelet', battery_pct: Math.round(w.rxBattery) }));
  };

  SimTransport.prototype._later = function (fn) {
    var self = this;
    return new Promise(function (res, rej) {
      setTimeout(function () {
        if (!self.world.rx || !self.linkUp()) return rej(new Error('Bracelet did not respond'));
        try { res(fn()); } catch (e) { rej(e); }
      }, 350 + Math.random() * 550);
    });
  };

  SimTransport.prototype.syncCarry = function (list) {
    var self = this;
    return this._later(function () {
      if (self.failNextAck) { self.failNextAck = false; throw new Error('No acknowledgement from bracelet'); }
      self.world.saveList(list);
      return { ack: true, rev: list.rev };
    });
  };

  SimTransport.prototype.ring = function (tagId, on) {
    var self = this;
    return this._later(function () {
      if (!self.world.ringTag(tagId, on !== false)) throw new Error('Tag not reachable right now');
      return { ringing: on !== false };
    });
  };

  SimTransport.prototype.scan = function (pairedIds) {
    var self = this;
    return this._later(function () {
      return self.unpaired.filter(function (u) { return pairedIds.indexOf(u.tag_id) < 0; })
        .map(function (u) { return Object.assign({ rssi: -48 - Math.round(Math.random() * 20) }, u); });
    });
  };

  SimTransport.prototype.setConfig = function (cfg) {
    this.world.setConfig(cfg);
    return Promise.resolve({ ok: true });
  };

  /* ------------------------------------------------------------------ */
  function HttpTransport(base) {
    this.base = (base || '').replace(/\/+$/, '');
    this.pollMs = 700;
  }

  HttpTransport.prototype.kind = 'live';

  function withTimeout(ms) {
    if (typeof AbortController === 'undefined') return {};
    var c = new AbortController();
    setTimeout(function () { c.abort(); }, ms);
    return { signal: c.signal };
  }

  HttpTransport.prototype._req = function (path, method, body) {
    var opts = Object.assign({ method: method || 'GET', cache: 'no-store' }, withTimeout(2500));
    if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    return fetch(this.base + path, opts).then(function (r) {
      if (!r.ok) throw new Error('Bracelet returned HTTP ' + r.status);
      return r.json();
    });
  };

  HttpTransport.prototype.start = function (onSnap) {
    var self = this;
    this.stopped = false;
    (function loop() {
      if (self.stopped) return;
      self._req('/api/status').then(onSnap, function () {}).then(function () {
        if (!self.stopped) self.timer = setTimeout(loop, self.pollMs);
      });
    })();
  };

  HttpTransport.prototype.stop = function () { this.stopped = true; clearTimeout(this.timer); };

  HttpTransport.prototype.syncCarry = function (list) {
    return this._req('/api/carry', 'POST', list).then(function (j) {
      if (!j || !j.ack) throw new Error('Bracelet did not acknowledge');
      return j;
    });
  };
  HttpTransport.prototype.ring = function (tagId, on) { return this._req('/api/ring', 'POST', { tag_id: tagId, on: on !== false, max_ms: 60000 }); };
  HttpTransport.prototype.scan = function () { return this._req('/api/scan').then(function (j) { return j.tags || []; }); };
  HttpTransport.prototype.setConfig = function (cfg) {
    return this._req('/api/config', 'POST', { confirm_ms: cfg.confirmMs, heard_rssi: cfg.heardRssi });
  };

  G.Gotcha = G.Gotcha || {};
  G.Gotcha.SimTransport = SimTransport;
  G.Gotcha.HttpTransport = HttpTransport;
})(window);
