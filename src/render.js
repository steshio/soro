/* ==========================================================================
   RENDERER AND ANIMATION
   Three.js scene: board, seeds, hands. Animates from the engine's event log
   and never derives rules itself.

   IG.models is the single swap point for art: it owns every mesh that is
   created. To replace the code-made board, seeds or hands with Blender glTF
   models (uploaded through the `assets` capability), reimplement
   IG.models.createBoard / createSeeds / createHand and keep their return
   shapes. Nothing outside IG.models builds geometry.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG = window.IG || {};
  var E = window.IgisoroEngine;

  /* ---- shared dimensions (world units, one column pitch = 1) ------------- */
  var DIM = IG.DIM = {
    colPitch: 1, rowPitch: 1.08, innerZ: 0.585,
    pitR: 0.435, rim: 0.22, corner: 0.13,
    slabT: 0.44, bevel: 0.028, bowlDepth: 0.3, seam: 0.012,
    seedR: 0.088,
    viewW: 8.7, viewH: 7.02
  };
  DIM.halfW = 3.5 * DIM.colPitch + DIM.pitR + DIM.rim;
  DIM.halfD = DIM.innerZ + DIM.rowPitch + DIM.pitR + DIM.rim;

  /** World position of a pit centre. p = seat, i = loop index. */
  function pitPos(p, i) {
    var col = E.colOf(p, i), row = E.rowOf(p, i);
    var z = row === 0 ? -(DIM.innerZ + DIM.rowPitch) : row === 1 ? -DIM.innerZ : row === 2 ? DIM.innerZ : DIM.innerZ + DIM.rowPitch;
    return { x: (col - 3.5) * DIM.colPitch, z: z };
  }
  IG.pitPos = pitPos;

  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  IG.prng = prng;

  var BOWL_R = DIM.pitR;
  function bowlY(r) {
    var t = Math.min(1, r / BOWL_R);
    return -DIM.bevel - DIM.bowlDepth * Math.pow(1 - Math.pow(t, 2.4), 0.55);
  }
  /* lowest centre height of a seed resting on the bowl at horizontal radius rho */
  function restOnBowl(rho) {
    var s = DIM.seedR, h = -Infinity;
    for (var k = -4; k <= 4; k++) {
      var dr = k / 4 * s * 0.98, r = Math.abs(rho + dr);
      var y = (r > BOWL_R ? 0 : bowlY(r)) + Math.sqrt(s * s - dr * dr);
      if (y > h) h = y;
    }
    return h;
  }

  /* Seed resting places inside one pit: a greedy heap. Slot k does not depend
     on how many seeds follow, so seeds never jump when another one lands. */
  function makeSlots(seed) {
    var rnd = prng(seed), slots = [], s = DIM.seedR, D = 2 * s * 1.012;
    function place() {
      var best = null, bestScore = Infinity;
      function consider(x, z) {
        var rho = Math.sqrt(x * x + z * z);
        if (rho > BOWL_R - s * 0.8) return;
        var h = restOnBowl(rho);
        for (var q = 0; q < slots.length; q++) {
          var dx = slots[q].x - x, dz = slots[q].z - z, d2 = dx * dx + dz * dz;
          if (d2 < 4 * s * s) { var hh = slots[q].y + Math.sqrt(4 * s * s - d2); if (hh > h) h = hh; }
        }
        var score = h + 0.55 * rho + rnd() * 0.002;
        if (score < bestScore) { bestScore = score; best = { x: x, y: h, z: z }; }
      }
      var i, j, a, r;
      if (!slots.length) {
        a = rnd() * 6.283; r = s * 0.75;
        consider(Math.cos(a) * r, Math.sin(a) * r);
      } else {
        var from = Math.max(0, slots.length - 16);
        for (i = from; i < slots.length; i++) for (j = 0; j < 12; j++) {
          a = j / 12 * 6.283 + rnd();
          consider(slots[i].x + Math.cos(a) * D, slots[i].z + Math.sin(a) * D);
        }
        // places that touch two seeds at once make tight triangles
        for (i = from; i < slots.length; i++) for (j = i + 1; j < slots.length; j++) {
          var ex = slots[j].x - slots[i].x, ez = slots[j].z - slots[i].z, dd = Math.sqrt(ex * ex + ez * ez);
          if (dd < 0.001 || dd > 2 * D) continue;
          var hgt = Math.sqrt(Math.max(0, D * D - dd * dd / 4)), mx = (slots[i].x + slots[j].x) / 2, mz = (slots[i].z + slots[j].z) / 2;
          consider(mx - ez / dd * hgt, mz + ex / dd * hgt);
          consider(mx + ez / dd * hgt, mz - ex / dd * hgt);
        }
        for (i = 0; i < 30; i++) {
          a = rnd() * 6.283; r = Math.sqrt(rnd()) * (BOWL_R - s);
          consider(Math.cos(a) * r, Math.sin(a) * r);
        }
      }
      return best || { x: 0, y: restOnBowl(0) + slots.length * 0.03, z: 0 };
    }
    return function (k) { while (slots.length <= k) slots.push(place()); return slots[k]; };
  }

  /* ========================================================================
     MODELS  (swap point for glTF art)
     ======================================================================== */
  var WOODS = {
    walnut: { base: [80, 52, 43], name: 'Walnut' },
    umber:  { base: [56, 37, 31], name: 'Dark umber' },
    honey:  { base: [136, 92, 56], name: 'Honey' }
  };
  var SEEDS = {
    black: { color: 0x131110, rough: 0.36, env: 0.5, name: 'Black' },
    stone: { color: 0x77706a, rough: 0.62, env: 0.6, name: 'River stone' },
    ivory: { color: 0xe6dcc9, rough: 0.45, env: 0.7, name: 'Ivory' }
  };
  var TONES = IG.TONES = ['#edc6a2', '#d29b6c', '#a8734a', '#80512f', '#57351f'];

  IG.models = (function () {
    var THREE;

    function woodTexture(seed, base, carve, side) {
      var W = 1024, H = 320, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var g = c.getContext('2d'), rnd = prng(seed), i, x, y;
      g.fillStyle = 'rgb(' + base.join(',') + ')';
      g.fillRect(0, 0, W, H);
      // broad soft bands of lighter and darker wood, running along the length
      for (i = 0; i < 46; i++) {
        y = rnd() * H; var h = 6 + rnd() * 34;
        g.fillStyle = rnd() < 0.55 ? 'rgba(20,9,5,' + (0.02 + rnd() * 0.05) + ')' : 'rgba(255,205,165,' + (0.008 + rnd() * 0.022) + ')';
        g.fillRect(0, y, W, h);
      }
      // straight grain: long, barely wavy lines
      for (i = 0; i < 620; i++) {
        var y0 = rnd() * H, amp = 0.6 + rnd() * 2.6, ph = rnd() * 6.28, fq = 0.003 + rnd() * 0.005;
        g.strokeStyle = rnd() < 0.75 ? 'rgba(16,7,4,' + (0.03 + rnd() * 0.09) + ')' : 'rgba(255,214,180,' + (0.01 + rnd() * 0.03) + ')';
        g.lineWidth = 0.3 + rnd() * 0.9;
        g.beginPath();
        for (x = 0; x <= W; x += 16) {
          y = y0 + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 2.9 + ph * 1.7) * amp * 0.35;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      // pores
      for (i = 0; i < 2600; i++) {
        g.fillStyle = 'rgba(12,5,3,' + (0.04 + rnd() * 0.08) + ')';
        g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 9, 0.7);
      }
      // optional Imigongo rim carving: a zigzag band along the outer long edge
      if (carve) {
        var edge = side > 0 ? H - 6 : 6, dir = side > 0 ? -1 : 1, step = 15, hgt = 15;
        g.fillStyle = 'rgba(8,3,2,0.5)';
        for (x = 26; x < W - 26; x += step) {
          g.beginPath(); g.moveTo(x, edge); g.lineTo(x + step / 2, edge + dir * hgt); g.lineTo(x + step, edge); g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(255,225,190,0.16)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(26, edge + dir * (hgt + 3)); g.lineTo(W - 26, edge + dir * (hgt + 3)); g.stroke();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = 8;
      return tex;
    }

    function roundedRectShape(x0, y0, x1, y1, r) {
      var s = new THREE.Shape();
      s.moveTo(x0 + r, y0);
      s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
      s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
      s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
      return s;
    }

    /* planar UVs from world x/z so the grain runs unbroken across plate and bowls */
    function planarUV(geo, side) {
      var pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
      for (var i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) + DIM.halfW) / (2 * DIM.halfW);
        var z = Math.abs(pos.getZ(i));
        uv[i * 2 + 1] = side > 0 ? 1 - z / DIM.halfD : z / DIM.halfD;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    function whiteColors(geo) {
      var n = geo.attributes.position.count, c = new Float32Array(n * 3);
      for (var i = 0; i < c.length; i++) c[i] = 1;
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }

    /* one carved bowl: custom lathe with inward normals and baked occlusion */
    function bowlGeometry(cx, cz) {
      var N = 20, M = 56, pos = [], nor = [], col = [], idx = [], k, j;
      for (k = 0; k <= N; k++) {
        var t = 1 - Math.pow(1 - k / N, 1.8), r = BOWL_R * t, y = bowlY(r);
        var e = 0.002, dy = (bowlY(Math.min(BOWL_R, r + e)) - bowlY(Math.max(0, r - e))), dr = Math.min(BOWL_R, r + e) - Math.max(0, r - e);
        var len = Math.sqrt(dy * dy + dr * dr) || 1, nr = -dy / len, ny = dr / len;
        if (k === N) { nr = -0.92; ny = 0.39; }
        var ao = 0.68 - 0.18 * Math.exp(-Math.pow((t - 0.82) / 0.18, 2)) + 0.22 * Math.pow(t, 10);
        for (j = 0; j <= M; j++) {
          var a = j / M * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          pos.push(cx + r * ca, y, cz + r * sa);
          nor.push(nr * ca, ny, nr * sa);
          col.push(ao, ao, ao);
        }
      }
      for (k = 0; k < N; k++) for (j = 0; j < M; j++) {
        var a0 = k * (M + 1) + j, b0 = a0 + 1, c0 = a0 + (M + 1), d0 = c0 + 1;
        idx.push(a0, b0, c0, b0, d0, c0);
      }
      return { pos: pos, nor: nor, col: col, idx: idx };
    }

    function createBoard(opts) {
      THREE = window.THREE;
      opts = opts || {};
      var wood = WOODS[opts.wood] || WOODS.walnut;
      var group = new THREE.Group();
      var mats = [];
      [-1, 1].forEach(function (side, n) {
        // neighbouring planks: a faint shift in tone between the two halves
        var base = wood.base.map(function (v, k) { return Math.round(v * (n ? 1.0 : 0.94) + (n ? 0 : k === 0 ? 2 : 0)); });
        var tex = woodTexture(n ? 9127 : 4311, base, !!opts.carve, side);
        var mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, envMapIntensity: 0.22, vertexColors: true });
        mats.push(mat);
        // top plate with round holes (shape space: x, y = -z)
        var zA = DIM.seam, zB = DIM.halfD;
        var y0 = side > 0 ? -zB : zA, y1 = side > 0 ? -zA : zB;
        var shape = roundedRectShape(-DIM.halfW, y0, DIM.halfW, y1, DIM.corner);
        var p = side > 0 ? 0 : 1, i, pp;
        for (i = 0; i < 16; i++) {
          pp = pitPos(p, i);
          var hole = new THREE.Path();
          hole.absarc(pp.x, -pp.z, DIM.pitR, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
        var b = DIM.bevel;
        var geo = new THREE.ExtrudeGeometry(shape, { depth: DIM.slabT - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 40 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, -(DIM.slabT - b), 0);
        planarUV(geo, side); whiteColors(geo);
        var slab = new THREE.Mesh(geo, mat);
        slab.castShadow = true; slab.receiveShadow = true;
        group.add(slab);
        // bowls, merged into one mesh per half
        var P = [], Nn = [], C = [], I = [], off = 0;
        for (i = 0; i < 16; i++) {
          pp = pitPos(p, i);
          var bg = bowlGeometry(pp.x, pp.z);
          Array.prototype.push.apply(P, bg.pos); Array.prototype.push.apply(Nn, bg.nor); Array.prototype.push.apply(C, bg.col);
          for (var q = 0; q < bg.idx.length; q++) I.push(bg.idx[q] + off);
          off += bg.pos.length / 3;
        }
        var bgeo = new THREE.BufferGeometry();
        bgeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        bgeo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
        bgeo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        bgeo.setIndex(I);
        planarUV(bgeo, side);
        var bowls = new THREE.Mesh(bgeo, mat);
        bowls.receiveShadow = true;
        group.add(bowls);
      });
      // the seam between the two halves
      var seam = new THREE.Mesh(new THREE.BoxGeometry(2 * DIM.halfW - 0.1, 0.05, DIM.seam * 2 + 0.02), new THREE.MeshBasicMaterial({ color: 0x0c0705 }));
      seam.position.y = -0.09;
      group.add(seam);
      // two flat brass hinges on the seam
      var brass = new THREE.MeshStandardMaterial({ color: 0x7a6242, metalness: 0.8, roughness: 0.5, envMapIntensity: 0.55 });
      [-1, 1].forEach(function (s) {
        var h = new THREE.Group();
        var leaf = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.012, 0.085), brass);
        leaf.position.y = 0.004;
        var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.92, 12), brass);
        pin.rotation.z = Math.PI / 2; pin.position.y = 0.012;
        h.add(leaf); h.add(pin);
        h.position.set(s * 3.42, 0, 0);
        h.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        group.add(h);
      });
      group.userData.materials = mats;
      return group;
    }

    function createSeeds(count, kind) {
      THREE = window.THREE;
      var k = SEEDS[kind] || SEEDS.black;
      var mat = new THREE.MeshStandardMaterial({ color: k.color, roughness: k.rough, metalness: 0, envMapIntensity: k.env });
      var mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(DIM.seedR, 24, 16), mat, count);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      return mesh;
    }

    /* A stylised right hand seen from above. Group origin = fingertips; the
       fingers point towards -z. setCup(0..1) opens and closes it. */
    function createHand(tone, opts) {
      THREE = window.THREE;
      opts = opts || {};
      var g = new THREE.Group(), body = new THREE.Group();
      g.add(body);
      var skin = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.6, metalness: 0, envMapIntensity: 0.3 });
      var nail = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.35, metalness: 0, envMapIntensity: 0.5 });
      function mesh(geo, mat) { var m = new THREE.Mesh(geo, mat || skin); m.castShadow = true; return m; }
      function seg(r, len) {
        var c = new THREE.CapsuleGeometry(r, len, 5, 12);
        c.rotateX(Math.PI / 2); c.translate(0, 0, -len / 2);
        return c;
      }
      var KZ = 0.66;                                   // knuckle line
      var palm = mesh(new THREE.SphereGeometry(1, 28, 18));
      palm.scale.set(0.41, 0.15, 0.47); palm.position.set(0.01, 0, KZ + 0.36);
      body.add(palm);
      var heel = mesh(new THREE.SphereGeometry(1, 20, 14));
      heel.scale.set(0.33, 0.14, 0.3); heel.position.set(0.02, -0.01, KZ + 0.72);
      body.add(heel);
      var arm = mesh(new THREE.CylinderGeometry(0.31, 0.25, 9, 20, 1));
      arm.rotation.x = Math.PI / 2; arm.scale.set(1, 1, 0.56); arm.position.set(0.02, -0.02, KZ + 0.9 + 4.5);
      body.add(arm);
      var fingers = [];
      var spec = [   // x, knuckle z offset, radius, proximal, distal, splay
        [-0.285, 0.03, 0.079, 0.3, 0.25, 0.1],
        [-0.095, 0.0, 0.084, 0.33, 0.28, 0.03],
        [0.095, 0.02, 0.08, 0.31, 0.26, -0.04],
        [0.275, 0.09, 0.07, 0.25, 0.21, -0.12]
      ];
      spec.forEach(function (s) {
        var k = new THREE.Group(); k.position.set(s[0], 0.01, KZ + s[1]); k.rotation.order = 'YXZ';
        var prox = mesh(seg(s[2], s[3])); k.add(prox);
        var mid = new THREE.Group(); mid.position.z = -s[3]; k.add(mid);
        var dist = mesh(seg(s[2] * 0.94, s[4])); mid.add(dist);
        var n = mesh(new THREE.SphereGeometry(1, 12, 8), nail);
        n.scale.set(s[2] * 0.7, 0.02, s[2] * 0.95); n.position.set(0, s[2] * 0.9, -s[4] + 0.01); mid.add(n);
        body.add(k);
        fingers.push({ k: k, mid: mid, splay: s[5] });
      });
      // thumb, on the left of a right hand held palm down
      var tk = new THREE.Group(); tk.position.set(-0.36, -0.02, KZ + 0.5); tk.rotation.order = 'YXZ';
      tk.add(mesh(seg(0.092, 0.27)));
      var tm = new THREE.Group(); tm.position.z = -0.27; tk.add(tm);
      tm.add(mesh(seg(0.085, 0.2)));
      var tn = mesh(new THREE.SphereGeometry(1, 12, 8), nail);
      tn.scale.set(0.062, 0.02, 0.085); tn.position.set(0, 0.08, -0.19); tm.add(tn);
      body.add(tk);
      // bracelet (cosmetic)
      var band = mesh(new THREE.TorusGeometry(0.29, 0.034, 10, 32), new THREE.MeshStandardMaterial({ color: 0xa8854f, metalness: 0.8, roughness: 0.38 }));
      band.scale.set(1, 0.58, 1); band.position.set(0.02, -0.02, KZ + 1.42);
      band.visible = false;
      body.add(band);

      var api = {
        group: g, cup: -1,
        setCup: function (c) {
          if (c === api.cup) return; api.cup = c;
          for (var i = 0; i < fingers.length; i++) {
            fingers[i].k.rotation.x = -(0.1 + 0.6 * c);
            fingers[i].mid.rotation.x = -(0.14 + 0.95 * c);
            fingers[i].k.rotation.y = fingers[i].splay * (1 - 0.7 * c);
          }
          tk.rotation.y = 0.95 - 0.5 * c; tk.rotation.x = -0.25 * c; tm.rotation.y = -0.25 - 0.3 * c;
        },
        setTone: function (hex) {
          skin.color.set(hex);
          nail.color.set(hex).lerp(new THREE.Color(0xfff1e4), 0.42);
        },
        setOpacity: function (a) {
          [skin, nail, band.material].forEach(function (m) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; });
          g.traverse(function (m) { if (m.isMesh) m.castShadow = a >= 1; });
        },
        setBracelet: function (kind) {
          band.visible = !!kind;
          if (kind === 'beads') { band.material.color.set(0x9c2f22); band.material.metalness = 0.1; band.material.roughness = 0.5; }
          else if (kind === 'brass') { band.material.color.set(0xb08a4c); band.material.metalness = 0.85; band.material.roughness = 0.35; }
        }
      };
      api.setTone(tone); api.setCup(0.35);
      body.scale.setScalar(opts.scale || 1.02);
      return api;
    }

    return { createBoard: createBoard, createSeeds: createSeeds, createHand: createHand, WOODS: WOODS, SEEDS: SEEDS };
  })();

  /* ========================================================================
     VIEW
     ======================================================================== */
  IG.view = (function () {
    var THREE, renderer, scene, camera, rig, board, seedMesh, ground, contact, sun;
    var wrap, canvas, ok = false, flat = false;
    var flip = false, tilt = false, dark = false;
    var look = { wood: 'walnut', seed: 'black', carve: false };
    var hands = [null, null];
    var seeds = [];                       // {x,y,z,s, token}
    var pitSeeds = [[], []];              // seed ids per pit, in slot order
    var freeIds = [];
    var slotFns = [[], []];
    var m4, v3, q4, s3;
    var tweens = [], running = false, dirty = true, last = 0;
    var speed = 1, accel = 1, skipping = false, reduced = false;
    var seedDirty = false;
    var onFrameHooks = [];
    var REST_Z = 4.9, HOVER_Y = 0.5;

    function init(wrapEl, canvasEl) {
      wrap = wrapEl; canvas = canvasEl;
      THREE = window.THREE;
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) { pitSeeds[p][i] = []; slotFns[p][i] = makeSlots(p * 100 + i * 7 + 13); }
      if (!seeds.length) for (var k = 0; k < 64; k++) seeds.push({ x: 0, y: -5, z: 0, s: 0, token: 0 });
      // stand-in hands for the flat (no WebGL) fallback; replaced below when the scene builds
      hands = [0, 1].map(function (seat) {
        return { seat: seat, sign: seat ? -1 : 1, held: [], token: 0, cup: 0, setCup: function () {}, setTone: function () {}, setOpacity: function () {}, setBracelet: function () {},
          group: { position: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } } } };
      });
      if (!THREE) { flat = true; return false; }
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch (e) { flat = true; return false; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      m4 = new THREE.Matrix4(); v3 = new THREE.Vector3(); q4 = new THREE.Quaternion(); s3 = new THREE.Vector3();

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-DIM.viewW / 2, DIM.viewW / 2, DIM.viewH / 2, -DIM.viewH / 2, 0.1, 80);

      // soft daylight from the upper left; the rig turns with the view so the light always reads the same on screen
      rig = new THREE.Group(); scene.add(rig);
      sun = new THREE.DirectionalLight(0xfff1e0, 2.95);
      sun.position.set(-4.7, 9, -6.7);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 6.5; sun.shadow.camera.bottom = -6.5;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 6.5;
      rig.add(sun); rig.add(sun.target);
      var fill = new THREE.DirectionalLight(0xdfe6f2, 0.3);
      fill.position.set(6, 7, 5); rig.add(fill);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5f57, 0.34));
      scene.environment = makeEnvironment();

      ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.2 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -DIM.slabT; ground.receiveShadow = true;
      scene.add(ground);
      contact = makeContactShadow(); rig.add(contact);

      buildBoard(); buildSeeds();
      hands[0] = IG.models.createHand(TONES[2]); hands[1] = IG.models.createHand(TONES[3]);
      for (var h = 0; h < 2; h++) {
        var H = hands[h];
        H.seat = h; H.sign = h === 0 ? 1 : -1; H.held = []; H.busy = false; H.token = 0; H.ghost = false;
        H.group.rotation.y = h === 0 ? 0 : Math.PI;
        H.group.position.set(h === 0 ? 1.2 : -1.2, HOVER_Y, H.sign * REST_Z);
        scene.add(H.group);
      }
      placeCamera();
      if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
      window.addEventListener('resize', resize);
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
      canvas.addEventListener('webglcontextrestored', function () { invalidate(); });
      resize();
      ok = true;
      return true;
    }

    function makeEnvironment() {
      var c = document.createElement('canvas'); c.width = 16; c.height = 128;
      var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.42, '#d9d5cf'); gr.addColorStop(0.55, '#8d867f'); gr.addColorStop(1, '#2e2a27');
      g.fillStyle = gr; g.fillRect(0, 0, 16, 128);
      var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      var es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
      var box = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.8, 4.5), side: THREE.DoubleSide }));
      box.position.set(-8, 11, -7); box.lookAt(0, 0, 0); es.add(box);
      var pm = new THREE.PMREMGenerator(renderer);
      var rt = pm.fromScene(es, 0.03);
      pm.dispose();
      return rt.texture;
    }

    function makeContactShadow() {
      var c = document.createElement('canvas'); c.width = 512; c.height = 320;
      var g = c.getContext('2d');
      g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 26; g.shadowOffsetX = 600;
      g.fillStyle = '#000';
      var w = 512 * (2 * DIM.halfW) / 10.4, h = 320 * (2 * DIM.halfD) / 6.5;
      g.fillRect(-600 + (512 - w) / 2, (320 - h) / 2, w, h);
      var tex = new THREE.CanvasTexture(c);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 6.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(0.14, -DIM.slabT + 0.004, 0.18);
      return m;
    }

    function buildBoard() {
      if (board) { scene.remove(board); board.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
      board = IG.models.createBoard({ wood: look.wood, carve: look.carve });
      scene.add(board);
    }
    function buildSeeds() {
      if (seedMesh) { scene.remove(seedMesh); seedMesh.geometry.dispose(); seedMesh.material.dispose(); }
      seedMesh = IG.models.createSeeds(64, look.seed);
      scene.add(seedMesh);
      seedDirty = true;
    }

    function placeCamera() {
      if (!camera) return;
      var a = tilt ? 0.42 : 0, dirZ = flip ? -1 : 1;
      camera.position.set(0, 40 * Math.cos(a), 40 * Math.sin(a) * dirZ);
      camera.up.set(0, tilt ? 1 : 0, tilt ? 0 : (flip ? 1 : -1));
      camera.lookAt(0, tilt ? -0.25 : 0, 0);
      var zoom = tilt ? 0.96 : 1;
      camera.zoom = zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      rig.rotation.y = flip ? Math.PI : 0;
      invalidate();
    }

    function resize() {
      if (!renderer) return;
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      invalidate();
    }

    /** world -> fractions of the board wrapper (0..1), for DOM overlays */
    function project(x, y, z) {
      if (!camera) {
        var fx = flip ? -x : x, fz = flip ? -z : z;
        return { u: 0.5 + fx / DIM.viewW, v: 0.5 + fz / DIM.viewH };
      }
      v3.set(x, y, z).project(camera);
      return { u: (v3.x + 1) / 2, v: (1 - v3.y) / 2 };
    }
    function projectPit(p, i) { var pp = pitPos(p, i); return project(pp.x, 0, pp.z); }
    /** approximate on-screen pit radius as a fraction of wrapper width */
    function pitRadiusU() { return DIM.pitR / DIM.viewW * (camera ? camera.zoom : 1); }

    /* ---- seeds ---------------------------------------------------------- */
    function slotWorld(p, i, k) {
      var pp = pitPos(p, i), s = slotFns[p][i](k);
      return { x: pp.x + s.x, y: s.y, z: pp.z + s.z };
    }
    function setPits(pits) {
      var id = 0, p, i, k;
      for (p = 0; p < 2; p++) for (i = 0; i < 16; i++) {
        pitSeeds[p][i] = [];
        for (k = 0; k < pits[p][i] && id < 64; k++) {
          var w = slotWorld(p, i, k), sd = seeds[id];
          sd.x = w.x; sd.y = w.y; sd.z = w.z; sd.s = 1; sd.token++;
          pitSeeds[p][i].push(id++);
        }
      }
      freeIds = [];
      for (; id < 64; id++) { seeds[id].s = 0; seeds[id].token++; freeIds.push(id); }
      for (p = 0; p < 2; p++) if (hands[p]) hands[p].held = [];
      seedDirty = true; invalidate();
    }
    function counts() {
      return [pitSeeds[0].map(function (a) { return a.length; }), pitSeeds[1].map(function (a) { return a.length; })];
    }
    function flushSeeds() {
      if (!seedMesh) return;
      for (var k = 0; k < 64; k++) {
        var sd = seeds[k];
        v3.set(sd.x, sd.y, sd.z); s3.set(sd.s, sd.s, sd.s);
        m4.compose(v3, q4, s3);
        seedMesh.setMatrixAt(k, m4);
      }
      seedMesh.instanceMatrix.needsUpdate = true;
      seedDirty = false;
    }

    /* ---- frame loop: renders only while something moves ------------------ */
    function invalidate() { dirty = true; if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
    function frame(now) {
      var dt = last ? Math.min(220, now - last) : 16; last = now;   // slow devices skip ahead instead of running in slow motion
      for (var i = tweens.length - 1; i >= 0; i--) {
        var tw = tweens[i];
        tw.t += dt * tw.rate;
        var k = tw.t >= tw.dur ? 1 : tw.t / tw.dur;
        tw.fn(tw.ease ? tw.ease(k) : k);
        if (k >= 1) { tweens.splice(i, 1); tw.done(); }
        dirty = true;
      }
      if (dirty && ok) {
        if (seedDirty) flushSeeds();
        renderer.render(scene, camera);
        for (var h = 0; h < onFrameHooks.length; h++) onFrameHooks[h]();
        dirty = false;
      }
      if (tweens.length) requestAnimationFrame(frame); else { running = false; }
    }
    function easeInOut(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
    function easeOut(k) { return 1 - (1 - k) * (1 - k); }
    function tween(ms, fn, ease) {
      return new Promise(function (resolve) {
        if (skipping || flat || ms <= 0) { fn(1); seedDirty = true; dirty = true; resolve(); if (!flat) invalidate(); return; }
        tweens.push({ t: 0, dur: ms, rate: speed * accel, fn: fn, ease: ease === undefined ? easeInOut : ease, done: resolve });
        invalidate();
      });
    }
    function wait(ms) { return tween(ms, function () {}, null); }

    /* ---- hand motion ------------------------------------------------------ */
    function anchor(H, owner, i) {
      var pp = pitPos(owner, i);
      return { x: pp.x + 0.02 * H.sign, z: pp.z + 0.2 * H.sign };
    }
    function handTo(H, x, y, z, ms, hop) {
      var g = H.group.position, x0 = g.x, y0 = g.y, z0 = g.z, tok = ++H.token;
      return tween(ms, function (k) {
        if (H.token !== tok) return;
        g.set(x0 + (x - x0) * k, y0 + (y - y0) * k + (hop || 0) * Math.sin(Math.PI * k), z0 + (z - z0) * k);
      });
    }
    function travelMs(H, x, z, base, per) {
      var g = H.group.position, d = Math.sqrt((g.x - x) * (g.x - x) + (g.z - z) * (g.z - z));
      return base + per * d;
    }
    function solid(H) { if (H.ghost) { H.ghost = false; H.setOpacity(1); } }

    async function scoop(H, owner, i, ctx) {
      var a = anchor(H, owner, i);
      await handTo(H, a.x, HOVER_Y, a.z, travelMs(H, a.x, a.z, 90, 85), 0.05);
      var ids = pitSeeds[owner][i]; pitSeeds[owner][i] = [];
      var g = H.group.position, from = ids.map(function (id) { var s = seeds[id]; s.token++; return { id: id, x: s.x, y: s.y, z: s.z, tok: s.token }; });
      var y0 = g.y, c0 = H.cup;
      if (ctx.onPit) ctx.onPit(owner, i, 0);
      if (IG.audio && !skipping) IG.audio.scoop(ids.length);
      await tween(190, function (k) {
        g.y = y0 + (0.27 - y0) * k; H.setCup(c0 + (1 - c0) * k);
        for (var n = 0; n < from.length; n++) {
          var f = from[n], s = seeds[f.id];
          if (s.token !== f.tok) continue;
          s.x = f.x + (g.x - f.x) * k; s.z = f.z + (g.z + 0.3 * H.sign - f.z) * k; s.y = f.y + (0.22 - f.y) * k; s.s = 1 - k * k;
        }
        seedDirty = true;
      });
      for (var n = 0; n < ids.length; n++) H.held.push(ids[n]);
      if (ctx.onHeld) ctx.onHeld(H.seat, H.held.length);
      await tween(110, function (k) { g.y = 0.27 + (HOVER_Y - 0.27) * k; });
    }

    async function drop(H, owner, i, ctx, n) {
      var a = anchor(H, owner, i);
      await handTo(H, a.x, 0.44, a.z, travelMs(H, a.x, a.z, 70, 75), 0.06);
      H.setCup(0.72);
      var id = H.held.length ? H.held.pop() : freeIds.pop();
      if (id === undefined) return;
      var k0 = pitSeeds[owner][i].length, w = slotWorld(owner, i, k0);
      pitSeeds[owner][i].push(id);
      var s = seeds[id], tok = ++s.token, g = H.group.position;
      var sx = g.x, sy = 0.3, sz = g.z - 0.06 * H.sign;
      s.x = sx; s.y = sy; s.z = sz; s.s = 1; seedDirty = true;
      if (ctx.onPit) ctx.onPit(owner, i, n);
      if (ctx.onHeld) ctx.onHeld(H.seat, H.held.length);
      // the seed falls on a short arc while the hand already moves on
      tween(reduced ? 60 : 150, function (k) {
        if (s.token !== tok) return;
        s.x = sx + (w.x - sx) * k; s.z = sz + (w.z - sz) * k;
        s.y = sy + (w.y - sy) * k * k + 0.05 * Math.sin(Math.PI * k);
        seedDirty = true;
      }, null).then(function () {
        if (IG.audio && !skipping) IG.audio.click(k0);
        if (s.token !== tok || reduced) return;
        tween(110, function (k) { if (s.token !== tok) return; s.y = w.y + 0.028 * Math.sin(Math.PI * k) * (1 - k); seedDirty = true; }, null);
      });
      await wait(reduced ? 20 : 55);
    }

    /**
     * Animates a slice of an engine event log for `seat`. Hand state carries
     * over between calls, so a move can pause for a decision and continue.
     * ctx: { onPit(owner,i,n), onHeld(seat,n), onEvent(ev) }
     */
    async function playEvents(seat, events, ctx) {
      ctx = ctx || {};
      var H = hands[seat];
      var opp = 1 - seat;
      if (!flat) { solid(H); H.busy = true; }
      for (var n = 0; n < events.length; n++) {
        var ev = events[n];
        if (ctx.onEvent) ctx.onEvent(ev);
        if (flat) { flatEvent(H, seat, ev, ctx); if (!skipping) await new Promise(function (r) { setTimeout(r, ev.t === 'drop' ? 70 / speed : 120 / speed); }); continue; }
        switch (ev.t) {
          case 'lift':
            H.laps = (H.laps || 0) + 1;
            accel = H.laps > 12 ? 4 : H.laps > 6 ? 2.6 : H.laps > 3 ? 1.6 : 1;
            await scoop(H, seat, ev.pit, ctx);
            break;
          case 'drop':
            await drop(H, seat, ev.pit, ctx, ev.n);
            break;
          case 'relay':
            await tween(80, function (k) { H.group.position.y = 0.44 - 0.1 * Math.sin(Math.PI * k * 0.5); });
            break;
          case 'blocked': case 'pass':
            await wait(260);
            break;
          case 'capture':
            await wait(340);
            if (IG.audio && !skipping) IG.audio.knock();
            await scoop(H, opp, ev.a, ctx);
            await scoop(H, opp, ev.b, ctx);
            break;
          case 'capsow':
            var a = anchor(H, seat, ev.from);
            await handTo(H, a.x, HOVER_Y, a.z, travelMs(H, a.x, a.z, 120, 90), 0.1);
            await wait(140);
            break;
          case 'end':
            endTurn(H);
            break;
        }
      }
    }
    function flatEvent(H, seat, ev, ctx) {
      var opp = 1 - seat, ids;
      function take(owner, i) { ids = pitSeeds[owner][i]; pitSeeds[owner][i] = []; H.held = H.held.concat(ids); if (ctx.onPit) ctx.onPit(owner, i, 0); }
      if (ev.t === 'lift') take(seat, ev.pit);
      else if (ev.t === 'drop') { pitSeeds[seat][ev.pit].push(H.held.length ? H.held.pop() : 0); if (ctx.onPit) ctx.onPit(seat, ev.pit, ev.n); }
      else if (ev.t === 'capture') { take(opp, ev.a); take(opp, ev.b); }
      if (ctx.onHeld) ctx.onHeld(seat, H.held.length);
    }
    function endTurn(H) {
      H.laps = 0; accel = 1; H.busy = false;
      H.setCup(0.35);
      handTo(H, H.group.position.x * 0.6, HOVER_Y, H.sign * REST_Z, 420, 0);
    }
    function hover(seat, owner, i) {
      var H = hands[seat]; if (!H || flat) return Promise.resolve();
      solid(H);
      var a = anchor(H, owner, i);
      return handTo(H, a.x, HOVER_Y + 0.08, a.z, travelMs(H, a.x, a.z, 160, 90), 0.08);
    }
    function rest(seat) { var H = hands[seat]; if (H && !flat) endTurn(H); }
    /** translucent hand showing where the other player is hovering */
    function ghost(seat, i) {
      var H = hands[seat]; if (!H || flat || H.busy) return;
      if (i === null || i === undefined) {
        if (H.ghost) { handTo(H, H.group.position.x * 0.6, HOVER_Y, H.sign * REST_Z, 380, 0).then(function () { if (!H.busy) solid(H); }); }
        return;
      }
      if (!H.ghost) { H.ghost = true; H.setOpacity(0.42); }
      var a = anchor(H, seat, i);
      handTo(H, a.x, HOVER_Y + 0.1, a.z, 260, 0);
    }
    function handScreen(seat) {
      var H = hands[seat]; if (!H || flat) return null;
      var g = H.group.position;
      return project(g.x, g.y, g.z + 0.62 * H.sign);
    }

    return {
      init: init, project: project, projectPit: projectPit, pitRadiusU: pitRadiusU,
      setPits: setPits, counts: counts, playEvents: playEvents, hover: hover, rest: rest, ghost: ghost, handScreen: handScreen,
      wait: wait, invalidate: invalidate,
      onFrame: function (fn) { onFrameHooks.push(fn); },
      isFlat: function () { return flat; },
      setSpeed: function (s) { speed = s; },
      skip: function (on) { skipping = on; if (on) { for (var i = 0; i < tweens.length; i++) tweens[i].t = tweens[i].dur; } },
      isSkipping: function () { return skipping; },
      setFlip: function (f) { if (flip !== !!f) { flip = !!f; placeCamera(); } },
      isFlipped: function () { return flip; },
      setTilt: function (t) { if (tilt !== !!t) { tilt = !!t; placeCamera(); } },
      setDark: function (d) {
        dark = !!d;
        if (ground) { ground.material.opacity = dark ? 0.42 : 0.2; contact.material.opacity = dark ? 0.75 : 0.5; invalidate(); }
      },
      setTone: function (seat, hex) { if (hands[seat]) { hands[seat].setTone(hex); invalidate(); } },
      setBracelet: function (seat, kind) { if (hands[seat]) { hands[seat].setBracelet(kind); invalidate(); } },
      setLook: function (l) {
        if (!ok) return;
        var rebuildBoard = l.wood !== look.wood || !!l.carve !== look.carve, rebuildSeeds = l.seed !== look.seed;
        look = { wood: l.wood || 'walnut', seed: l.seed || 'black', carve: !!l.carve };
        if (rebuildBoard) buildBoard();
        if (rebuildSeeds) buildSeeds();
        if (l.tint && board) board.userData.materials.forEach(function (m) { m.color.set(l.tint); });
        else if (board) board.userData.materials.forEach(function (m) { m.color.set(0xffffff); });
        invalidate();
      }
    };
  })();
})();
