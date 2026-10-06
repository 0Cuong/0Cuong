(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 760;

  const canvas = document.createElement("canvas");
  canvas.id = "nebula-v8";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const hud = document.createElement("div");
  hud.className = "nebula-v8__hud";
  hud.innerHTML = `
    <button class="nebula-v8__button" type="button" data-nebula-action="prev" aria-label="Đội hình trước">‹</button>
    <div class="nebula-v8__mode" aria-live="polite">NEBULA</div>
    <button class="nebula-v8__button" type="button" data-nebula-action="next" aria-label="Đội hình tiếp">›</button>
    <button class="nebula-v8__button" type="button" data-nebula-action="reset" aria-label="Đặt lại góc nhìn">⌖</button>
  `;
  document.body.appendChild(hud);

  const hint = document.createElement("div");
  hint.className = "nebula-v8__hint";
  hint.textContent = coarse ? "Kéo để bay · chụm để zoom" : "Wheel zoom · drag to explore";
  document.body.appendChild(hint);

  const state = {
    width: 1,
    height: 1,
    dpr: 1,
    count: mobile ? 5200 : 10500,
    x: new Float32Array(1),
    y: new Float32Array(1),
    vx: new Float32Array(1),
    vy: new Float32Array(1),
    z: new Float32Array(1),
    size: new Float32Array(1),
    phase: new Float32Array(1),
    seed: new Float32Array(1),
    tx: new Float32Array(1),
    ty: new Float32Array(1),
    tz: new Float32Array(1),
    sx: new Float32Array(1),
    sy: new Float32Array(1),
    zoom: 1,
    panX: 0,
    panY: 0,
    targetZoom: 1,
    targetPanX: 0,
    targetPanY: 0,
    formation: 0,
    morphFrom: 0,
    morphStarted: performance.now(),
    portraitTargets: null,
    intro: true,
    portrait: false,
    dragging: false,
    pointers: new Map(),
    pinchDistance: 0,
    last: performance.now(),
    elapsed: 0,
    cycleAt: performance.now() + (reducedMotion ? 9e9 : 7000),
  };

  const formations = [
    { name: "NEBULA", duration: 7000 },
    { name: "FLOCK", duration: 7200 },
    { name: "ORBIT", duration: 7200 },
    { name: "DRONE", duration: 8200 },
    { name: "HEART", duration: 7600 },
  ];

  const mode = () => state.portrait ? "PORTRAIT" : formations[state.formation].name;
  const updateLabel = () => {
    const el = hud.querySelector(".nebula-v8__mode");
    if (el) el.textContent = mode();
  };

  const alloc = () => {
    const n = state.count;
    for (const key of ["x","y","vx","vy","z","size","phase","seed","tx","ty","tz","sx","sy"]) {
      state[key] = new Float32Array(n);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = Math.pow(Math.random(), 1.7);
      state.x[i] = Math.cos(a) * r;
      state.y[i] = Math.sin(a) * r * .68;
      state.vx[i] = (Math.random() - .5) * .002;
      state.vy[i] = (Math.random() - .5) * .002;
      state.z[i] = Math.random();
      state.size[i] = .55 + Math.random() * 1.7;
      state.phase[i] = Math.random() * TAU;
      state.seed[i] = Math.random();
    }
  };

  alloc();

  const setSize = () => {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  };

  const worldToScreen = (x, y, z = .5) => {
    const depth = .72 + z * .56;
    return [
      state.width * .5 + (x * Math.min(state.width, state.height) * .46 * state.zoom * depth) + state.panX,
      state.height * .49 + (y * Math.min(state.width, state.height) * .46 * state.zoom * depth) + state.panY,
    ];
  };

  const pointOn = (which, u, i) => {
    const s = state.seed[i];
    const p = state.phase[i];
    if (which === 0) {
      const a = TAU * s * 5 + p * .06;
      const r = Math.sqrt(s);
      const arm = Math.floor(s * 5);
      const twist = r * 7.5 + arm * (TAU / 5);
      const rr = r * (0.25 + .75 * Math.sin(s * 35 + p) * .06 + .45);
      return [
        Math.cos(twist + a * .18) * rr,
        Math.sin(twist + a * .18) * rr * .65,
      ];
    }
    if (which === 1) {
      const lane = Math.floor(s * 8) - 3.5;
      const t = (s * 17.0) % 1;
      const sweep = Math.sin(t * TAU * 1.5 + lane * .62) * .25;
      const x = (t * 2 - 1) * .95 + sweep * .2;
      const y = lane * .11 + Math.sin(t * TAU * 2.0 + p) * .065 + sweep * .13;
      const fold = Math.sin(t * TAU * 5 + lane) * .025;
      return [x, y + fold];
    }
    if (which === 2) {
      const a = s * TAU;
      const ring = .32 + .58 * ((Math.floor(s * 4) % 4) / 4);
      const breathe = Math.sin(p + state.elapsed * .8) * .025;
      return [
        Math.cos(a + state.elapsed * .08) * (ring + breathe),
        Math.sin(a + state.elapsed * .08) * (ring + breathe) * .72,
      ];
    }
    if (which === 3) {
      const section = Math.floor(s * 8);
      const q = (s * 8) % 1;
      if (section < 4) {
        const arm = section;
        const angle = arm * (TAU / 4) + Math.PI / 4;
        const radius = .12 + q * .74;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius * .72];
      }
      const rotor = section - 4;
      const cx = (rotor === 0 || rotor === 2 ? -1 : 1) * .62;
      const cy = (rotor === 0 || rotor === 1 ? -1 : 1) * .42;
      const a = q * TAU;
      return [cx + Math.cos(a) * .17, cy + Math.sin(a) * .11];
    }
    const t = s * TAU;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const fill = .38 + .62 * Math.sqrt(s);
    return [hx * .045 * fill, -hy * .045 * fill];
  };

  const buildFormation = (which) => {
    for (let i = 0; i < state.count; i++) {
      const [x, y] = pointOn(which, state.seed[i], i);
      state.tx[i] = x;
      state.ty[i] = y;
      state.tz[i] = .15 + state.seed[i] * .85;
    }
  };

  const setFormation = (next, instant = false) => {
    state.morphFrom = state.formation;
    state.sx.set(state.tx);
    state.sy.set(state.ty);
    state.formation = (next + formations.length) % formations.length;
    state.morphStarted = performance.now();
    state.cycleAt = performance.now() + formations[state.formation].duration;
    buildFormation(state.formation);
    if (instant) {
      for (let i = 0; i < state.count; i++) {
        state.x[i] = state.tx[i];
        state.y[i] = state.ty[i];
      }
    }
    updateLabel();
  };

  const resetView = () => {
    state.targetZoom = 1;
    state.targetPanX = 0;
    state.targetPanY = 0;
  };

  const startPortrait = async () => {
    if (state.portraitTargets) return;
    const image = new Image();
    image.decoding = "async";
    image.src = "./portrait/girlfriend.jpg";
    try {
      await image.decode();
    } catch {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
    }

    const off = document.createElement("canvas");
    const w = 150;
    const h = Math.max(150, Math.round(150 * image.naturalHeight / Math.max(image.naturalWidth, 1)));
    off.width = w;
    off.height = h;
    const ox = off.getContext("2d", { willReadFrequently: true });
    if (!ox) return;
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ox.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const pixels = ox.getImageData(0, 0, w, h).data;

    const weights = new Float32Array(w * h);
    let total = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const l = (pixels[idx] * .299 + pixels[idx + 1] * .587 + pixels[idx + 2] * .114) / 255;
        const weight = .14 + Math.pow(1 - l, 1.7) * .86;
        weights[y * w + x] = weight;
        total += weight;
      }
    }

    const target = new Float32Array(state.count * 2);
    for (let i = 0; i < state.count; i++) {
      let r = Math.random() * total;
      let pick = 0;
      while (r > weights[pick] && pick < weights.length - 1) {
        r -= weights[pick];
        pick++;
      }
      const px = pick % w;
      const py = Math.floor(pick / w);
      const nx = (px / Math.max(w - 1, 1)) * 2 - 1;
      const ny = (py / Math.max(h - 1, 1)) * 2 - 1;
      const aspect = w / h;
      target[i * 2] = nx * (aspect < 1 ? .58 : .82);
      target[i * 2 + 1] = ny * (aspect < 1 ? .82 : .58);
    }
    state.portraitTargets = target;
  };

  const resizeObserver = new ResizeObserver(setSize);
  resizeObserver.observe(document.documentElement);
  setSize();

  setFormation(0, true);

  const syncStage = () => {
    const intro = document.querySelector(".intro-hero");
    const portrait = !!document.querySelector(".portrait-reveal");
    const nextIntro = !!intro;

    if (nextIntro !== state.intro) {
      state.intro = nextIntro;
      canvas.classList.toggle("is-interactive", !nextIntro);
      hud.classList.toggle("is-visible", !nextIntro);
      hint.classList.toggle("is-visible", !nextIntro && !coarse);
    }

    if (portrait !== state.portrait) {
      state.portrait = portrait;
      if (portrait) startPortrait().catch(() => {});
      state.morphStarted = performance.now();
      updateLabel();
    }

    if (!nextIntro && !portrait && performance.now() > state.cycleAt && !reducedMotion) {
      setFormation(state.formation + 1);
    }
  };

  hud.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-nebula-action]");
    if (!btn) return;
    const action = btn.dataset.nebulaAction;
    if (action === "next") setFormation(state.formation + 1);
    if (action === "prev") setFormation(state.formation - 1);
    if (action === "reset") resetView();
  });

  const pointerPosition = (event) => [event.clientX, event.clientY];

  canvas.addEventListener("pointerdown", (event) => {
    if (state.intro) return;
    canvas.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, pointerPosition(event));
    state.dragging = state.pointers.size === 1;
    canvas.classList.toggle("is-dragging", state.dragging);
    if (state.pointers.size === 2) {
      const pts = [...state.pointers.values()];
      state.pinchDistance = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state.intro || !state.pointers.has(event.pointerId)) return;
    const prev = state.pointers.get(event.pointerId);
    const current = pointerPosition(event);
    state.pointers.set(event.pointerId, current);

    if (state.pointers.size === 1 && prev) {
      state.targetPanX += current[0] - prev[0];
      state.targetPanY += current[1] - prev[1];
    } else if (state.pointers.size === 2) {
      const pts = [...state.pointers.values()];
      const distance = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (state.pinchDistance > 0) {
        const ratio = distance / state.pinchDistance;
        state.targetZoom = clamp(state.targetZoom * ratio, .62, 2.7);
      }
      state.pinchDistance = distance;
    }
  });

  const releasePointer = (event) => {
    state.pointers.delete(event.pointerId);
    if (state.pointers.size < 2) state.pinchDistance = 0;
    state.dragging = state.pointers.size === 1;
    canvas.classList.toggle("is-dragging", state.dragging);
  };
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (!coarse) releasePointer(event);
  });

  canvas.addEventListener("wheel", (event) => {
    if (state.intro) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * .0012);
    state.targetZoom = clamp(state.targetZoom * factor, .62, 2.7);
  }, { passive: false });

  const observer = new MutationObserver(() => syncStage());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(syncStage, 800);
  syncStage();

  const draw = (now) => {
    const dt = Math.min(.032, Math.max(.001, (now - state.last) / 1000));
    state.last = now;
    state.elapsed += dt;

    const introFade = state.intro ? 0 : state.portrait ? .98 : .72;
    ctx.clearRect(0, 0, state.width, state.height);

    state.zoom = lerp(state.zoom, state.targetZoom, 1 - Math.exp(-8 * dt));
    state.panX = lerp(state.panX, state.targetPanX, 1 - Math.exp(-7 * dt));
    state.panY = lerp(state.panY, state.targetPanY, 1 - Math.exp(-7 * dt));

    const portraitTarget = state.portraitTargets;
    const portraitBlend = state.portrait ? clamp((now - state.morphStarted) / 2200, 0, 1) : 0;
    const formationBlend = clamp((now - state.morphStarted) / 1800, 0, 1);

    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < state.count; i++) {
      let tx = state.tx[i];
      let ty = state.ty[i];
      let tz = state.tz[i];

      if (portraitTarget && state.portrait) {
        tx = lerp(tx, portraitTarget[i * 2], portraitBlend);
        ty = lerp(ty, portraitTarget[i * 2 + 1], portraitBlend);
        tz = .28 + state.seed[i] * .72;
      } else {
        const from = pointOn(state.morphFrom, state.seed[i], i);
        const to = pointOn(state.formation, state.seed[i], i);
        tx = lerp(from[0], to[0], formationBlend);
        ty = lerp(from[1], to[1], formationBlend);
        tz = lerp(.2 + state.seed[i] * .8, .12 + state.seed[i] * .88, formationBlend);
      }

      const flow = reducedMotion ? 0 : .012;
      const wave = Math.sin(state.elapsed * (1.2 + state.seed[i] * 1.4) + state.phase[i]) * flow;
      const breath = Math.cos(state.elapsed * .55 + state.phase[i] * .7) * .018;

      const spring = state.portrait ? .72 : .48;
      state.vx[i] += (tx - state.x[i]) * spring * dt;
      state.vy[i] += (ty - state.y[i]) * spring * dt;
      state.vx[i] *= Math.pow(.035, dt);
      state.vy[i] *= Math.pow(.035, dt);
      state.x[i] += state.vx[i] * dt * 3 + wave * dt;
      state.y[i] += state.vy[i] * dt * 3 + breath * dt;

      const [sx, sy] = worldToScreen(state.x[i], state.y[i], tz);
      const depth = .62 + tz * .58;
      const alphaBase = state.portrait ? .32 + tz * .5 : .16 + tz * .44;
      const flicker = .7 + .3 * Math.sin(state.elapsed * (2.3 + state.seed[i] * 2.5) + state.phase[i]);
      const alpha = clamp(alphaBase * flicker * introFade, 0, .95);
      const size = state.size[i] * depth * (state.portrait ? 1.15 : 1);

      const warm = state.portrait || state.formation === 4;
      const r = warm ? 239 : 204;
      const g = warm ? 218 : 206;
      const b = warm ? 181 : 255;

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(sx, sy, Math.max(.65, size), Math.max(.65, size));
    }

    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
})();
