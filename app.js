/* ============================================================
   DeepSeek Peak / Off-Peak viewer
   Peak (UTC, Mon–Fri): 01:00–04:00 and 06:00–10:00
   Everything else (incl. weekends + CN holidays) = off-peak
   ============================================================ */

(() => {
  "use strict";

  // ---- Configuration ----------------------------------------
  const PEAK_WINDOWS = [
    [1, 4],   // 01:00–04:00 UTC
    [6, 10],  // 06:00–10:00 UTC
  ];

  // A curated list of common zones (in addition to the browser's own)
  const ZONE_CHOICES = [
    "UTC",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Singapore",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];

  // ---- DOM refs ---------------------------------------------
  const $ = (id) => document.getElementById(id);

  const tzSelect     = $("tzSelect");
  const tzHint       = $("tzHint");
  const holidayToggle= $("holidayToggle");

  const statusCard   = $("statusCard");
  const statusBadge  = $("statusBadge");
  const statusDesc   = $("statusDesc");
  const statusRate   = $("statusRate");

  // Page-wide state takeover (drives the CSS in style.css)
  const root         = document.documentElement;
  const bannerBadge  = $("bannerBadge");
  const bannerText   = $("bannerText");
  const bannerCount  = $("bannerCount");
  const themeColor   = $("themeColor");
  const stateAnnounce= $("stateAnnounce");

  const localClock   = $("localClock");
  const localDate    = $("localDate");
  const utcClock     = $("utcClock");
  const utcDate      = $("utcDate");
  const nextLabel    = $("nextLabel");
  const countdown    = $("countdown");
  const nextAt       = $("nextAt");

  const week         = $("week");
  const weekSub      = $("weekSub");

  // ---- State ------------------------------------------------
  const state = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    manualHoliday: false,
  };

  // ---- Time-zone helpers ------------------------------------

  /** Format parts of a Date in a given time zone. */
  function partsIn(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const out = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== "literal") out[p.type] = p.value;
    }
    // Normalise hour: 24 → 0
    let h = parseInt(out.hour, 10);
    if (h === 24) h = 0;
    out.hour = String(h).padStart(2, "0");
    return out;
  }

  /** Offset in minutes: local time − UTC, for a given instant. */
  function zoneOffsetMinutes(date, timeZone) {
    const p = partsIn(date, timeZone);
    const asUTC = Date.UTC(
      +p.year, +p.month - 1, +p.day,
      +p.hour, +p.minute, +p.second
    );
    return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000;
  }

  /** Given a wall-clock time in a zone, return the real UTC Date. */
  function zonedTimeToUtc(y, m, d, hh, mm, timeZone) {
    // First guess: treat wall time as if it were UTC
    let guess = Date.UTC(y, m - 1, d, hh, mm, 0);
    // Iterate to converge on the right offset (handles DST)
    for (let i = 0; i < 3; i++) {
      const off = zoneOffsetMinutes(new Date(guess), timeZone);
      const next = Date.UTC(y, m - 1, d, hh, mm, 0) - off * 60000;
      if (next === guess) break;
      guess = next;
    }
    return new Date(guess);
  }

  // ---- Peak logic (all in UTC) ------------------------------

  /** Is the given instant inside a peak window in UTC? */
  function isPeakUTC(date) {
    const day = date.getUTCDay();           // 0 = Sunday
    if (day === 0 || day === 6) return false;

    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    return PEAK_WINDOWS.some(([a, b]) => minutes >= a * 60 && minutes < b * 60);
  }

  /** Next transition (peak ⇄ off-peak) strictly after `date`, in UTC. */
  function nextTransitionUTC(date) {
    const STEP = 60 * 1000; // scan in 1-minute steps (max 7 days)
    let t = new Date(Math.ceil(date.getTime() / STEP) * STEP);
    const current = isPeakUTC(date);
    const limit = date.getTime() + 7 * 24 * 60 * 60 * 1000;

    while (t.getTime() < limit) {
      if (isPeakUTC(t) !== current) return t;
      t = new Date(t.getTime() + STEP);
    }
    return null;
  }

  // ---- Effective "is peak" for the selected zone -----------
  // Peak is defined in UTC, so location doesn't change it —
  // but the *label* on the status card should reflect whether the
  // local day is a weekend, which is purely informational.
  // Holidays are user-toggled (CN calendar not computed here).

  /** Should the given instant be treated as off-peak due to holiday? */
  function isHolidayNow() {
    return state.manualHoliday;
  }

  function effectivePeak(date) {
    if (isHolidayNow()) return false;
    return isPeakUTC(date);
  }

  // ---- Formatting -------------------------------------------

  function fmtClock(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone, hour12: false,
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(date);
  }

  function fmtDate(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long", day: "numeric", month: "short", year: "numeric",
    }).format(date);
  }

  function fmtLocalDateTime(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  }

  function fmtDuration(ms) {
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return d > 0
      ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // ---- Time-zone selector -----------------------------------

  function buildZoneOptions() {
    const detected = state.timeZone;
    const zones = Array.from(new Set([detected, ...ZONE_CHOICES])).filter(Boolean);

    tzSelect.innerHTML = "";
    for (const z of zones) {
      const opt = document.createElement("option");
      opt.value = z;
      opt.textContent = z === detected ? `${z}  (detected)` : z;
      tzSelect.appendChild(opt);
    }
    tzSelect.value = detected;

    // Nice label
    let city = detected.split("/").pop().replace(/_/g, " ");
    tzHint.textContent = `Currently showing: ${city} · ${detected}`;
  }

  // ---- Week rendering ---------------------------------------

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /**
   * Build the week grid for the *local* week containing "now".
   * For each local day we convert the UTC peak windows into
   * local clock positions so the bars line up with the axis.
   */
  function renderWeek(now) {
    const tz = state.timeZone;

    // Determine local "today" and start of local week (Sunday)
    const todayParts = partsIn(now, tz);
    const todayDow = new Date(
      Date.UTC(+todayParts.year, +todayParts.month - 1, +todayParts.day)
    ).getUTCDay();

    // Sunday of this local week, at local midnight
    const startWall = new Date(Date.UTC(
      +todayParts.year, +todayParts.month - 1, +todayParts.day - todayDow
    ));
    const startY = startWall.getUTCFullYear();
    const startM = startWall.getUTCMonth() + 1;
    const startD = startWall.getUTCDate();

    week.innerHTML = "";

    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(startY, startM - 1, startD + i));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const dow = d.getUTCDay();

      const isToday = i === todayDow;
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = state.manualHoliday && isToday;

      const row = document.createElement("div");
      row.className =
        "day" +
        (isToday ? " is-today" : "") +
        (isWeekend ? " is-weekend" : "") +
        (isHoliday ? " is-holiday" : "");

      const name = document.createElement("div");
      name.className = "day-name";
      name.textContent = DAY_NAMES[dow];
      row.appendChild(name);

      const track = document.createElement("div");
      track.className = "track";

      // hour ticks (every 3h)
      const ticks = document.createElement("div");
      ticks.className = "ticks";
      for (let h = 3; h < 24; h += 3) {
        const tick = document.createElement("i");
        tick.style.left = `${(h / 24) * 100}%`;
        ticks.appendChild(tick);
      }
      track.appendChild(ticks);

      // Draw each UTC peak window as it appears in local time.
      if (!isWeekend && !isHoliday) {
        for (const [aUTC, bUTC] of PEAK_WINDOWS) {
          // Split across day boundaries just in case.
          const startLocal = zonedTimeToUtc(y, m, day, aUTC, 0, tz);
          const endLocal   = zonedTimeToUtc(y, m, day, bUTC, 0, tz);

          // Clip to the local day [00:00, 24:00)
          const dayStart = zonedTimeToUtc(y, m, day, 0, 0, tz);
          const dayEnd   = zonedTimeToUtc(y, m, day + 1, 0, 0, tz);

          const s = Math.max(startLocal.getTime(), dayStart.getTime());
          const e = Math.min(endLocal.getTime(), dayEnd.getTime());
          if (e <= s) continue;

          const left  = ((s - dayStart.getTime()) / (dayEnd - dayStart)) * 100;
          const width = ((e - s) / (dayEnd - dayStart)) * 100;

          const block = document.createElement("div");
          block.className = "block";
          block.style.left = `${left}%`;
          block.style.width = `${Math.max(width, 0.6)}%`;
          block.title = `${aUTC}:00–${bUTC}:00 UTC`;
          track.appendChild(block);
        }
      }

      // "now" marker
      if (isToday) {
        const dayStart = zonedTimeToUtc(y, m, day, 0, 0, tz);
        const dayEnd   = zonedTimeToUtc(y, m, day + 1, 0, 0, tz);
        const pct = (now.getTime() - dayStart.getTime()) / (dayEnd - dayStart);
        if (pct >= 0 && pct <= 1) {
          const marker = document.createElement("div");
          marker.className = "now-marker";
          marker.style.left = `${pct * 100}%`;
          track.appendChild(marker);
        }
      }

      row.appendChild(track);
      week.appendChild(row);
    }

    // Axis labels (local hours)
    const axis = document.createElement("div");
    axis.className = "axis";
    const spacer = document.createElement("div");
    const labels = document.createElement("div");
    labels.className = "axis-labels";
    for (let h = 0; h <= 24; h += 6) {
      const s = document.createElement("span");
      s.textContent = String(h).padStart(2, "0") + ":00";
      labels.appendChild(s);
    }
    axis.appendChild(spacer);
    axis.appendChild(labels);
    week.appendChild(axis);

    // Subtitle
    const startLabel = fmtDate(zonedTimeToUtc(startY, startM, startD, 12, 0, tz), tz);
    weekSub.textContent = `Week of ${startLabel} · times shown in your local clock`;
  }

  // ---- Status card update -----------------------------------

  function updateStatus(now) {
    const tz = state.timeZone;
    const peak = effectivePeak(now);
    const nextState = peak ? "peak" : "off-peak";

    statusCard.dataset.state = nextState;
    if (root.dataset.state !== nextState) {
      // Flip the whole page: banner, page wash, viewport ring, ghost word.
      root.dataset.state = nextState;
      stateAnnounce.textContent = peak
        ? "Peak hours. Full rates apply."
        : "Off-peak hours. Rates are 50% off.";
    }

    statusBadge.textContent = peak ? "Peak" : "Off-peak";

    // Sticky banner — the loudest signal, visible even when scrolled.
    bannerBadge.textContent = peak ? "Peak hours" : "Off-peak";
    bannerText.innerHTML = peak
      ? "<strong>Full rate</strong> — you are paying 2&times; right now"
      : "<strong>50% off</strong> — you are in off-peak hours";
    themeColor.setAttribute("content", peak ? "#ef4444" : "#4d6bfe");

    // Description
    let desc;
    if (state.manualHoliday) {
      desc = "Chinese public holiday — off-peak all day.";
    } else if (isPeakUTC(now)) {
      desc = "Inside a UTC peak window — full rates apply.";
    } else {
      const utcDow = now.getUTCDay();
      if (utcDow === 0 || utcDow === 6) {
        desc = "Weekend in UTC — always off-peak.";
      } else {
        desc = "Outside peak windows — 50% off.";
      }
    }
    statusDesc.textContent = desc;

    statusRate.textContent = peak
      ? "PEAK — every token costs 2× the off-peak price."
      : "OFF-PEAK — every token costs half the peak price.";

    // Clocks
    localClock.textContent = fmtClock(now, tz);
    localDate.textContent  = fmtDate(now, tz);
    utcClock.textContent   = fmtClock(now, "UTC");
    utcDate.textContent    = fmtDate(now, "UTC");

    // Next transition
    const next = nextTransitionUTC(now);
    if (next) {
      // If a holiday is toggled, the next *meaningful* change is
      // either midnight local (holiday ends) or the UTC transition.
      nextLabel.textContent = peak ? "Off-peak in" : "Peak in";
      countdown.textContent = fmtDuration(next.getTime() - now.getTime());
      nextAt.textContent    = `${fmtLocalDateTime(next, tz)} local · ${fmtClock(next, "UTC")} UTC`;
    } else {
      nextLabel.textContent = "Next change";
      countdown.textContent = "—";
      nextAt.textContent    = "—";
    }

    bannerCount.textContent =
      `${peak ? "off-peak" : "peak"} in ${countdown.textContent}`;
  }

  // ---- Main loop --------------------------------------------

  let lastRenderedDay = null;
  let lastHoliday = null;

  function tick() {
    const now = new Date();
    const tz = state.timeZone;

    // Re-render week if the local day changed or holiday toggled
    const todayKey = fmtDate(now, tz);
    if (todayKey !== lastRenderedDay || state.manualHoliday !== lastHoliday) {
      lastRenderedDay = todayKey;
      lastHoliday = state.manualHoliday;
      renderWeek(now);
    } else {
      // Cheap re-render of just the now marker: simplest is full redraw
      // only when the minute changes — but we only update the marker
      // by rebuilding the week occasionally. For smoothness, do it here.
      renderWeek(now);
    }

    updateStatus(now);
  }

  // ---- Events -----------------------------------------------

  tzSelect.addEventListener("change", () => {
    state.timeZone = tzSelect.value;
    let city = state.timeZone.split("/").pop().replace(/_/g, " ");
    tzHint.textContent = `Currently showing: ${city} · ${state.timeZone}`;
    lastRenderedDay = null; // force week rebuild
    tick();
  });

  holidayToggle.addEventListener("change", () => {
    state.manualHoliday = holidayToggle.checked;
    lastRenderedDay = null;
    tick();
  });

  // ---- Boot -------------------------------------------------

  buildZoneOptions();
  tick();
  setInterval(tick, 1000);
})();