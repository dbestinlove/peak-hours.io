# peak-hours.io

**DeepSeek Peak API Usage Times** — a tiny, dependency-free web app that shows whether the DeepSeek API is currently in *peak* (full-rate) or *off-peak* (50% off) hours, translated into your own time zone.

## What it does

- **Live peak / off-peak status**: a sticky banner and status card flip the entire page's theme (`<html data-state="peak|off-peak">`) depending on the current pricing state.
- **Fixed UTC peak windows**: peak hours are **01:00–04:00** and **06:00–10:00 UTC, Monday–Friday**. Everything else — including all weekends — is off-peak at exactly half price.
- **Time-zone aware**: auto-detects your local time zone (via `Intl`), with a curated dropdown of ~19 common zones. Peak windows are converted to your local clock so you can see when they hit where you live.
- **Live clocks & countdown**: local and UTC clocks tick every second, with a countdown to the next peak ⇄ off-peak transition.
- **Week at a glance**: a 7-day grid renders each UTC peak window as bars on your local 24-hour timeline, with hour ticks, a "now" marker, and weekend/holiday highlighting.
- **Chinese public holidays**: since the State Council calendar isn't computed here, a toggle lets you mark today as a CN holiday — DeepSeek waives peak pricing for the whole day.
- **Rates table**: USD per 1M tokens (shown as off-peak / peak) for `deepseek-flash` (DeepSeek-V4.1-Flash) and `deepseek-v4-pro` (DeepSeek-V4-Pro-0813), covering input cache hit/miss, output, and concurrency limits.

## Files

| File | Description |
| --- | --- |
| `index.html` | Page structure: state banner, hero, live status card, controls, week view, rates table, notes. |
| `app.js` | Self-contained IIFE: peak logic in UTC, DST-safe time-zone conversions (`Intl.DateTimeFormat`), week rendering, live updates. No build step, no dependencies. |
| `style.css` | Design system mirroring www.deepseek.com (`--ds-*` tokens): brand blue `#4d6bfe`, amber for peak; Host Grotesk / DM Sans / Fragment Mono typography. The whole page's state is driven by one root attribute. |

## How it works

All peak logic lives in `app.js`:

- `PEAK_WINDOWS = [[1, 4], [6, 10]]` — peak intervals in UTC hours.
- `isPeakUTC(date)` — weekends always off-peak; otherwise checks the minute-of-day against the windows.
- `nextTransitionUTC(date)` — scans forward in 1-minute steps (up to 7 days) for the next state change.
- `zonedTimeToUtc(...)` — iteratively converges on the correct zone offset, so DST transitions are handled when drawing the week grid.
- The holiday toggle short-circuits `effectivePeak()` to off-peak for the full day.

## Running it

No build or server required — just open `index.html` in any modern browser, or serve statically:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Notes

- Off-peak = exactly 50% of peak; peak costs 2×.
- Weekends (Sat/Sun, UTC) are always off-peak.
- Fees are deducted from the granted balance first, then the topped-up balance.
- Prices can change; DeepSeek reserves the right to adjust them.
