/* Gotcha bracelet: real-time 3D view (three.js).
   Replaces the flat SVG bracelet on the pitch stage. It only reads what stage.js already sets on #bracelet:
   - data-tone + the CSS variable --state -> colour of the LED
   - .ringing                          -> vibration pulses (600 ms buzz, 400 ms pause) and a blinking LED
   If WebGL or three.js is unavailable, the SVG bracelet stays as it was. */
(function () {
  'use strict';
  var host = document.getElementById('bracelet');
  var svg = host && host.querySelector('.band-svg');
  if (!host || !svg || !window.THREE) return;
  var T = window.THREE;
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;   // treat hex colours as sRGB, so the dark band stays dark

  var SIZE = 300;
  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(SIZE, SIZE);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  var canvas = renderer.domElement;
  canvas.className = 'band-3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Gotcha bracelet, 3D view');
  svg.style.display = 'none';
  svg.parentNode.insertBefore(canvas, svg);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.45, 4.7);
  camera.lookAt(0, -0.05, 0);

  /* lights: soft studio setup */
  scene.add(new T.HemisphereLight(0xffffff, 0xd9ddd8, 0.85));
  var key = new T.DirectionalLight(0xffffff, 1.35); key.position.set(2.5, 4, 3.5); scene.add(key);
  var rim = new T.DirectionalLight(0xbfe9e6, 0.7); rim.position.set(-3, 2, -3); scene.add(rim);
  var fill = new T.DirectionalLight(0xffffff, 0.35); fill.position.set(-2, -1, 3); scene.add(fill);

  var rig = new T.Group(); scene.add(rig);           // idle sway
  var shaker = new T.Group(); rig.add(shaker);       // vibration jitter
  var band = new T.Group(); shaker.add(band);
  band.rotation.x = -1.05;                           // tilt so we see the ring in perspective

  /* slim silicone band: annulus extruded to a strap, with rounded edges */
  var R = 1.0, THICK = 0.085, WIDTH = 0.26;
  var ring = new T.Shape(); ring.absarc(0, 0, R, 0, Math.PI * 2, false);
  var hole = new T.Path(); hole.absarc(0, 0, R - THICK, 0, Math.PI * 2, true); ring.holes.push(hole);
  var strapGeo = new T.ExtrudeGeometry(ring, { depth: WIDTH, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 6, curveSegments: 160 });
  strapGeo.translate(0, 0, -WIDTH / 2);
  var strapMat = new T.MeshStandardMaterial({ color: 0x2f3439, roughness: 0.62, metalness: 0.05 });
  band.add(new T.Mesh(strapGeo, strapMat));

  /* tiny module ("pod") on the front of the band */
  function roundedRect(w, h, r) {
    var s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  var pod = new T.Group();
  var podGeo = new T.ExtrudeGeometry(roundedRect(0.56, 0.34, 0.13), { depth: 0.09, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 8, curveSegments: 24 });
  var podMat = new T.MeshStandardMaterial({ color: 0x23272b, roughness: 0.35, metalness: 0.25 });
  pod.add(new T.Mesh(podGeo, podMat));
  // glossy top face
  var face = new T.Mesh(new T.ExtrudeGeometry(roundedRect(0.48, 0.26, 0.1), { depth: 0.005, bevelEnabled: false, curveSegments: 24 }),
    new T.MeshStandardMaterial({ color: 0x15191c, roughness: 0.18, metalness: 0.4 }));
  face.position.z = 0.131; pod.add(face);
  // LED and its glow
  var ledMat = new T.MeshStandardMaterial({ color: 0x0e7c7b, emissive: 0x0e7c7b, emissiveIntensity: 1.6, roughness: 0.3 });
  var led = new T.Mesh(new T.SphereGeometry(0.035, 24, 16), ledMat);
  led.position.set(-0.12, 0, 0.14); pod.add(led);
  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  })();
  var glowMat = new T.SpriteMaterial({ map: glowTex, color: 0x0e7c7b, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.75 });
  var glow = new T.Sprite(glowMat); glow.scale.set(0.32, 0.32, 1); glow.position.copy(led.position); glow.position.z += 0.02; pod.add(glow);
  // speaker-less vibration grille (5 dots) and side button
  var dotMat = new T.MeshStandardMaterial({ color: 0x0b0d0f, roughness: 0.8 });
  [[0.06, 0.05], [0.12, 0.05], [0.06, -0.05], [0.12, -0.05], [0.09, 0]].forEach(function (p) {
    var d = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.01, 16), dotMat);
    d.rotation.x = Math.PI / 2; d.position.set(p[0], p[1], 0.137); pod.add(d);
  });
  var btn = new T.Mesh(new T.BoxGeometry(0.035, 0.12, 0.06), new T.MeshStandardMaterial({ color: 0x4a5057, roughness: 0.4, metalness: 0.3 }));
  btn.position.set(0.31, 0, 0.06); pod.add(btn);
  // place the pod on the outer surface at the front of the band, facing outwards
  pod.position.set(0, -R - 0.005, 0);
  pod.rotation.x = Math.PI / 2;
  pod.scale.setScalar(1.25);
  band.add(pod);

  /* soft contact shadow under the bracelet */
  var shadowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,.30)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();
  var shadow = new T.Mesh(new T.PlaneGeometry(3.2, 1.6), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.95; scene.add(shadow);

  /* state from the stage */
  var colour = new T.Color(0x0e7c7b), target = new T.Color(0x0e7c7b);
  function readState() {
    var css = getComputedStyle(host).getPropertyValue('--state').trim();
    if (css) { try { target.setStyle(css); } catch (e) { /* keep last colour */ } }
    return host.classList.contains('ringing');
  }

  /* press the module to stop the vibration, like the real button */
  canvas.addEventListener('click', function () { var s = document.getElementById('silence'); if (s && !s.disabled) s.click(); });
  canvas.style.cursor = 'pointer';

  var t0 = performance.now(), visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) requestAnimationFrame(frame); });

  function frame(now) {
    if (!visible) return;
    var t = (now - t0) / 1000;
    var ringing = readState();
    colour.lerp(target, 0.15);

    // idle: slow turn so the depth is obvious
    rig.rotation.y = Math.sin(t * 0.55) * 0.42;
    rig.position.y = Math.sin(t * 1.1) * 0.03;

    // vibration: 600 ms buzz, 400 ms pause, matching the motor pattern
    var phase = (t % 1), buzzing = ringing && phase < 0.6;
    if (buzzing) {
      shaker.position.x = (Math.random() - 0.5) * 0.06;
      shaker.position.y = (Math.random() - 0.5) * 0.04;
      shaker.rotation.z = (Math.random() - 0.5) * 0.05;
    } else { shaker.position.set(0, 0, 0); shaker.rotation.z = 0; }

    var on = !ringing || (Math.floor(t / 0.15) % 2 === 0);
    ledMat.color.copy(colour); ledMat.emissive.copy(colour);
    ledMat.emissiveIntensity = on ? (ringing ? 2.4 : 1.4) : 0.15;
    glowMat.color.copy(colour);
    glowMat.opacity = on ? (ringing ? 1 : 0.6 + Math.sin(t * 2) * 0.12) : 0.05;
    glow.scale.setScalar(ringing && on ? 0.5 : 0.32);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
