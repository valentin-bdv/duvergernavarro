// Duverger Navarro — interactions légères
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Horaires (lundi–jeudi 8h–12h / 14h–18h, vendredi 8h–12h) ----------
     0 = dimanche … 6 = samedi ; créneaux en minutes depuis minuit */
  const H = (h, m = 0) => h * 60 + m;
  const HOURS = {
    0: [],
    1: [[H(8), H(12)], [H(14), H(18)]],
    2: [[H(8), H(12)], [H(14), H(18)]],
    3: [[H(8), H(12)], [H(14), H(18)]],
    4: [[H(8), H(12)], [H(14), H(18)]],
    5: [[H(8), H(12)]],
    6: [],
  };
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const fmt = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

  // Heure locale de Paris, quel que soit le fuseau du visiteur
  function parisNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day: wd, min: (+get("hour") % 24) * 60 + +get("minute") };
  }

  function nextOpening(day, min) {
    for (let i = 0; i < 8; i++) {
      const d = (day + i) % 7;
      for (const [start] of HOURS[d]) {
        if (i > 0 || start > min) {
          const when = i === 0 ? "aujourd'hui" : i === 1 ? "demain" : DAYS[d];
          return `${when} à ${fmt(start)}`;
        }
      }
    }
    return "";
  }

  function updateStatus() {
    const el = $("#status");
    if (!el) return;
    const { day, min } = parisNow();
    const slot = HOURS[day].find(([a, b]) => min >= a && min < b);
    const label = $(".status-label", el);
    el.classList.toggle("open", !!slot);
    el.classList.toggle("closed", !slot);
    label.innerHTML = slot
      ? `Ouvert<span class="s-more"> · jusqu'à ${fmt(slot[1])}</span>`
      : `Fermé<span class="s-more"> · réouvre ${nextOpening(day, min)}</span>`;

    $$(".hours-row").forEach((r) => r.classList.toggle("today", r.dataset.days.split(",").map(Number).includes(day)));
  }
  updateStatus();
  setInterval(updateStatus, 60_000);

  /* ---------- Header au scroll ---------- */
  const header = $(".header");
  const alwaysSolid = header.classList.contains("scrolled"); // page mentions légales
  const onScroll = () => header.classList.toggle("scrolled", alwaysSolid || window.scrollY > 30);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menu mobile (tiroir à droite) ---------- */
  const burger = $(".burger");
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger?.setAttribute("aria-expanded", String(open));
    burger?.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  };
  burger?.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  $(".nav-backdrop")?.addEventListener("click", () => setMenu(false));
  $$(".nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  /* ---------- Apparition au scroll ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("in"));
  }

  /* ---------- Carrousel des services ----------
     Boucle infinie (après le dernier service on retrouve le premier, dans les deux sens).
     Chaque slide est placée selon son écart à la position courante : pas de retour
     en arrière ni de téléportation. Des clics rapides s'additionnent et le carrousel
     accélère pour rattraper la cible.
     Défilement auto en continu (même au survol). Un clic sur une flèche, un swipe ou
     le clavier passe en manuel ; retour en auto après 45 s, ou en quittant la
     section puis en y revenant. */
  const svc = $(".svc");
  if (svc) {
    const DUR = 7000, MANUAL_MS = 45000, TAU = 115; // TAU : réactivité de l'animation (ms)
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewport = $(".svc-viewport", svc);
    const slides = $$(".svc-slide", svc);
    const progress = $(".svc-progress", svc);
    const n = slides.length;
    let pos = 0, target = 0, raf = null, last = 0, tau = TAU, introPending = false;
    let timer = null, started = 0, remaining = DUR, manualTimer = null, leftWhileManual = false;
    const reasons = new Set(); // reduce | offscreen | hidden | drag | manual
    if (reduce) reasons.add("reduce");
    svc.style.setProperty("--dur", `${DUR}ms`);

    const mod = (a) => ((a % n) + n) % n;
    function render() {
      slides.forEach((s, k) => {
        let d = mod(k - pos);
        if (d > n / 2) d -= n;
        s.style.transform = `translateX(${d * 100}%)`;
        s.style.visibility = Math.abs(d) < 1 && !(introPending && k !== 0) ? "visible" : "hidden";
      });
    }
    function tick(t) {
      const dt = Math.min(64, t - last); last = t;
      const diff = target - pos;
      if (Math.abs(diff) < 0.001) { pos = target; tau = TAU; introPending = false; render(); raf = null; return; }
      pos += diff * (1 - Math.exp(-dt / tau));
      render();
      raf = requestAnimationFrame(tick);
    }
    function animate() {
      if (reduce) { pos = target; render(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function setActive() {
      const a = mod(Math.round(target));
      slides.forEach((s, k) => {
        const on = k === a;
        s.classList.toggle("is-active", on);
        s.setAttribute("aria-hidden", String(!on));
        s.inert = !on;
      });
    }

    const restartProgress = () => {
      progress.classList.remove("run");
      void progress.offsetWidth;
      if (!reduce && !reasons.has("manual")) progress.classList.add("run");
    };
    const sync = () => {
      clearTimeout(timer);
      svc.classList.toggle("paused", reasons.size > 0);
      svc.classList.toggle("manual", reasons.has("manual"));
      if (!reasons.size) {
        started = Date.now();
        timer = setTimeout(() => moveTo(Math.round(target) + 1), Math.max(300, remaining));
      }
    };
    const pause = (why) => {
      if (!reasons.size) remaining -= Date.now() - started;
      reasons.add(why);
      sync();
    };
    const resume = (why) => { reasons.delete(why); sync(); };

    function moveTo(t) {
      target = t;
      setActive();
      animate();
      remaining = DUR;
      restartProgress();
      sync();
    }
    function endManual() {
      clearTimeout(manualTimer);
      if (!reasons.has("manual")) return;
      reasons.delete("manual");
      remaining = DUR;
      restartProgress();
      sync();
    }
    function manualTo(t) {
      if (introPending) { introPending = false; reasons.delete("intro"); }
      svc.classList.add("touched");
      reasons.add("manual");
      clearTimeout(manualTimer);
      manualTimer = setTimeout(endManual, MANUAL_MS);
      moveTo(t);
    }

    $(".svc-prev", svc).addEventListener("click", () => manualTo(Math.round(target) - 1));
    $(".svc-next", svc).addEventListener("click", () => manualTo(Math.round(target) + 1));
    svc.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      manualTo(Math.round(target) + (e.key === "ArrowRight" ? 1 : -1));
    });

    document.addEventListener("visibilitychange", () => (document.hidden ? pause("hidden") : resume("hidden")));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          if (leftWhileManual) { leftWhileManual = false; remaining = DUR; restartProgress(); }
          resume("offscreen");
        } else {
          if (reasons.has("manual")) { clearTimeout(manualTimer); reasons.delete("manual"); leftWhileManual = true; }
          pause("offscreen");
        }
      }, { threshold: 0.2 }).observe(svc);
    }

    // swipe (tactile et souris) : la piste suit le doigt
    let x0 = null, y0 = 0, dx = 0, locked = null, base = 0;
    viewport.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("a, button")) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; locked = null;
      pause("drag");
    });
    viewport.addEventListener("pointermove", (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (locked === null && (Math.abs(dx) > 8 || Math.abs(e.clientY - y0) > 8)) {
        locked = Math.abs(dx) > Math.abs(e.clientY - y0) ? "x" : "y";
        if (locked === "x") {
          viewport.setPointerCapture(e.pointerId);
          viewport.classList.add("dragging");
          if (raf) { cancelAnimationFrame(raf); raf = null; }
          base = pos;
          introPending = false;
        }
      }
      if (locked === "x") { pos = base - dx / viewport.clientWidth; render(); }
    });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      viewport.classList.remove("dragging");
      reasons.delete("drag");
      if (locked === "x") {
        const far = Math.abs(dx) > Math.min(90, viewport.clientWidth * 0.15);
        const t = far ? (dx < 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1) : Math.round(pos);
        manualTo(t);
      } else {
        sync();
      }
    };
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", end);

    /* Entrée : quand le premier tiers de la carte de dessin devient visible, « Plomberie » arrive
       depuis la droite comme après un swipe — on comprend tout de suite que ça défile. */
    if (reduce || !("IntersectionObserver" in window)) {
      render();
      moveTo(0);
    } else {
      introPending = true;
      reasons.add("intro");
      pos = target = -1;
      setActive();
      render();
      // déclencheur : le premier tiers de la carte de dessin est visible à l'écran
      // (on observe la carte à l'emplacement central, encore masquée)
      const card = $(".svc-art", slides[n - 1]);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting || e.intersectionRatio < 0.33) return;
        io.disconnect();
        if (!introPending) return;
        reasons.delete("intro"); // introPending reste vrai jusqu'à la fin du glissement
        tau = 230; // entrée plus posée que la navigation
        moveTo(0);
      }, { threshold: [0.33, 0.34] });
      io.observe(card);
    }
  }

  /* ---------- Carte : contour des Landes (Leaflet) ---------- */
  const mapEl = $("#map");
  if (mapEl && window.L && window.LANDES_GEOJSON) {
    const map = L.map(mapEl, {
      scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false,
      zoomSnap: 0.25, attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Fond &copy; Esri, HERE, Garmin, &copy; contributeurs OpenStreetMap",
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16, pane: "overlayPane", opacity: 0.9,
    }).addTo(map);
    // voile clair hors du département pour faire ressortir les Landes
    const world = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
    const holes = LANDES_GEOJSON.geometry.coordinates.map((poly) => poly[0].map(([x, y]) => [y, x]));
    L.polygon([world, ...holes], { stroke: false, fillColor: "#f6f0e6", fillOpacity: 0.72, interactive: false }).addTo(map);
    const landes = L.geoJSON(LANDES_GEOJSON, {
      interactive: false,
      style: { color: "#c4733b", weight: 3, fillColor: "#c4733b", fillOpacity: 0.06 },
    }).addTo(map);
    map.fitBounds(landes.getBounds(), { padding: [20, 20] });
    L.marker([44.082, -0.717], {
      title: "Duverger Navarro — Luglon",
      icon: L.divIcon({ className: "map-pin", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] }),
    }).addTo(map);
    window.addEventListener("resize", () => map.fitBounds(landes.getBounds(), { padding: [20, 20] }));
  } else if (mapEl) {
    // repli si Leaflet ne charge pas
    mapEl.innerHTML = '<iframe title="Carte des Landes" loading="lazy" style="width:100%;height:100%;border:0" src="https://www.openstreetmap.org/export/embed.html?bbox=-1.65%2C43.45%2C0.25%2C44.60&amp;layer=mapnik&amp;marker=44.082%2C-0.717"></iframe>';
  }

  /* ---------- Formulaire de devis ----------
     Site statique (GitHub Pages) : pas de serveur d'envoi. Le bouton prépare un
     e-mail (destinataire, objet, message) dans la messagerie du visiteur. */
  const MAIL = "duvergernavarro@gmail.com";
  const form = $("#devis-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const d = new FormData(form);
    const besoins = d.getAll("besoin");
    const commune = String(d.get("commune") || "").trim();
    const subject = `Demande de devis${besoins.length ? " - " + besoins.join(", ") : ""}${commune ? " - " + commune : ""}`;
    const body = [
      "Bonjour,",
      "",
      String(d.get("message") || "").trim() || "Je souhaiterais être recontacté(e) pour un devis.",
      "",
      `Besoin : ${besoins.join(", ") || "non précisé"}`,
      `Commune : ${commune}`,
      "",
      "Cordialement,",
      String(d.get("nom") || "").trim(),
      `Tél. : ${String(d.get("tel") || "").trim()}`,
    ].join("\r\n");
    window.location.href = `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    form.closest(".form").classList.add("sent");
  });
  $("#form-reset")?.addEventListener("click", (e) => {
    e.preventDefault();
    form.closest(".form").classList.remove("sent");
  });
  $("#copy-mail")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(MAIL); btn.textContent = "Adresse copiée ✓"; }
    catch { btn.textContent = MAIL; }
  });

  /* ---------- Année du footer ---------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
