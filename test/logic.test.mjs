/* Tests for Seclusa Calc pure logic.
   Run with `node --test test/` or `bash test.sh`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "static", "js");

function load(file, extra = {}) {
  const source = readFileSync(join(jsDir, file), "utf8");
  const win = { ...extra };
  new Function("window", source)(win);
  return win;
}

/* ------------------------------------------------------------------ theme */

const { Theme } = load("theme.js", {
  Store: { getTheme: () => "system", setTheme: () => {} },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
  document: {
    documentElement: { getAttribute: () => null, setAttribute() {}, removeAttribute() {} },
    querySelectorAll: () => [],
    getElementById: () => null,
    adoptedStyleSheets: [],
  },
});

test("an explicit mode resolves to itself", () => {
  assert.equal(Theme.resolve("light"), "light");
  assert.equal(Theme.resolve("dark"), "dark");
});

test("system mode follows the operating system", () => {
  assert.equal(Theme.resolve("system"), "dark");
});

test("unspecified theme preference defaults to dark", () => {
  const { Store } = load("store.js", { localStorage: null });
  assert.equal(Store.getTheme(), "dark");
});

function runThemeBoot({ storage = {}, prefersDark = false } = {}) {
  const attrs = Object.create(null);
  const ls = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; },
  };
  const document = {
    documentElement: {
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      removeAttribute(k) { delete attrs[k]; },
    },
    adoptedStyleSheets: [],
  };
  const window = {
    matchMedia: () => ({ matches: !!prefersDark }),
    CSSStyleSheet: class { insertRule() {} },
  };
  const source = readFileSync(join(jsDir, "theme-boot.js"), "utf8");
  new Function("localStorage", "document", "window", source)(ls, document, window);
  return attrs;
}

test("theme-boot defaults to dark with no saved preference", () => {
  const attrs = runThemeBoot();
  assert.equal(attrs["data-theme"], "dark");
});

test("theme-boot system mode follows the operating system", () => {
  const light = runThemeBoot({
    storage: { "seclusa.calc.settings": JSON.stringify({ theme: "system" }) },
    prefersDark: false,
  });
  assert.equal(light["data-theme"], "light");
  const dark = runThemeBoot({
    storage: { "seclusa.calc.settings": JSON.stringify({ theme: "system" }) },
    prefersDark: true,
  });
  assert.equal(dark["data-theme"], "dark");
});

test("theme-boot honors an explicit light night-mode key", () => {
  const attrs = runThemeBoot({
    storage: { "ssc.pref_key_night_mode": "light" },
    prefersDark: true,
  });
  assert.equal(attrs["data-theme"], "light");
});

/* ------------------------------------------------------------------ store */

test("the store reads back what it wrote", () => {
  const { Store } = load("store.js", { localStorage: null });
  Store.setData({ hello: "world" });
  assert.deepEqual(Store.getData(), { hello: "world" });
});

test("corrupt data is dropped rather than thrown", () => {
  const storage = {
    _v: {},
    getItem(k) { return k in this._v ? this._v[k] : null; },
    setItem(k, v) { this._v[k] = String(v); },
    removeItem(k) { delete this._v[k]; },
  };
  const { Store } = load("store.js", { localStorage: storage });
  storage.setItem("seclusa.calc.data", "{not json");
  assert.deepEqual(Store.getData(), {});
});

test("clearing removes the app's own keys and nothing else", () => {
  const storage = {
    _v: { "seclusa.calc.data": "{}", "somebody.elses.key": "keep me" },
    getItem(k) { return k in this._v ? this._v[k] : null; },
    setItem(k, v) { this._v[k] = String(v); },
    removeItem(k) { delete this._v[k]; },
  };
  const { Store } = load("store.js", { localStorage: storage });
  Store.clearAll();
  assert.equal(storage.getItem("seclusa.calc.data"), null);
  assert.equal(storage.getItem("somebody.elses.key"), "keep me");
});

/* ------------------------------------------------------------------- calc */

const { Calc } = load("calc.js");

test("basic arithmetic", () => {
  assert.equal(Calc.evaluate("1+2*3").value, 7);
  assert.equal(Calc.evaluate("(1+2)*3").value, 9);
  assert.equal(Calc.evaluate("10/4").value, 2.5);
  assert.equal(Calc.evaluate("2^10").value, 1024);
});

test("unary minus and factorial", () => {
  assert.equal(Calc.evaluate("-3+5").value, 2);
  assert.equal(Calc.evaluate("5!").value, 120);
  assert.equal(Calc.evaluate("(3+2)!").value, 120);
});

test("constants and implicit multiplication", () => {
  const pi = Calc.evaluate("π").value;
  assert.ok(Math.abs(pi - Math.PI) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("2π").value - 2 * Math.PI) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("2(3+4)").value - 14) < 1e-12);
});

test("trig respects angle mode", () => {
  const sin90deg = Calc.evaluate("sin(90)", { angleMode: "deg" });
  assert.ok(sin90deg.ok);
  assert.ok(Math.abs(sin90deg.value - 1) < 1e-12);

  const sinPiRad = Calc.evaluate("sin(π)", { angleMode: "rad" });
  assert.ok(sinPiRad.ok);
  assert.ok(Math.abs(sinPiRad.value) < 1e-12);

  const sin100grad = Calc.evaluate("sin(100)", { angleMode: "grad" });
  assert.ok(sin100grad.ok);
  assert.ok(Math.abs(sin100grad.value - 1) < 1e-12);
});

test("reciprocal trig and hyperbolic", () => {
  assert.ok(Math.abs(Calc.evaluate("cot(45)", { angleMode: "deg" }).value - 1) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("sec(0)", { angleMode: "deg" }).value - 1) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("csc(90)", { angleMode: "deg" }).value - 1) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("sinh(0)").value) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("cosh(0)").value - 1) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("asinh(0)").value) < 1e-12);
});

test("logs roots powers and sci notation", () => {
  assert.ok(Math.abs(Calc.evaluate("log(100)").value - 2) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("ln(e)").value - 1) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("log2(8)").value - 3) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("logb(2,8)").value - 3) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("sqrt(9)").value - 3) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("cbrt(8)").value - 2) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("root(3,8)").value - 2) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("exp10(2)").value - 100) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("exp2(10)").value - 1024) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("1.5e2").value - 150) < 1e-12);
});

test("combinatorics rounding and helpers", () => {
  assert.equal(Calc.evaluate("npr(5,2)").value, 20);
  assert.equal(Calc.evaluate("ncr(5,2)").value, 10);
  assert.equal(Calc.evaluate("floor(3.9)").value, 3);
  assert.equal(Calc.evaluate("ceil(3.1)").value, 4);
  assert.equal(Calc.evaluate("round(3.5)").value, 4);
  assert.equal(Calc.evaluate("trunc(-3.9)").value, -3);
  assert.ok(Math.abs(Calc.evaluate("frac(3.25)").value - 0.25) < 1e-12);
  assert.equal(Calc.evaluate("sign(-4)").value, -1);
  assert.equal(Calc.evaluate("gcd(24,18)").value, 6);
  assert.equal(Calc.evaluate("lcm(4,6)").value, 12);
  assert.equal(Calc.evaluate("min(3,9)").value, 3);
  assert.equal(Calc.evaluate("max(3,9)").value, 9);
  assert.ok(Math.abs(Calc.evaluate("hypot(3,4)").value - 5) < 1e-12);
});

test("constants and rand", () => {
  assert.ok(Math.abs(Calc.evaluate("φ").value - Calc.PHI) < 1e-12);
  const r = Calc.evaluate("rand()");
  assert.ok(r.ok);
  assert.ok(r.value >= 0 && r.value < 1);
});

test("divide by zero and empty are errors", () => {
  assert.equal(Calc.evaluate("1/0").ok, false);
  assert.equal(Calc.evaluate("").ok, false);
  assert.equal(Calc.evaluate("sin(").ok, false);
  assert.equal(Calc.evaluate("ncr(5)").ok, false);
});

test("ans is substituted", () => {
  const r = Calc.evaluate("ans*2", { ans: 21 });
  assert.equal(r.ok, true);
  assert.equal(r.value, 42);
});

test("session key presses build and evaluate", () => {
  let s = Calc.createSession();
  s = Calc.applyKey(s, "1");
  s = Calc.applyKey(s, "+");
  s = Calc.applyKey(s, "2");
  s = Calc.applyKey(s, "=");
  assert.equal(s.ans, 3);
  assert.equal(s.display, "3");
  assert.equal(s.expression, "1+2=");
  s = Calc.applyKey(s, "+");
  assert.equal(s.expression, "3+");
  s = Calc.applyKey(s, "4");
  s = Calc.applyKey(s, "=");
  assert.equal(s.ans, 7);
  assert.equal(s.expression, "3+4=");
});

test("2nd layer remaps keys and DRG cycles three modes", () => {
  let s = Calc.createSession();
  s = Calc.applyKey(s, "2nd");
  assert.equal(s.second, true);
  s = Calc.applyKey(s, "sin");
  assert.equal(s.second, false);
  assert.equal(s.expression, "asin(");

  s = Calc.createSession();
  s = Calc.applyKey(s, "DRG");
  assert.equal(s.angleMode, "rad");
  s = Calc.applyKey(s, "DRG");
  assert.equal(s.angleMode, "grad");
  s = Calc.applyKey(s, "DRG");
  assert.equal(s.angleMode, "deg");
});

test("memory keys update memory", () => {
  let s = Calc.createSession();
  s = Calc.applyKey(s, "5");
  s = Calc.applyKey(s, "=");
  s = Calc.applyKey(s, "M+");
  assert.equal(s.memory, 5);
  s = Calc.applyKey(s, "MR");
  assert.equal(s.expression, "5");
  s = Calc.applyKey(s, "MC");
  assert.equal(s.memory, 0);
});

test("format avoids noisy trailing zeros", () => {
  assert.equal(Calc.format(2), "2");
  assert.equal(Calc.format(2.5), "2.5");
});

test("expression length is capped from storage and input", () => {
  const huge = "1+".repeat(400);
  const s = Calc.normalizeSession({ expression: huge, display: huge });
  assert.ok(s.expression.length <= 512);
  let t = Calc.createSession();
  for (let i = 0; i < 600; i++) t = Calc.applyKey(t, "1");
  assert.ok(t.expression.length <= 512);
});

test("error flag survives session restore", () => {
  const s = Calc.normalizeSession({ expression: "1/0", display: "Error", error: true });
  assert.equal(s.error, true);
});

test("percent is Casio-style not modulo", () => {
  assert.ok(Math.abs(Calc.evaluate("50%").value - 0.5) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("200*15%").value - 30) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("200×15%").value - 30) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("200+10%").value - 220) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("200-10%").value - 180) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("50/200%").value - 25) < 1e-12);
  assert.ok(Math.abs(Calc.evaluate("2*3+10%").value - 6.6) < 1e-12);
});

test("multiply and divide keys keep ×÷ on the expression", () => {
  let s = Calc.createSession();
  s = Calc.applyKey(s, "4");
  s = Calc.applyKey(s, "×");
  s = Calc.applyKey(s, "5");
  s = Calc.applyKey(s, "=");
  assert.equal(s.ans, 20);
  assert.equal(s.expression, "4×5=");
  s = Calc.applyKey(s, "÷");
  s = Calc.applyKey(s, "2");
  s = Calc.applyKey(s, "=");
  assert.equal(s.ans, 10);
  assert.equal(s.expression, "20÷2=");
});
