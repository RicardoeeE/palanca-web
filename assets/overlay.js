// Sistema de overlay para simulaciones de Palanca
// Uso: SimOverlay.open("miller-3d")  /  SimOverlay.close()

const SimOverlay = (() => {
  let _overlay = null;
  let _frame   = null;
  let _title   = null;
  let _sub     = null;

  function _build() {
    if (_overlay) return;

    _overlay = document.createElement("div");
    _overlay.id = "sim-overlay";
    _overlay.innerHTML = `
      <div class="sim-overlay-backdrop"></div>
      <div class="sim-overlay-panel">
        <header class="sim-overlay-header">
          <div class="sim-overlay-meta">
            <span class="sim-overlay-sub" id="sim-overlay-sub"></span>
            <h2 class="sim-overlay-title" id="sim-overlay-title"></h2>
          </div>
          <button class="sim-overlay-close" id="sim-overlay-close" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </header>
        <div class="sim-overlay-body">
          <iframe id="sim-overlay-frame" src="" allowfullscreen loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        </div>
        <div class="sim-overlay-loader" id="sim-overlay-loader">
          <span class="sim-overlay-spinner"></span>
        </div>
      </div>
    `;

    document.body.appendChild(_overlay);

    _frame  = document.getElementById("sim-overlay-frame");
    _title  = document.getElementById("sim-overlay-title");
    _sub    = document.getElementById("sim-overlay-sub");

    document.getElementById("sim-overlay-close").addEventListener("click", SimOverlay.close);
    _overlay.querySelector(".sim-overlay-backdrop").addEventListener("click", SimOverlay.close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") SimOverlay.close();
    });

    _frame.addEventListener("load", () => {
      document.getElementById("sim-overlay-loader").style.display = "none";
    });
  }

  function open(simId, lang) {
    _build();
    const sim = SIMS.find(s => s.id === simId);
    if (!sim) return;

    const isEs    = (lang || document.documentElement.lang || "es") === "es";
    const subject = SUBJECTS.find(s => s.id === sim.subject);

    _title.textContent = isEs ? sim.titleEs : sim.titleEn;
    _sub.textContent   = subject ? (isEs ? subject.labelEs : subject.labelEn) : "";

    document.getElementById("sim-overlay-loader").style.display = "flex";
    _frame.src = sim.file;

    _overlay.classList.add("sim-overlay-visible");
    document.body.style.overflow = "hidden";

    // Push history state so the back button closes the overlay
    history.pushState({ simOverlay: simId }, "", `#sim-${simId}`);
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove("sim-overlay-visible");
    document.body.style.overflow = "";
    _frame.src = "";
    if (location.hash.startsWith("#sim-")) history.back();
  }

  // Handle browser back button
  window.addEventListener("popstate", (e) => {
    if (_overlay && _overlay.classList.contains("sim-overlay-visible")) {
      _overlay.classList.remove("sim-overlay-visible");
      document.body.style.overflow = "";
      _frame.src = "";
    }
  });

  return { open, close };
})();
