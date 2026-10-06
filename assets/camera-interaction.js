const CAMERA_STATES = Object.freeze({
  idle: "idle",
  requesting: "requesting",
  active: "active",
  denied: "denied",
  unavailable: "unavailable",
  unsupported: "unsupported",
});

const MOTION = Object.freeze({
  fast: 0.18,
  ui: 0.34,
  reveal: 0.52,
  easeOut: "power3.out",
  easeIn: "power2.in",
});

const ROOT_ID = "universe-camera-ui";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function supported() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === "function";
}

function errorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access for this site, then try again.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is already in use or could not be opened.";
    case "OverconstrainedError":
      return "The preferred camera settings are unavailable on this device.";
    default:
      return "The camera could not be started. You can continue without it.";
  }
}

async function waitForGSAP(timeout = 2200) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const gsap = window.__UNIVERSE_GSAP__ || window.gsap;
    if (gsap) return gsap;
    await wait(30);
  }
  return null;
}

async function ensureScrollTrigger() {
  if (window.ScrollTrigger) return window.ScrollTrigger;
  const existing = document.querySelector('script[data-universe-scrolltrigger="true"]');

  if (existing) {
    await new Promise((resolve, reject) => {
      if (window.ScrollTrigger) {
        resolve();
        return;
      }
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
    return window.ScrollTrigger || null;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./assets/ScrollTrigger.min.js";
    script.async = true;
    script.dataset.universeScrolltrigger = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.ScrollTrigger || null;
}

function buildUI() {
  if (document.getElementById(ROOT_ID)) return null;

  const root = makeElement("section", "universe-camera");
  root.id = ROOT_ID;
  root.setAttribute("aria-label", "Camera interaction");

  const launcher = makeElement("button", "universe-camera__launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-controls", "universe-camera-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = '<span class="universe-camera__launcher-dot" aria-hidden="true"></span><span>Camera</span>';

  const panel = makeElement("div", "universe-camera__panel");
  panel.id = "universe-camera-panel";
  panel.hidden = true;
  panel.setAttribute("aria-hidden", "true");

  const header = makeElement("div", "universe-camera__header");
  const eyebrow = makeElement("span", "universe-camera__eyebrow", "LOCAL VISUAL LAYER");
  const close = makeElement("button", "universe-camera__close", "Close");
  close.type = "button";
  close.setAttribute("aria-label", "Close camera panel");

  const frame = makeElement("div", "universe-camera__frame");
  const video = document.createElement("video");
  video.className = "universe-camera__video";
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute("aria-label", "Live local camera preview");

  const frameOverlay = makeElement("div", "universe-camera__frame-overlay");
  frameOverlay.innerHTML = '<span class="universe-camera__corner tl"></span><span class="universe-camera__corner tr"></span><span class="universe-camera__corner bl"></span><span class="universe-camera__corner br"></span>';

  const statusRow = makeElement("div", "universe-camera__status-row");
  const statusDot = makeElement("span", "universe-camera__status-dot");
  const statusText = makeElement("span", "universe-camera__status-text");

  const privacy = makeElement("p", "universe-camera__privacy", "Video stays in this browser. Nothing is uploaded by this layer.");
  const action = makeElement("button", "universe-camera__action", "Enable camera");
  const note = makeElement("p", "universe-camera__note", "Camera access is optional.");
  action.type = "button";

  statusRow.append(statusDot, statusText);
  frame.append(video, frameOverlay);
  header.append(eyebrow, close);
  panel.append(header, frame, statusRow, privacy, action, note);
  root.append(launcher, panel);
  document.body.appendChild(root);

  return { root, launcher, panel, close, frame, video, statusDot, statusText, privacy, action, note };
}

export function createCameraInteraction() {
  if (typeof document === "undefined") return () => {};

  const ui = buildUI();
  if (!ui) return () => {};

  const state = {
    status: supported() ? CAMERA_STATES.idle : CAMERA_STATES.unsupported,
    stream: null,
    destroyed: false,
    gsap: null,
    context: null,
    reduced: false,
    scrollTrigger: null,
  };

  const syncStateUI = (message) => {
    const labels = {
      idle: "Camera is off",
      requesting: "Waiting for camera permission…",
      active: "Camera active • local only",
      denied: "Camera permission denied",
      unavailable: "Camera unavailable",
      unsupported: window.isSecureContext
        ? "Camera is not supported here"
        : "Camera needs a secure connection",
    };

    const actions = {
      idle: "Enable camera",
      requesting: "Opening camera…",
      active: "Turn camera off",
      denied: "Try again",
      unavailable: "Try again",
      unsupported: "Unavailable",
    };

    ui.panel.dataset.state = state.status;
    ui.statusText.textContent = message || labels[state.status];
    ui.action.textContent = actions[state.status];
    ui.action.disabled = state.status === CAMERA_STATES.requesting || state.status === CAMERA_STATES.unsupported;
    ui.statusDot.dataset.state = state.status;
    ui.launcher.dataset.active = state.status === CAMERA_STATES.active ? "true" : "false";

    ui.note.textContent = state.status === CAMERA_STATES.denied
      ? "Camera access is optional. Update the browser permission and try again."
      : "Camera access is optional.";

    if (state.gsap && !state.reduced) {
      const animate = () => state.gsap.fromTo(ui.statusDot, { scale: 0.8, opacity: 0.4 }, {
        scale: 1,
        opacity: 1,
        duration: MOTION.fast,
        ease: "power2.out",
        overwrite: true,
      });
      state.context ? state.context.add(animate) : animate();
    }
  };

  const stopCamera = () => {
    const stream = state.stream;
    state.stream = null;

    if (stream) {
      for (const track of stream.getTracks()) {
        track.onended = null;
        track.stop();
      }
    }

    ui.video.pause();
    ui.video.srcObject = null;

    if (state.status === CAMERA_STATES.active || state.status === CAMERA_STATES.requesting) {
      state.status = CAMERA_STATES.idle;
      syncStateUI();
    }
  };

  const startCamera = async () => {
    if (state.destroyed || state.status === CAMERA_STATES.requesting || state.status === CAMERA_STATES.active) return;

    if (!supported()) {
      state.status = CAMERA_STATES.unsupported;
      syncStateUI();
      return;
    }

    state.status = CAMERA_STATES.requesting;
    syncStateUI();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
      });

      if (state.destroyed) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      state.stream = stream;
      ui.video.srcObject = stream;
      ui.video.muted = true;
      await ui.video.play().catch(() => {});

      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          if (state.stream === stream) {
            stopCamera();
            state.status = CAMERA_STATES.unavailable;
            syncStateUI("Camera stopped unexpectedly");
          }
        };
      }

      state.status = CAMERA_STATES.active;
      syncStateUI();
    } catch (error) {
      stopCamera();
      state.status = error?.name === "NotAllowedError" || error?.name === "SecurityError"
        ? CAMERA_STATES.denied
        : CAMERA_STATES.unavailable;
      syncStateUI(errorMessage(error));
    }
  };

  const animateOpen = () => {
    ui.panel.hidden = false;
    ui.panel.setAttribute("aria-hidden", "false");
    ui.launcher.setAttribute("aria-expanded", "true");

    if (!state.gsap || state.reduced) {
      ui.panel.style.opacity = "1";
      ui.panel.style.transform = "none";
      return;
    }

    state.gsap.killTweensOf([ui.panel, ui.frame, ui.statusRow, ui.privacy, ui.action, ui.note]);
    const animate = () => {
      state.gsap.set(ui.panel, { clipPath: "inset(8% 0 0 0 round 20px)", opacity: 0, scale: 0.985, y: 12 });
      state.gsap.set([ui.frame, ui.statusRow, ui.privacy, ui.action, ui.note], { opacity: 0, y: 8 });

      const timeline = state.gsap.timeline({ defaults: { overwrite: "auto" } });
      timeline
        .to(ui.panel, {
        clipPath: "inset(0% 0 0 0 round 20px)",
        opacity: 1,
        scale: 1,
        y: 0,
        duration: MOTION.reveal,
        ease: MOTION.easeOut,
      })
      .to(ui.frame, { opacity: 1, y: 0, duration: 0.36, ease: "power2.out" }, "-=0.30")
      .to([ui.statusRow, ui.privacy, ui.action, ui.note], {
        opacity: 1,
        y: 0,
        duration: MOTION.ui,
        stagger: 0.04,
        ease: "power2.out",
        }, "-=0.18");
    };
    state.context ? state.context.add(animate) : animate();
  };

  const animateClose = () => {
    if (!state.gsap || state.reduced) {
      ui.panel.hidden = true;
      ui.panel.setAttribute("aria-hidden", "true");
      return;
    }

    state.gsap.killTweensOf(ui.panel);
    const animate = () => state.gsap.to(ui.panel, {
      opacity: 0,
      y: 10,
      scale: 0.985,
      duration: 0.26,
      ease: MOTION.easeIn,
      overwrite: true,
      onComplete: () => {
        ui.panel.hidden = true;
        ui.panel.setAttribute("aria-hidden", "true");
        state.gsap.set(ui.panel, { clearProps: "all" });
      },
    });
    state.context ? state.context.add(animate) : animate();
  };

  const setupScrollMotion = async () => {
    if (!state.gsap || state.destroyed) return;
    try {
      const ScrollTrigger = await ensureScrollTrigger();
      if (!ScrollTrigger || state.destroyed || ui.panel.hidden) return;

      state.scrollTrigger?.kill();
      state.scrollTrigger = ScrollTrigger.create({
        trigger: ui.panel,
        start: "top bottom",
        end: "bottom top",
        once: true,
        onEnter: () => {
          if (!state.reduced) {
            const animate = () => state.gsap.to(ui.frame, {
              scale: 1,
              duration: 0.5,
              ease: "power3.out",
              overwrite: true,
            });
            state.context ? state.context.add(animate) : animate();
          }
        },
      });
    } catch (error) {
      console.warn("[CameraInteraction] ScrollTrigger unavailable:", error);
    }
  };

  let open = false;

  const handleOpenToggle = () => {
    open = !open;
    if (open) {
      animateOpen();
      void setupScrollMotion();
      ui.close.focus({ preventScroll: true });
    } else {
      stopCamera();
      state.scrollTrigger?.kill();
      state.scrollTrigger = null;
      animateClose();
      ui.launcher.focus({ preventScroll: true });
      ui.launcher.setAttribute("aria-expanded", "false");
    }
  };

  const handleClose = () => {
    if (!open) return;
    open = false;
    stopCamera();
    state.scrollTrigger?.kill();
    state.scrollTrigger = null;
    animateClose();
    ui.launcher.setAttribute("aria-expanded", "false");
    ui.launcher.focus({ preventScroll: true });
  };

  const handleAction = () => {
    if (state.status === CAMERA_STATES.active) stopCamera();
    else void startCamera();
  };

  const handleKey = (event) => {
    if (event.key === "Escape" && open) handleClose();
  };

  const bindMicroInteractions = () => {
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    state.reduced = reducedQuery.matches;

    const onMotionPreferenceChange = (event) => {
      state.reduced = event.matches;
      if (state.reduced && state.gsap) {
        state.gsap.killTweensOf([ui.root, ui.panel, ui.frame, ui.statusDot, ui.launcher, ui.action]);
        ui.panel.style.opacity = "1";
        ui.panel.style.transform = "none";
      }
    };

    const launcherEnter = () => {
      if (!state.gsap || state.reduced) return;
      const animate = () => state.gsap.to(ui.launcher, { y: -2, scale: 1.02, duration: MOTION.fast, ease: "power2.out", overwrite: true });
      state.context ? state.context.add(animate) : animate();
    };
    const launcherLeave = () => {
      if (!state.gsap || state.reduced) return;
      const animate = () => state.gsap.to(ui.launcher, { y: 0, scale: 1, duration: 0.20, ease: "power2.out", overwrite: true });
      state.context ? state.context.add(animate) : animate();
    };
    const actionEnter = () => {
      if (!state.gsap || state.reduced || ui.action.disabled) return;
      const animate = () => state.gsap.to(ui.action, { y: -1, duration: 0.16, ease: "power2.out", overwrite: true });
      state.context ? state.context.add(animate) : animate();
    };
    const actionLeave = () => {
      if (!state.gsap || state.reduced) return;
      const animate = () => state.gsap.to(ui.action, { y: 0, duration: 0.18, ease: "power2.out", overwrite: true });
      state.context ? state.context.add(animate) : animate();
    };

    reducedQuery.addEventListener?.("change", onMotionPreferenceChange);
    ui.launcher.addEventListener("pointerenter", launcherEnter);
    ui.launcher.addEventListener("pointerleave", launcherLeave);
    ui.action.addEventListener("pointerenter", actionEnter);
    ui.action.addEventListener("pointerleave", actionLeave);

    return () => {
      reducedQuery.removeEventListener?.("change", onMotionPreferenceChange);
      ui.launcher.removeEventListener("pointerenter", launcherEnter);
      ui.launcher.removeEventListener("pointerleave", launcherLeave);
      ui.action.removeEventListener("pointerenter", actionEnter);
      ui.action.removeEventListener("pointerleave", actionLeave);
    };
  };

  const cleanupMicro = bindMicroInteractions();

  ui.launcher.addEventListener("click", handleOpenToggle);
  ui.close.addEventListener("click", handleClose);
  ui.action.addEventListener("click", handleAction);
  document.addEventListener("keydown", handleKey);
  window.addEventListener("pagehide", stopCamera);
  window.addEventListener("beforeunload", stopCamera);

  syncStateUI();

  void waitForGSAP().then((gsap) => {
    if (state.destroyed || !gsap) return;

    state.gsap = gsap;

    try {
      state.context = gsap.context(() => {}, ui.root);
      if (!state.reduced) {
        const animate = () => gsap.fromTo(ui.launcher, { opacity: 0, y: 8 }, {
          opacity: 1,
          y: 0,
          duration: MOTION.reveal,
          ease: MOTION.easeOut,
          overwrite: true,
        });
        state.context ? state.context.add(animate) : animate();
      } else {
        gsap.set(ui.launcher, { opacity: 1, y: 0 });
      }
    } catch (error) {
      console.warn("[CameraInteraction] GSAP context bootstrap failed:", error);
    }
  });

  window.__UNIVERSE_CAMERA__ = Object.freeze({
    getState: () => state.status,
    open: () => {
      if (!open) handleOpenToggle();
    },
    close: () => {
      if (open) handleClose();
    },
    start: startCamera,
    stop: stopCamera,
  });

  return () => {
    state.destroyed = true;
    open = false;
    stopCamera();
    state.scrollTrigger?.kill();
    state.scrollTrigger = null;
    cleanupMicro?.();
    ui.launcher.removeEventListener("click", handleOpenToggle);
    ui.close.removeEventListener("click", handleClose);
    ui.action.removeEventListener("click", handleAction);
    document.removeEventListener("keydown", handleKey);
    window.removeEventListener("pagehide", stopCamera);
    window.removeEventListener("beforeunload", stopCamera);
    state.context?.revert?.();
    state.gsap?.killTweensOf([
      ui.root,
      ui.launcher,
      ui.panel,
      ui.frame,
      ui.statusDot,
      ui.statusRow,
      ui.privacy,
      ui.action,
      ui.note,
    ]);
    if (window.__UNIVERSE_CAMERA__) delete window.__UNIVERSE_CAMERA__;
    ui.root.remove();
  };
}

const destroyCameraInteraction = createCameraInteraction();
if (import.meta.hot) import.meta.hot.dispose(destroyCameraInteraction);
