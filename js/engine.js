/* Gotcha engine
 * ReceiverLogic: the per-item alert state machine. It is written to mirror what the
 *   ESP32 receiver firmware should do, so the simulator and the real device behave alike.
 * SimWorld: a simulated room (wearer, table, door, tags, a friend) that feeds BLE-like
 *   advertisements with realistic RSSI noise and packet loss into ReceiverLogic.
 * runRuleLab: headless batch runs comparing alert rules (immediate / 3 s / 5 s).
 */
(function (G) {
  'use strict';

  var ST = { WAITING: 'waiting', NEARBY: 'nearby', RECHECKING: 'rechecking', AWAY: 'away', CHECK: 'check', RECOVERED: 'recovered' };

  var DEFAULTS = {
    dropMs: 1500,            // no strong advert for this long -> Rechecking
    confirmMs: 3000,         // confirmation window once the wearer is moving (0 = immediate)
    aroundDepartureMs: 3000, // item must have been heard this close to the departure to alert
    recoverPackets: 3,       // consistent readings needed to recover / re-arm
    recoverWindowMs: 2500,
    recoveredHoldMs: 8000,
    heardRssi: -80,          // weaker than this counts as "not heard"
    ringGraceMs: 1500        // ringing pauses adverts on the tag; do not treat that as a loss
  };

  /* ------------------------------------------------------------------ */
  function ReceiverLogic(cfg, now) {
    this.cfg = Object.assign({}, DEFAULTS, cfg || {});
    this.items = new Map();
    this.moving = false;
    this.moveSince = 0;
    this.bootAt = now || 0;
    this.list = null;
    this.eventSeq = 0;
    this.events = [];
    this.onEvent = null;
  }

  ReceiverLogic.prototype.setConfig = function (c) { Object.assign(this.cfg, c); };

  ReceiverLogic.prototype.loadList = function (list, now, quiet) {
    this.list = { id: list.id, name: list.name, rev: list.rev };
    var next = new Map();
    var self = this;
    list.tags.forEach(function (t) {
      var prev = self.items.get(t.tag_id);
      if (prev) { prev.name = t.name; next.set(t.tag_id, prev); }
      else next.set(t.tag_id, self._newItem(t));
    });
    this.items = next;
    if (!quiet) this._emit(now, 'list', null, 'Saved "' + list.name + '" (rev ' + list.rev + ') · ' + list.tags.length + ' items');
  };

  ReceiverLogic.prototype._newItem = function (t) {
    return { tag_id: t.tag_id, name: t.name, state: ST.WAITING, stateSince: 0, lastHeard: 0, lastAdv: 0, rssi: null,
      heard: [], lossAt: 0, alertAt: 0, recoveredAt: 0, battery: null, ringingUntil: 0, incidents: 0 };
  };

  ReceiverLogic.prototype._emit = function (now, type, it, msg, extra) {
    var e = Object.assign({ id: ++this.eventSeq, t: Math.round(now), type: type, tag_id: it ? it.tag_id : null, name: it ? it.name : null, msg: msg }, extra || {});
    this.events.push(e);
    if (this.events.length > 40) this.events.shift();
    if (this.onEvent) this.onEvent(e);
  };

  ReceiverLogic.prototype.onAdvert = function (id, rssi, now, battery) {
    var it = this.items.get(id);
    if (!it) return;
    it.rssi = it.rssi == null || now - it.lastAdv > 3000 ? rssi : Math.round(it.rssi * 0.6 + rssi * 0.4);
    it.lastAdv = now;
    if (battery != null) it.battery = battery;
    if (rssi >= this.cfg.heardRssi) { it.lastHeard = now; it.heard.push(now); }
  };

  ReceiverLogic.prototype.setMotion = function (moving, now) {
    if (moving && !this.moving) this.moveSince = now;
    this.moving = moving;
  };

  ReceiverLogic.prototype.noteRing = function (id, now, ms) {
    var it = this.items.get(id);
    if (it) it.ringingUntil = now + ms;
  };

  ReceiverLogic.prototype._set = function (it, st, now, msg, type) {
    it.state = st; it.stateSince = now;
    if (msg) this._emit(now, type || 'state', it, msg, { state: st });
  };

  ReceiverLogic.prototype.tick = function (now) {
    var c = this.cfg, self = this;
    this.items.forEach(function (it) {
      it.heard = it.heard.filter(function (t) { return now - t <= c.recoverWindowMs; });
      var recent = it.lastHeard > 0 && now - it.lastHeard < c.dropMs;
      var consistent = recent && it.heard.length >= c.recoverPackets;
      var grace = now < it.ringingUntil + c.ringGraceMs;
      switch (it.state) {
        case ST.WAITING:
          if (recent) self._set(it, ST.NEARBY, now, it.name + ' seen, monitoring armed', 'armed');
          break;
        case ST.NEARBY:
          if (!recent && !grace) { it.lossAt = it.lastHeard; self._set(it, ST.RECHECKING, now, it.name + ' signal dropped, rechecking'); }
          break;
        case ST.RECHECKING: {
          var since = it.heard.filter(function (t) { return t > it.lossAt; }).length;
          if (recent && (consistent || since >= 2)) { self._set(it, ST.NEARBY, now, it.name + ' back, brief interruption ignored'); break; }
          if (self.moving) {
            var seenAround = (self.moveSince - it.lastHeard) <= c.aroundDepartureMs;
            if (!seenAround) { self._set(it, ST.AWAY, now, it.name + ' was already away before you moved, staying quiet', 'suppressed'); break; }
            var ref = Math.max(it.lossAt, self.moveSince);
            if (now - ref >= c.confirmMs) {
              it.alertAt = now; it.incidents++;
              self._set(it, ST.CHECK, now, 'Check ' + it.name + ': left behind as you moved', 'alert');
            }
          } else if (now - it.lossAt >= Math.max(c.confirmMs, 2000) + 1000) {
            self._set(it, ST.AWAY, now, it.name + ' moved away while you were still, quiet (loan rule)', 'suppressed');
          }
          break;
        }
        case ST.AWAY:
          if (consistent) self._set(it, ST.NEARBY, now, it.name + ' nearby again');
          break;
        case ST.CHECK:
          if (consistent) { it.recoveredAt = now; self._set(it, ST.RECOVERED, now, it.name + ' recovered', 'recovered'); }
          break;
        case ST.RECOVERED:
          if (!recent && !grace) { it.lossAt = it.lastHeard; self._set(it, ST.RECHECKING, now, it.name + ' signal dropped, rechecking'); }
          else if (now - it.recoveredAt >= c.recoveredHoldMs) self._set(it, ST.NEARBY, now, null);
          break;
      }
    });
  };

  /* Snapshot in the exact JSON shape of GET /api/status (see docs/API.md) */
  ReceiverLogic.prototype.snapshot = function (now, extra) {
    var c = this.cfg, items = [];
    this.items.forEach(function (it) {
      items.push({
        tag_id: it.tag_id, name: it.name, state: it.state,
        rssi: it.lastAdv && now - it.lastAdv < 3000 ? it.rssi : null,
        last_heard_ms: it.lastHeard ? Math.round(now - it.lastHeard) : null,
        battery_pct: it.battery, ringing: now < it.ringingUntil
      });
    });
    return Object.assign({
      fw: 'gotcha-rx 0.4.0', uptime_ms: Math.round(now - this.bootAt),
      motion: this.moving ? 'moving' : 'still',
      list: this.list,
      config: { confirm_ms: c.confirmMs, drop_ms: c.dropMs, heard_rssi: c.heardRssi },
      items: items,
      events: this.events.slice(-30)
    }, extra || {});
  };

  /* ------------------------------------------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var ROOM = { tableX: 0, seatX: 0.8, doorX: 15, endX: 24 };

  function SimWorld(opts) {
    opts = opts || {};
    this.rand = mulberry32(opts.seed != null ? opts.seed : (Date.now() & 0xffffffff));
    this.cfg = Object.assign({}, DEFAULTS, opts.cfg || {});
    this.t = 0;
    this.room = ROOM;
    this.wearer = { x: ROOM.seatX, target: ROOM.seatX, speed: 1.3, vx: 0 };
    this.friend = { x: null, target: null, speed: 1.25, vx: 0 };
    this.tags = new Map();
    this.queue = [];
    this.flash = null;
    this.rxBattery = 86;
    this.rxDownUntil = 0;
    this.label = 'Manual';
    this.departure = null;
    this.trials = [];
    this.onEvent = null;
    this.onTrial = null;
    this.lastMoving = false;
    this._bootRx(true);
  }

  SimWorld.prototype._gauss = function () {
    var u = 1 - this.rand(), v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  SimWorld.prototype._bootRx = function (first) {
    var self = this;
    this.rx = new ReceiverLogic(this.cfg, this.t);
    this.rx.onEvent = function (e) { self._hookEvent(e); if (self.onEvent) self.onEvent(e); };
    if (this.flash) {
      this.rx.loadList(this.flash, this.t, true);
      if (!first) this.rx._emit(this.t, 'reboot', null, 'Receiver restarted: reloaded "' + this.flash.name + '" rev ' + this.flash.rev + ', waiting to see each item before arming');
    }
  };

  SimWorld.prototype.setConfig = function (c) {
    Object.assign(this.cfg, c);
    if (this.rx) this.rx.setConfig(c);
  };

  SimWorld.prototype.addTag = function (t) {
    this.tags.set(t.tag_id, {
      id: t.tag_id, name: t.name, kind: t.kind || 'tag', carrier: 'wearer', x: this.wearer.x,
      shielded: false, dead: false, battery: t.battery != null ? t.battery : 70 + Math.round(this.rand() * 25),
      nextAdv: this.t + this.rand() * 300, ringingUntil: 0
    });
  };
  SimWorld.prototype.removeTag = function (id) { this.tags.delete(id); };
  SimWorld.prototype.renameTag = function (id, name) { var t = this.tags.get(id); if (t) t.name = name; };

  SimWorld.prototype.saveList = function (list) {
    this.flash = JSON.parse(JSON.stringify(list));
    if (this.rx) this.rx.loadList(this.flash, this.t);
  };

  SimWorld.prototype.reboot = function (ms) {
    if (!this.rx) return;
    this.rx = null;
    this.rxDownUntil = this.t + (ms || 4000);
  };

  /* Ringing is a toggle. on=true starts it (auto-stops after maxMs, default 60 s); on=false stops it.
     While ringing, the receiver holds a connection to the tag, so presence keeps updating. */
  SimWorld.prototype.ringTag = function (id, on, maxMs) {
    var t = this.tags.get(id);
    if (!t || !this.rx) return false;
    var it = this.rx.items.get(id);
    if (!on) {
      if (t.ringingUntil > this.t) {
        t.ringingUntil = 0;
        if (it) { it.ringingUntil = 0; this.rx._emit(this.t, 'ring', it, 'Stopped ringing ' + it.name); }
      }
      return true;
    }
    if (t.dead) return false;
    var reachable = it && it.lastHeard && this.t - it.lastHeard < 2000;
    if (!reachable) return false;
    var ms = maxMs || 60000;
    t.ringingUntil = this.t + ms;
    this.rx.noteRing(id, this.t, ms);
    this.rx._emit(this.t, 'ring', it, 'Ringing ' + it.name + ' until stopped');
    return true;
  };

  SimWorld.prototype.at = function (ms, fn) { this.queue.push({ t: this.t + ms, fn: fn }); this.queue.sort(function (a, b) { return a.t - b.t; }); };

  SimWorld.prototype.distance = function (tag) { return Math.hypot(tag.x - this.wearer.x, tag.carrier === 'wearer' ? 0.35 : 0.7); };

  /* -- scenario helpers -- */
  SimWorld.prototype.resetRoom = function () {
    var self = this;
    this.queue = [];
    this.wearer.x = this.wearer.target = ROOM.seatX;
    this.friend.x = this.friend.target = null;
    this.tags.forEach(function (t) { t.carrier = 'wearer'; t.x = self.wearer.x; t.shielded = false; t.dead = false; });
    this.departure = null;
    this.label = 'Manual';
  };
  SimWorld.prototype.walkOut = function () { this.wearer.target = ROOM.endX; };
  SimWorld.prototype.walkBack = function () { this.wearer.target = ROOM.seatX; };
  SimWorld.prototype.leave = function (id) { var t = this.tags.get(id); if (t) { t.carrier = 'table'; t.x = Math.max(0.3, this.wearer.x - 0.2); } };
  SimWorld.prototype.carry = function (id) { var t = this.tags.get(id); if (t) t.carrier = 'wearer'; };
  SimWorld.prototype.handToFriend = function (id) {
    var t = this.tags.get(id); if (!t) return;
    if (this.friend.x == null) this.friend.x = this.wearer.x + 0.8;
    t.carrier = 'friend';
    this.friend.target = ROOM.endX + 6;
  };

  /* -- departure tracking (ground truth for trial logging) -- */
  SimWorld.prototype._hookEvent = function (e) {
    var d = this.departure;
    if (d && !d.done && e.type === 'alert' && !d.alerts[e.tag_id]) {
      d.alerts[e.tag_id] = { t: e.t, x: this.wearer.x };
    }
  };

  SimWorld.prototype._trackDeparture = function (moving) {
    var w = this.wearer, self = this;
    if (moving && !this.lastMoving && w.x < 3 && w.target > ROOM.doorX && (!this.departure || this.departure.done)) {
      var near = [];
      if (this.rx) this.rx.items.forEach(function (it) {
        var t = self.tags.get(it.tag_id);
        if (t && Math.abs(t.x - w.x) < 3 && it.state !== ST.WAITING) near.push(it.tag_id);
      });
      this.departure = { t0: this.t, label: this.label, rule: this.cfg.confirmMs, near: near, alerts: {}, done: false };
    }
    var d = this.departure;
    if (d && !d.done) {
      if (w.x >= ROOM.endX - 0.3 && !d.arrivedAt) d.arrivedAt = this.t;
      var abort = w.target < ROOM.doorX && w.x < ROOM.doorX;
      if ((d.arrivedAt && this.t - d.arrivedAt > 2500) || abort) this._finishDeparture(abort);
    }
  };

  SimWorld.prototype._finishDeparture = function (aborted) {
    var d = this.departure, self = this;
    d.done = true;
    if (aborted) return;
    var left = d.near.filter(function (id) { var t = self.tags.get(id); return t && t.carrier !== 'wearer'; });
    var outcomes = left.map(function (id) {
      var a = d.alerts[id], t = self.tags.get(id);
      if (!a) return { tag_id: id, name: t.name, outcome: 'missed', secs: null };
      return { tag_id: id, name: t.name, outcome: a.x <= ROOM.doorX ? 'before-door' : 'after-door', secs: (a.t - d.t0) / 1000 };
    });
    var nuisance = Object.keys(d.alerts).filter(function (id) { return left.indexOf(id) < 0; })
      .map(function (id) { var t = self.tags.get(id); return { tag_id: id, name: t ? t.name : id, dead: t && t.dead, shielded: t && t.shielded }; });
    var trial = { id: this.trials.length + 1, t: this.t, label: d.label, rule: d.rule, leftBehind: outcomes, nuisance: nuisance };
    this.trials.push(trial);
    if (this.onTrial) this.onTrial(trial);
  };

  function moveToward(p, dt) {
    if (p.x == null || p.target == null) { p.vx = 0; return; }
    var dx = p.target - p.x, step = p.speed * dt / 1000;
    if (Math.abs(dx) <= step) { p.vx = 0; p.x = p.target; }
    else { p.vx = Math.sign(dx) * p.speed; p.x += Math.sign(dx) * step; }
  }

  SimWorld.prototype.step = function (dt) {
    this.t += dt;
    var now = this.t, self = this;
    while (this.queue.length && this.queue[0].t <= now) this.queue.shift().fn(this);
    if (!this.rx && now >= this.rxDownUntil) this._bootRx(false);

    moveToward(this.wearer, dt);
    moveToward(this.friend, dt);
    var moving = Math.abs(this.wearer.vx) > 0.15;
    this.rxBattery = Math.max(5, this.rxBattery - dt / 1000 * 0.0015);

    this.tags.forEach(function (t) {
      if (t.carrier === 'wearer') t.x = self.wearer.x;
      else if (t.carrier === 'friend' && self.friend.x != null) t.x = self.friend.x;
      if (!t.dead) t.battery = Math.max(1, t.battery - dt / 1000 * 0.0008);
    });

    if (this.rx) {
      this.rx.setMotion(moving, now);
      this.tags.forEach(function (t) {
        if (t.dead || now < t.nextAdv) return;
        t.nextAdv = now + 200 + self.rand() * 100;
        if (self.rand() < 0.07) return;            // packet loss
        var d = self.distance(t);
        var rssi = -55 - 30 * Math.log10(Math.max(d, 0.3)) + self._gauss() * 3;
        if (t.carrier === 'wearer') rssi -= 4;     // body attenuation
        if (t.shielded) rssi -= 40;                // foil / dense bag
        if (rssi < -98) return;
        self.rx.onAdvert(t.id, Math.round(rssi), now, Math.round(t.battery));
      });
      this.rx.tick(now);
    }
    this._trackDeparture(moving);
    this.lastMoving = moving;
  };

  SimWorld.prototype.rangeMeters = function () { return Math.pow(10, (-55 - this.cfg.heardRssi) / 30); };

  /* -- scripted scenarios (shared by the live demo and the rule lab) -- */
  var SCENARIOS = {
    leave: {
      title: 'Walk away, wallet left on table',
      desc: 'You unpack, stand up and leave. The wallet stays behind. Expect one tap naming the wallet.',
      run: function (w, ids) { w.resetRoom(); w.label = 'Wallet left on table'; w.at(1200, function () { w.leave(ids.primary); }); w.at(2200, function () { w.walkOut(); }); }
    },
    carry: {
      title: 'Carry everything',
      desc: 'Everything goes with you, wallet in the bag. Expect a quiet wearable.',
      run: function (w) { w.resetRoom(); w.label = 'Carry everything'; w.at(1500, function () { w.walkOut(); }); }
    },
    loan: {
      title: 'Friend borrows your phone',
      desc: 'You stay seated while a friend walks off with your phone, then you leave later. Expect no alert (loan tradeoff).',
      run: function (w, ids) {
        w.resetRoom(); w.label = 'Phone lent while seated';
        w.at(1000, function () { w.handToFriend(ids.phone); });
        w.at(11000, function () { w.walkOut(); });
      }
    },
    shielded: {
      title: 'Wallet in a shielded bag',
      desc: 'Known limitation. A foil-lined bag hides the tag, so the receiver can raise a false alert.',
      run: function (w, ids) { w.resetRoom(); w.label = 'Shielded bag'; w.at(1200, function () { var t = w.tags.get(ids.primary); if (t) t.shielded = true; }); w.at(2200, function () { w.walkOut(); }); }
    },
    dead: {
      title: 'Tag battery dies on the way',
      desc: 'Known limitation. A dead tag looks the same as a missing one, and the cue fires.',
      run: function (w, ids) { w.resetRoom(); w.label = 'Dead tag'; w.at(1500, function () { w.walkOut(); }); w.at(4500, function () { var t = w.tags.get(ids.primary); if (t) t.dead = true; }); }
    }
  };

  /* Headless rule comparison on simulated data */
  function runRuleLab(opts) {
    var rules = opts.rules || [0, 3000, 5000], runs = opts.runs || 20, heardRssi = opts.heardRssi || -80;
    var tags = [{ tag_id: 'w', name: 'Wallet' }, { tag_id: 'p', name: 'Tool pouch' }, { tag_id: 'ph', name: 'Phone', kind: 'phone' }];
    var list = { id: 'lab', name: 'Lab', rev: 1, tags: tags };
    return rules.map(function (rule) {
      var res = { rule: rule, table: { before: 0, after: 0, missed: 0, secs: [] }, bag: { quiet: 0, nuisance: 0 } };
      ['table', 'bag'].forEach(function (kind) {
        for (var i = 0; i < runs; i++) {
          var w = new SimWorld({ seed: 1000 + i * 97 + (kind === 'bag' ? 7 : 0), cfg: { confirmMs: rule, heardRssi: heardRssi } });
          tags.forEach(function (t) { w.addTag(t); });
          w.saveList(list);
          w.wearer.speed = 0.9 + w.rand() * 0.7;
          if (kind === 'table') SCENARIOS.leave.run(w, { primary: 'w' }); else SCENARIOS.carry.run(w, {});
          var guard = 0;
          while (w.trials.length === 0 && guard++ < 2400) w.step(50);
          var tr = w.trials[0];
          if (!tr) continue;
          if (kind === 'table') {
            var o = tr.leftBehind[0];
            if (!o || o.outcome === 'missed') res.table.missed++;
            else { res.table[o.outcome === 'before-door' ? 'before' : 'after']++; res.table.secs.push(o.secs); }
          } else {
            if (tr.nuisance.length) res.bag.nuisance++; else res.bag.quiet++;
          }
        }
      });
      var s = res.table.secs.slice().sort(function (a, b) { return a - b; });
      res.table.median = s.length ? s[Math.floor(s.length / 2)] : null;
      res.runs = runs;
      return res;
    });
  }

  G.Gotcha = G.Gotcha || {};
  G.Gotcha.ST = ST;
  G.Gotcha.DEFAULTS = DEFAULTS;
  G.Gotcha.ReceiverLogic = ReceiverLogic;
  G.Gotcha.SimWorld = SimWorld;
  G.Gotcha.SCENARIOS = SCENARIOS;
  G.Gotcha.ROOM = ROOM;
  G.Gotcha.runRuleLab = runRuleLab;
})(window);
