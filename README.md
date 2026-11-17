# Seclusa Calc

A private scientific calculator. Runs entirely on this device: expressions are
evaluated in the browser, last answer / memory / angle mode are stored locally,
and nothing you type is sent anywhere. Works offline once it has loaded.

## What it does

- Version 0.1.36
- Arithmetic, parentheses, powers, roots, factorial, absolute value, sign, frac
- `%` is Casio-style percent (`50%` → 0.5; `200×15%` → 30; `200+10%` → 220), not modulo
- Trigonometry (sin / cos / tan / cot / sec / csc and inverses) with DEG / RAD / GRAD
- Hyperbolic: sinh / cosh / tanh and inverses
- ln, log₁₀, log₂, logᵇ, eˣ, 10ˣ, 2ˣ, ʸ√x, EE scientific notation
- Combinatorics: n!, nPr, nCr; also gcd, lcm, min, max, hypot, floor / ceil / round / trunc
- Constants π, e, φ; rand; Ans; memory (MC / MR / M+ / M−)
- **2nd** key for secondary functions on the same pad
- Theme sheet: System / Light / Dark (orange ruled lines by default)
- Copy answer from the LCD (stays on this device)
- Clear saved data from the theme sheet

## Usage

Open `index.html` (or serve the folder), tap keys or use the keyboard. To add
it to your home screen, open your browser's menu and choose "Add to Home Screen".

```bash
# from this folder
python3 -m http.server 8765 --bind 127.0.0.1
# then open http://127.0.0.1:8765/
```

### Keyboard

| Keys | Action |
|---|---|
| `0`–`9` `.` | Digits |
| `+` `-` `*` `/` `%` `^` | Operators (`*` → ×, `/` → ÷, `^` → xʸ) |
| `(` `)` `!` | Grouping / factorial |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last (`C`) |
| `Delete` or `Escape` | All clear (`AC`) |
| `p` | π |
| `e` | e (ignored with Ctrl/Cmd/Alt) |

## Privacy

- No accounts, tracking, analytics, ads, or third-party scripts.
- `connect-src 'none'` in the content security policy: the page cannot make
  network calls. The service worker only downloads this app's own files so it
  can run offline.
- Data stays in local storage on this device. Clear it from the theme sheet.
- `_headers` / `.htaccess` harden hosts that honour them (frame deny, etc.).
  GitHub Pages ignores those files; the page meta CSP still applies.

## License

GPL-3.0. See [LICENSE](LICENSE).
