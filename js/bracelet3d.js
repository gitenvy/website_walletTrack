/* Gotcha pendant: real-time 3D view (three.js) of the pink teddy-bear pendant on its breakaway cord.
   Replaces the flat SVG device on the pitch stage. It only reads what stage.js already sets on #bracelet:
   - the CSS variable --state (from data-tone) -> colour of the LED on the bear's muzzle
   - .ringing                                  -> vibration pulses (600 ms buzz, 400 ms pause) and a blinking LED
   If WebGL or three.js is unavailable, the SVG device stays as it was. */
(function () {
  'use strict';
  var host = document.getElementById('bracelet');
  var svg = host && host.querySelector('.band-svg');
  if (!host || !svg || !window.THREE) return;
  var T = window.THREE;
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;   // hex colours are sRGB

  var SIZE = 300;
  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(SIZE, SIZE);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  var canvas = renderer.domElement;
  canvas.className = 'band-3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Gotcha pendant: a pink teddy bear on a cord, 3D view');
  svg.style.display = 'none';
  svg.parentNode.insertBefore(canvas, svg);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.55, 6.1);
  camera.lookAt(0, 0.35, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0xe9dfe2, 0.9));
  var key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(2.5, 3.5, 4); scene.add(key);
  var rim = new T.DirectionalLight(0xffe3ea, 0.6); rim.position.set(-3, 2, -3); scene.add(rim);
  var fill = new T.DirectionalLight(0xffffff, 0.3); fill.position.set(-2.5, -1, 3); scene.add(fill);

  /* the pendant hangs from the bail: pivot there so the sway looks like a necklace */
  var pivot = new T.Group(); pivot.position.y = 1.15; scene.add(pivot);
  var shaker = new T.Group(); pivot.add(shaker);
  var bear = new T.Group(); bear.position.y = -1.15; shaker.add(bear);

  function soft(color, rough) { return new T.MeshPhysicalMaterial({ color: color, roughness: rough == null ? 0.55 : rough, clearcoat: 0.25, clearcoatRoughness: 0.5 }); }
  var pink = soft(0xF4A6B7), blush = soft(0xFBD3DC, 0.6), ink = soft(0x2A1F24, 0.3);
  function blob(r, sx, sy, sz, mat, x, y, z) {
    var m = new T.Mesh(new T.SphereGeometry(r, 48, 32), mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); bear.add(m); return m;
  }

  // head: a flattened sphere, like a pebble-shaped pendant
  blob(1.0, 1.0, 0.92, 0.5, pink, 0, 0, 0);
  // ears with lighter inner ears
  [-1, 1].forEach(function (s) {
    blob(0.36, 1, 1, 0.55, pink, s * 0.7, 0.68, -0.04);
    blob(0.2, 1, 1, 0.3, blush, s * 0.7, 0.68, 0.12);
  });
  // muzzle, nose and eyes
  blob(0.42, 1.18, 0.86, 0.42, blush, 0, -0.3, 0.36);
  blob(0.09, 1.3, 0.9, 0.6, ink, 0, -0.12, 0.54);
  [-1, 1].forEach(function (s) { blob(0.085, 1, 1, 0.6, ink, s * 0.34, 0.14, 0.44); });
  // cheeks
  [-1, 1].forEach(function (s) { var c = blob(0.13, 1, 0.7, 0.2, new T.MeshBasicMaterial({ color: 0xF07C95, transparent: true, opacity: 0.35 }), s * 0.58, -0.16, 0.42); c.renderOrder = 1; });

  // status LED on the muzzle, with a soft glow
  var ledMat = new T.MeshStandardMaterial({ color: 0x0e7c7b, emissive: 0x0e7c7b, emissiveIntensity: 1.6, roughness: 0.3 });
  var led = new T.Mesh(new T.SphereGeometry(0.06, 24, 16), ledMat);
  led.position.set(0, -0.36, 0.55); bear.add(led);
  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  })();
  var glowMat = new T.SpriteMaterial({ map: glowTex, color: 0x0e7c7b, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7 });
  var glow = new T.Sprite(glowMat); glow.scale.set(0.55, 0.55, 1); glow.position.set(0, -0.36, 0.6); bear.add(glow);

  // bail (small ring on top) and the breakaway cord
  var metal = new T.MeshStandardMaterial({ color: 0xd9cfd2, roughness: 0.3, metalness: 0.8 });
  var bail = new T.Mesh(new T.TorusGeometry(0.13, 0.04, 16, 40), metal);
  bail.position.set(0, 1.02, 0); bail.rotation.y = Math.PI / 2; bear.add(bail);
  var cordMat = new T.MeshStandardMaterial({ color: 0x3a2e33, roughness: 0.8 });
  [-1, 1].forEach(function (s) {
    var curve = new T.CatmullRomCurve3([new T.Vector3(0, 1.12, 0), new T.Vector3(s * 0.35, 1.7, -0.05), new T.Vector3(s * 0.95, 2.9, -0.15)]);
    bear.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.028, 10, false), cordMat));
  });
  // breakaway clasp on the left cord
  var clasp = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.2, 20), metal);
  clasp.position.set(-0.55, 2.2, -0.09); clasp.rotation.z = 0.55; bear.add(clasp);

  // soft shadow beneath
  var shadowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(60,20,30,.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();
  var shadow = new T.Mesh(new T.PlaneGeometry(2.6, 1.0), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.25; scene.add(shadow);

  var colour = new T.Color(0x0e7c7b), target = new T.Color(0x0e7c7b);
  function readState() {
    var css = getComputedStyle(host).getPropertyValue('--state').trim();
    if (css) { try { target.setStyle(css); } catch (e) { /* keep last colour */ } }
    return host.classList.contains('ringing');
  }

  /* press the bear to stop the vibration, like the real button */
  canvas.addEventListener('click', function () { var s = document.getElementById('silence'); if (s && !s.disabled) s.click(); });
  canvas.style.cursor = 'pointer';

  var t0 = performance.now(), visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) requestAnimationFrame(frame); });

  function frame(now) {
    if (!visible) return;
    var t = (now - t0) / 1000;
    var ringing = readState();
    colour.lerp(target, 0.15);

    // gentle necklace swing plus a slow turn to show the depth
    pivot.rotation.z = Math.sin(t * 1.3) * 0.06;
    pivot.rotation.y = Math.sin(t * 0.5) * 0.45;

    // vibration: 600 ms buzz, 400 ms pause
    var buzzing = ringing && (t % 1) < 0.6;
    if (buzzing) {
      shaker.position.x = (Math.random() - 0.5) * 0.07;
      shaker.position.y = (Math.random() - 0.5) * 0.04;
      shaker.rotation.z = (Math.random() - 0.5) * 0.06;
    } else { shaker.position.set(0, 0, 0); shaker.rotation.z = 0; }

    var on = !ringing || (Math.floor(t / 0.15) % 2 === 0);
    ledMat.color.copy(colour); ledMat.emissive.copy(colour);
    ledMat.emissiveIntensity = on ? (ringing ? 2.4 : 1.4) : 0.15;
    glowMat.color.copy(colour);
    glowMat.opacity = on ? (ringing ? 1 : 0.55 + Math.sin(t * 2) * 0.12) : 0.05;
    glow.scale.setScalar(ringing && on ? 0.85 : 0.55);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
