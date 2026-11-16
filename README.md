# Seclusa Calc

A private scientific calculator. Runs entirely on this device: expressions are
evaluated in the browser, last answer / memory / angle mode are stored locally,
and nothing you type is sent anywhere. Works offline once it has loaded.

## What it does

- Version 0.1.20
- Arithmetic, parentheses, powers, roots, factorial, absolute value, sign, frac
- `%` is Casio-style percent (`50%` → 0.5; `200×15%` → 30; `200+10%` → 220), not modulo
- Trigonometry (sin / cos / tan / cot / sec / csc and inverses) with DEG / RAD / GRAD
- Hyperbolic: sinh / cosh / tanh and inverses
- ln, log₁₀, log₂, logᵇ, eˣ, 10ˣ, 2ˣ, ʸ√x, EE scientific notation
- Combinatorics: n!, nPr, nCr; also gcd, lcm, min, max, hypot, floor / ceil / round / trunc
- Constants π, e, φ; rand; Ans; memory (MC / MR / M+ / M−)
- **2nd** key for secondary functions on the same pad
- Theme sheet: System / Light / Dark (orange ruled lines by default)
- Clear saved data from the theme sheet

## Usage

Open `index.html` (or serve the folder), tap keys or use the keyboard. To add
it to your home screen, open your browser's menu and choose "Add to Home Screen".

```bash
# from this folder
python3 -m http.server 8765 --bind 127.0.0.1
# then open http://127.0.0.1:8765/
```

## Privacy

- No accounts, tracking, analytics, ads, or third-party scripts.
- `connect-src 'none'` in the content security policy: the page cannot make
  network calls. The service worker only downloads this app's own files so it
  can run offline.
- Data stays in local storage on this device. Clear it from the theme sheet.

## Host headers

`_headers` and `.htaccess` are for hosts that can set response headers
(Cloudflare Pages, Netlify, Apache). They send the clickjacking and
content-type headers a page cannot set on its own. GitHub Pages ignores both
files. The header `connect-src` is `'self'` so the service worker can refresh
its own files; the page policy stays `'none'`, and the stricter one wins.

## Files

- `index.html` — the app shell
- `manifest.json` — PWA manifest
- `sw.js` — service worker (offline-first)
- `_headers`, `.htaccess` — optional host headers (not used by GitHub Pages)
- `static/` — styles, scripts, icons
- `test/logic.test.mjs` — node --test tests for the pure logic

## Running the tests

```
bash test.sh
# or
node --test test/
```

## License

GPL-3.0. See [LICENSE](LICENSE).
