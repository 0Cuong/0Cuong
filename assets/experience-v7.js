(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const state = {
    audio: null,
    minimal: false,
    raf: 0,
    lastPointer: { x: 50, y: 50 },
  };

  const chrome = document.createElement("div");
  chrome.id = "experience-chrome";
  chrome.setAttribute("aria-label", "Điều khiển trải nghiệm");
  chrome.innerHTML = `
    <div class="cx-brand" aria-hidden="true">
      <span>For Xuân Nghi</span>
    </div>
    <div class="cx-actions">
      <button class="cx-button" type="button" data-action="sound" aria-pressed="false" aria-label="Bật âm thanh">
        <span class="cx-button__icon" aria-hidden="true">♪</span>
        <span>Âm thanh</span>
      </button>
      <button class="cx-button" type="button" data-action="minimal" aria-pressed="false" aria-label="Bật chế độ tối giản">
        <span class="cx-button__icon" aria-hidden="true">◌</span>
        <span>Tối giản</span>
      </button>
      <button class="cx-button" type="button" data-action="restart" aria-label="Xem lại từ đầu">
        <span class="cx-button__icon" aria-hidden="true">↻</span>
        <span>Xem lại</span>
      </button>
    </div>
    <div class="cx-progress" aria-hidden="true">
      <i class="cx-progress__dot"></i>
      <i class="cx-progress__dot"></i>
      <i class="cx-progress__dot"></i>
      <i class="cx-progress__dot"></i>
      <i class="cx-progress__dot"></i>
      <span class="cx-progress__label">A little universe</span>
    </div>
  `;
  body.appendChild(chrome);

  const getAudio = () => {
    if (state.audio && document.contains(state.audio)) return state.audio;
    state.audio = document.querySelector("audio");
    return state.audio;
  };

  const syncAudioButton = () => {
    const audio = getAudio();
    const button = chrome.querySelector('[data-action="sound"]');
    if (!button) return;

    const playing = !!audio && !audio.paused && !audio.ended && audio.readyState > 0;
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-label", playing ? "Tắt âm thanh" : "Bật âm thanh");
  };

  const syncIntroState = () => {
    const intro = document.querySelector(".intro-hero");
    chrome.classList.toggle("is-intro", !!intro);
    if (!intro) chrome.classList.add("is-ready");
    syncAudioButton();
  };

  const setMinimal = (enabled) => {
    state.minimal = enabled;
    root.dataset.minimal = String(enabled);
    const button = chrome.querySelector('[data-action="minimal"]');
    button?.setAttribute("aria-pressed", String(enabled));
  };

  chrome.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "sound") {
      const audio = getAudio();
      if (!audio) return;
      try {
        if (audio.paused) {
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (error) {
        console.warn("[experience-v7] Audio interaction was blocked:", error);
      }
      syncAudioButton();
      return;
    }

    if (action === "minimal") {
      setMinimal(!state.minimal);
      return;
    }

    if (action === "restart") {
      window.location.reload();
    }
  });

  if (!prefersReducedMotion && window.matchMedia?.("(pointer:fine)")?.matches) {
    window.addEventListener("pointermove", (event) => {
      state.lastPointer.x = (event.clientX / Math.max(window.innerWidth, 1)) * 100;
      state.lastPointer.y = (event.clientY / Math.max(window.innerHeight, 1)) * 100;

      if (state.raf) return;
      state.raf = requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${state.lastPointer.x.toFixed(2)}%`);
        root.style.setProperty("--pointer-y", `${state.lastPointer.y.toFixed(2)}%`);
        state.raf = 0;
      });
    }, { passive: true });
  }

  const observer = new MutationObserver(syncIntroState);
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });

  setInterval(syncIntroState, 1200);

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    if (state.raf) cancelAnimationFrame(state.raf);
  }, { once: true });

  syncIntroState();
})();
