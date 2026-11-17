/*
 * Seclusa Calc — pure calculator logic (no DOM, no storage, no network).
 *
 * Expression evaluation uses a tokenizer + shunting-yard + RPN evaluator.
 * Nothing here calls eval() or Function().
 */

(function (root) {
  "use strict";

  var PI = Math.PI;
  var E = Math.E;
  var PHI = (1 + Math.sqrt(5)) / 2;
  var MAX_ABS = 1e308;
  var MAX_FACT = 170;
  var DISPLAY_DIGITS = 12;
  var MAX_EXPR = 512;

  function isFiniteNumber(n) {
    return typeof n === "number" && isFinite(n);
  }

  function format(n) {
    if (!isFiniteNumber(n)) return "Error";
    if (Object.is(n, -0)) n = 0;
    if (Math.abs(n) !== 0 && (Math.abs(n) >= 1e12 || Math.abs(n) < 1e-9)) {
      return n.toExponential(DISPLAY_DIGITS - 1)
        .replace(/\.?0+e/, "e")
        .replace(/e\+/, "e");
    }
    var s = n.toPrecision(DISPLAY_DIGITS);
    if (s.indexOf("e") !== -1 || s.indexOf("E") !== -1) {
      return Number(s).toExponential(DISPLAY_DIGITS - 1)
        .replace(/\.?0+e/, "e")
        .replace(/e\+/, "e");
    }
    if (s.indexOf(".") !== -1) {
      s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "").replace(/\.$/, "");
    }
    return s === "-0" ? "0" : s;
  }

  function toRadians(value, angleMode) {
    if (angleMode === "rad") return value;
    if (angleMode === "grad") return (value * PI) / 200;
    return (value * PI) / 180;
  }

  function fromRadians(value, angleMode) {
    if (angleMode === "rad") return value;
    if (angleMode === "grad") return (value * 200) / PI;
    return (value * 180) / PI;
  }

  function factorial(n) {
    if (!isFiniteNumber(n) || n < 0 || Math.floor(n) !== n) return NaN;
    if (n > MAX_FACT) return Infinity;
    var out = 1;
    for (var i = 2; i <= n; i++) out *= i;
    return out;
  }

  function permutations(n, r) {
    if (!isFiniteNumber(n) || !isFiniteNumber(r)) return NaN;
    if (n < 0 || r < 0 || Math.floor(n) !== n || Math.floor(r) !== r || r > n) return NaN;
    var out = 1;
    for (var i = 0; i < r; i++) out *= n - i;
    return out;
  }

  function combinations(n, r) {
    if (!isFiniteNumber(n) || !isFiniteNumber(r)) return NaN;
    if (n < 0 || r < 0 || Math.floor(n) !== n || Math.floor(r) !== r || r > n) return NaN;
    r = Math.min(r, n - r);
    var out = 1;
    for (var i = 1; i <= r; i++) out = (out * (n - r + i)) / i;
    return Math.round(out);
  }

  function asinh(x) {
    return Math.asinh ? Math.asinh(x) : Math.log(x + Math.sqrt(x * x + 1));
  }
  function acosh(x) {
    return Math.acosh ? Math.acosh(x) : Math.log(x + Math.sqrt(x * x - 1));
  }
  function atanh(x) {
    return Math.atanh ? Math.atanh(x) : 0.5 * Math.log((1 + x) / (1 - x));
  }
  function log10(x) {
    return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10;
  }
  function log2(x) {
    return Math.log2 ? Math.log2(x) : Math.log(x) / Math.LN2;
  }
  function trunc(x) {
    return Math.trunc ? Math.trunc(x) : (x < 0 ? Math.ceil(x) : Math.floor(x));
  }
  function sign(x) {
    return Math.sign ? Math.sign(x) : (x > 0 ? 1 : x < 0 ? -1 : 0);
  }
  function hypot(a, b) {
    return Math.hypot ? Math.hypot(a, b) : Math.sqrt(a * a + b * b);
  }
  function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a;
  }
  function lcm(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    if (!a || !b) return 0;
    return Math.abs(a / gcd(a, b) * b);
  }

  var CONSTANTS = {
    pi: PI,
    "π": PI,
    e: E,
    phi: PHI,
    "φ": PHI,
    "ϕ": PHI
  };

  /*
   * Each function: { arity, angle?, fn(...args, mode?) }
   * angle:true means the last extra arg passed at eval time is angleMode.
   */
  var FUNCTIONS = {
    sin: { arity: 1, angle: true, fn: function (x, mode) { return Math.sin(toRadians(x, mode)); } },
    cos: { arity: 1, angle: true, fn: function (x, mode) { return Math.cos(toRadians(x, mode)); } },
    tan: { arity: 1, angle: true, fn: function (x, mode) { return Math.tan(toRadians(x, mode)); } },
    asin: { arity: 1, angle: true, fn: function (x, mode) { return fromRadians(Math.asin(x), mode); } },
    acos: { arity: 1, angle: true, fn: function (x, mode) { return fromRadians(Math.acos(x), mode); } },
    atan: { arity: 1, angle: true, fn: function (x, mode) { return fromRadians(Math.atan(x), mode); } },
    atan2: { arity: 2, angle: true, fn: function (y, x, mode) { return fromRadians(Math.atan2(y, x), mode); } },
    cot: { arity: 1, angle: true, fn: function (x, mode) { return 1 / Math.tan(toRadians(x, mode)); } },
    sec: { arity: 1, angle: true, fn: function (x, mode) { return 1 / Math.cos(toRadians(x, mode)); } },
    csc: { arity: 1, angle: true, fn: function (x, mode) { return 1 / Math.sin(toRadians(x, mode)); } },
    sinh: { arity: 1, fn: function (x) { return Math.sinh ? Math.sinh(x) : (Math.exp(x) - Math.exp(-x)) / 2; } },
    cosh: { arity: 1, fn: function (x) { return Math.cosh ? Math.cosh(x) : (Math.exp(x) + Math.exp(-x)) / 2; } },
    tanh: { arity: 1, fn: function (x) {
      if (Math.tanh) return Math.tanh(x);
      var e2 = Math.exp(2 * x);
      return (e2 - 1) / (e2 + 1);
    } },
    asinh: { arity: 1, fn: function (x) { return asinh(x); } },
    acosh: { arity: 1, fn: function (x) { return acosh(x); } },
    atanh: { arity: 1, fn: function (x) { return atanh(x); } },
    ln: { arity: 1, fn: function (x) { return Math.log(x); } },
    log: { arity: 1, fn: function (x) { return log10(x); } },
    log10: { arity: 1, fn: function (x) { return log10(x); } },
    log2: { arity: 1, fn: function (x) { return log2(x); } },
    logb: { arity: 2, fn: function (base, x) { return Math.log(x) / Math.log(base); } },
    exp: { arity: 1, fn: function (x) { return Math.exp(x); } },
    exp10: { arity: 1, fn: function (x) { return Math.pow(10, x); } },
    exp2: { arity: 1, fn: function (x) { return Math.pow(2, x); } },
    sqrt: { arity: 1, fn: function (x) { return Math.sqrt(x); } },
    cbrt: { arity: 1, fn: function (x) { return Math.cbrt ? Math.cbrt(x) : Math.pow(x, 1 / 3); } },
    root: { arity: 2, fn: function (n, x) { return Math.pow(x, 1 / n); } },
    abs: { arity: 1, fn: function (x) { return Math.abs(x); } },
    sign: { arity: 1, fn: function (x) { return sign(x); } },
    floor: { arity: 1, fn: function (x) { return Math.floor(x); } },
    ceil: { arity: 1, fn: function (x) { return Math.ceil(x); } },
    round: { arity: 1, fn: function (x) { return Math.round(x); } },
    trunc: { arity: 1, fn: function (x) { return trunc(x); } },
    frac: { arity: 1, fn: function (x) { return x - trunc(x); } },
    fact: { arity: 1, fn: function (x) { return factorial(x); } },
    npr: { arity: 2, fn: function (n, r) { return permutations(n, r); } },
    ncr: { arity: 2, fn: function (n, r) { return combinations(n, r); } },
    min: { arity: 2, fn: function (a, b) { return Math.min(a, b); } },
    max: { arity: 2, fn: function (a, b) { return Math.max(a, b); } },
    hypot: { arity: 2, fn: function (a, b) { return hypot(a, b); } },
    gcd: { arity: 2, fn: function (a, b) { return gcd(a, b); } },
    lcm: { arity: 2, fn: function (a, b) { return lcm(a, b); } },
    deg: { arity: 1, fn: function (x) { return (x * 180) / PI; } },
    rad: { arity: 1, fn: function (x) { return (x * PI) / 180; } },
    grad: { arity: 1, fn: function (x) { return (x * 200) / PI; } },
    rand: { arity: 0, fn: function () { return Math.random(); } }
  };

  var OPS = {
    "+": { prec: 1, assoc: "L", arity: 2, fn: function (a, b) { return a + b; } },
    "-": { prec: 1, assoc: "L", arity: 2, fn: function (a, b) { return a - b; } },
    "*": { prec: 2, assoc: "L", arity: 2, fn: function (a, b) { return a * b; } },
    "/": { prec: 2, assoc: "L", arity: 2, fn: function (a, b) { return a / b; } },
    "^": { prec: 3, assoc: "R", arity: 2, fn: function (a, b) { return Math.pow(a, b); } },
    "u-": { prec: 4, assoc: "R", arity: 1, fn: function (a) { return -a; } },
    "!": { prec: 5, assoc: "L", arity: 1, postfix: true, fn: function (a) { return factorial(a); } }
  };

  /* Casio-style %: rewrite into RPN. Not modulo.
   *   n%     → n/100
   *   a×b%   → a×b/100
   *   a÷b%   → a÷b×100
   *   a+b%   → a + a×b/100
   *   a−b%   → a − a×b/100
   */
  function pushPercentRewrite(stack, output) {
    if (!output.length) throw new Error("missing percent value");
    var pct = output.pop();
    var top = stack.length ? stack[stack.length - 1] : null;
    var binop = top && top.type === "op" ? top.value : null;

    if (binop === "*" || binop === "/") {
      stack.pop();
      if (!output.length) throw new Error("missing percent base");
      output.push(pct);
      if (binop === "*") {
        output.push({ type: "num", value: 100 });
        output.push({ type: "op", value: "/" });
        output.push({ type: "op", value: "*" });
      } else {
        output.push({ type: "op", value: "/" });
        output.push({ type: "num", value: 100 });
        output.push({ type: "op", value: "*" });
      }
      return;
    }

    if (binop === "+" || binop === "-") {
      stack.pop();
      if (!output.length) throw new Error("missing percent base");
      var leftRpn = output.slice();
      for (var i = 0; i < leftRpn.length; i++) output.push(leftRpn[i]);
      output.push(pct);
      output.push({ type: "num", value: 100 });
      output.push({ type: "op", value: "/" });
      output.push({ type: "op", value: "*" });
      output.push({ type: "op", value: binop });
      return;
    }

    output.push(pct);
    output.push({ type: "num", value: 100 });
    output.push({ type: "op", value: "/" });
  }

  function tokenize(input) {
    var s = String(input || "").replace(/\s+/g, "");
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var ch = s.charAt(i);

      if (/[0-9.]/.test(ch)) {
        var start = i;
        var seenDot = ch === ".";
        i++;
        while (i < s.length) {
          var c = s.charAt(i);
          if (c === ".") {
            if (seenDot) throw new Error("bad number");
            seenDot = true;
            i++;
            continue;
          }
          if (/[0-9]/.test(c)) {
            i++;
            continue;
          }
          break;
        }
        // Scientific notation: 1.5e-10 / 2E+3
        if (i < s.length && (s.charAt(i) === "e" || s.charAt(i) === "E")) {
          var ePos = i;
          i++;
          if (i < s.length && (s.charAt(i) === "+" || s.charAt(i) === "-")) i++;
          var expStart = i;
          while (i < s.length && /[0-9]/.test(s.charAt(i))) i++;
          if (i === expStart) i = ePos;
        }
        var num = s.slice(start, i);
        if (num === "." || num === "") throw new Error("bad number");
        var value = Number(num);
        if (!isFiniteNumber(value)) throw new Error("bad number");
        tokens.push({ type: "num", value: value });
        continue;
      }

      if (/[a-zπφϕ]/i.test(ch)) {
        var nameStart = i;
        i++;
        while (i < s.length && /[a-z0-9]/i.test(s.charAt(i))) i++;
        var name = s.slice(nameStart, i).toLowerCase();
        if (name === "π") name = "pi";
        if (name === "φ" || name === "ϕ") name = "phi";
        if (name === "x") {
          tokens.push({ type: "op", value: "*" });
          continue;
        }
        if (CONSTANTS[name] != null) {
          tokens.push({ type: "num", value: CONSTANTS[name] });
        } else if (FUNCTIONS[name]) {
          tokens.push({ type: "fn", value: name });
        } else if (name === "ans") {
          tokens.push({ type: "ans" });
        } else {
          throw new Error("unknown symbol");
        }
        continue;
      }

      if (ch === "(") { tokens.push({ type: "(" }); i++; continue; }
      if (ch === ")") { tokens.push({ type: ")" }); i++; continue; }
      if (ch === ",") { tokens.push({ type: "," }); i++; continue; }
      if (ch === "×" || ch === "*") { tokens.push({ type: "op", value: "*" }); i++; continue; }
      if (ch === "÷" || ch === "/") { tokens.push({ type: "op", value: "/" }); i++; continue; }
      if (ch === "+" || ch === "-" || ch === "%" || ch === "^" || ch === "!") {
        tokens.push({ type: "op", value: ch });
        i++;
        continue;
      }
      throw new Error("bad character");
    }
    return tokens;
  }

  function pushImplicitMul(stack, output) {
    while (stack.length) {
      var top = stack[stack.length - 1];
      if (top.type === "op" && OPS[top.value] &&
        (OPS[top.value].prec > OPS["*"].prec ||
          (OPS[top.value].prec === OPS["*"].prec && OPS["*"].assoc === "L"))) {
        output.push(stack.pop());
      } else break;
    }
    stack.push({ type: "op", value: "*" });
  }

  function needsImplicitMul(prev) {
    return !!(prev && (
      prev.type === "num" || prev.type === "ans" || prev.type === ")" ||
      (prev.type === "op" && OPS[prev.value] && OPS[prev.value].postfix)
    ));
  }

  function toRpn(tokens) {
    var output = [];
    var stack = [];
    var prev = null;

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];

      if (t.type === "num" || t.type === "ans") {
        if (needsImplicitMul(prev)) pushImplicitMul(stack, output);
        output.push(t);
        prev = t;
        continue;
      }

      if (t.type === "fn") {
        if (needsImplicitMul(prev)) pushImplicitMul(stack, output);
        stack.push({ type: "fn", value: t.value, arity: FUNCTIONS[t.value].arity });
        prev = t;
        continue;
      }

      if (t.type === ",") {
        while (stack.length && stack[stack.length - 1].type !== "(") {
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error("misplaced comma");
        stack[stack.length - 1].args = (stack[stack.length - 1].args || 1) + 1;
        prev = t;
        continue;
      }

      if (t.type === "op") {
        var op = t.value;
        if (op === "-" && (!prev || prev.type === "(" || prev.type === "," ||
          (prev.type === "op" && !(OPS[prev.value] && OPS[prev.value].postfix)))) {
          op = "u-";
        } else if (op === "+" && (!prev || prev.type === "(" || prev.type === "," ||
          (prev.type === "op" && !(OPS[prev.value] && OPS[prev.value].postfix)))) {
          prev = { type: "op", value: "+" };
          continue;
        }

        if (op === "!") {
          output.push({ type: "op", value: "!" });
          prev = { type: "op", value: "!" };
          continue;
        }

        if (op === "%") {
          pushPercentRewrite(stack, output);
          prev = { type: "num", value: 0 };
          continue;
        }

        var info = OPS[op];
        if (!info) throw new Error("unknown operator");
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.type !== "op") break;
          var topInfo = OPS[top.value];
          if (!topInfo) break;
          if (
            (info.assoc === "L" && info.prec <= topInfo.prec) ||
            (info.assoc === "R" && info.prec < topInfo.prec)
          ) {
            output.push(stack.pop());
          } else break;
        }
        stack.push({ type: "op", value: op });
        prev = { type: "op", value: op };
        continue;
      }

      if (t.type === "(") {
        if (needsImplicitMul(prev)) pushImplicitMul(stack, output);
        stack.push({ type: "(", args: 1 });
        prev = t;
        continue;
      }

      if (t.type === ")") {
        while (stack.length && stack[stack.length - 1].type !== "(") {
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error("mismatched parentheses");
        var open = stack.pop();
        var argCount = open.args || 1;
        // Empty call: rand()
        if (prev && prev.type === "(") argCount = 0;
        if (stack.length && stack[stack.length - 1].type === "fn") {
          var fnTok = stack.pop();
          var expected = FUNCTIONS[fnTok.value] ? FUNCTIONS[fnTok.value].arity : 1;
          if (argCount !== expected) throw new Error("wrong arity");
          output.push({ type: "fn", value: fnTok.value, arity: expected });
        }
        prev = t;
        continue;
      }

      throw new Error("bad token");
    }

    while (stack.length) {
      var left = stack.pop();
      if (left.type === "(" || left.type === ")") throw new Error("mismatched parentheses");
      output.push(left);
    }
    return output;
  }

  function evalRpn(rpn, angleMode, ans) {
    var stack = [];
    for (var i = 0; i < rpn.length; i++) {
      var t = rpn[i];
      if (t.type === "num") {
        stack.push(t.value);
        continue;
      }
      if (t.type === "ans") {
        if (!isFiniteNumber(ans)) throw new Error("no answer");
        stack.push(ans);
        continue;
      }
      if (t.type === "fn") {
        var spec = FUNCTIONS[t.value];
        if (!spec) throw new Error("unknown function");
        var arity = spec.arity;
        if (stack.length < arity) throw new Error("missing argument");
        var args = [];
        for (var a = 0; a < arity; a++) args.unshift(stack.pop());
        var out;
        if (spec.angle) {
          out = spec.fn.apply(null, args.concat([angleMode]));
        } else {
          out = spec.fn.apply(null, args);
        }
        if (!isFiniteNumber(out) || Math.abs(out) > MAX_ABS) throw new Error("domain");
        stack.push(out);
        continue;
      }
      if (t.type === "op") {
        var info = OPS[t.value];
        if (!info) throw new Error("unknown operator");
        if (info.arity === 1) {
          if (stack.length < 1) throw new Error("missing operand");
          var a1 = stack.pop();
          var r1 = info.fn(a1);
          if (!isFiniteNumber(r1) || Math.abs(r1) > MAX_ABS) throw new Error("domain");
          stack.push(r1);
        } else {
          if (stack.length < 2) throw new Error("missing operand");
          var b = stack.pop();
          var a0 = stack.pop();
          if (t.value === "/" && b === 0) throw new Error("divide by zero");
          var r2 = info.fn(a0, b);
          if (!isFiniteNumber(r2) || Math.abs(r2) > MAX_ABS) throw new Error("domain");
          stack.push(r2);
        }
        continue;
      }
      throw new Error("bad rpn");
    }
    if (stack.length !== 1) throw new Error("incomplete");
    return stack[0];
  }

  function normalizeAngleMode(mode) {
    if (mode === "rad" || mode === "grad") return mode;
    return "deg";
  }

  function evaluate(expression, options) {
    var opts = options || {};
    var angleMode = normalizeAngleMode(opts.angleMode);
    var ans = isFiniteNumber(opts.ans) ? opts.ans : null;
    var trimmed = String(expression || "").trim();
    if (!trimmed) return { ok: false, error: "empty", value: null, display: "" };
    try {
      var tokens = tokenize(trimmed);
      var rpn = toRpn(tokens);
      var value = evalRpn(rpn, angleMode, ans);
      return { ok: true, value: value, display: format(value), error: null };
    } catch (err) {
      return { ok: false, value: null, display: "Error", error: String(err && err.message ? err.message : err) };
    }
  }

  function clipExpr(s) {
    if (typeof s !== "string") return "";
    return s.length > MAX_EXPR ? s.slice(0, MAX_EXPR) : s;
  }

  function createSession(initial) {
    var init = initial || {};
    var expression = clipExpr(typeof init.expression === "string" ? init.expression : "");
    var display = typeof init.display === "string" ? init.display : "0";
    if (display.length > MAX_EXPR) display = display.slice(0, MAX_EXPR);
    return {
      expression: expression,
      display: display || "0",
      ans: isFiniteNumber(init.ans) ? init.ans : null,
      memory: isFiniteNumber(init.memory) ? init.memory : 0,
      angleMode: normalizeAngleMode(init.angleMode),
      second: !!init.second,
      justEvaluated: !!init.justEvaluated,
      error: !!init.error
    };
  }

  function normalizeSession(raw) {
    return createSession(raw && typeof raw === "object" ? raw : {});
  }

  var FN_KEYS = {
    sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, atan2: 1,
    cot: 1, sec: 1, csc: 1,
    sinh: 1, cosh: 1, tanh: 1, asinh: 1, acosh: 1, atanh: 1,
    ln: 1, log: 1, log2: 1, log10: 1, logb: 1,
    exp: 1, exp10: 1, exp2: 1,
    sqrt: 1, cbrt: 1, root: 1,
    abs: 1, sign: 1, floor: 1, ceil: 1, round: 1, trunc: 1, frac: 1,
    fact: 1, npr: 1, ncr: 1,
    min: 1, max: 1, hypot: 1, gcd: 1, lcm: 1,
    deg: 1, rad: 1, grad: 1, rand: 1
  };

  var SECOND_MAP = {
    sin: "asin", cos: "acos", tan: "atan",
    sinh: "asinh", cosh: "acosh", tanh: "atanh",
    ln: "exp", log: "exp10", log2: "exp2",
    sqrt: "cbrt", "x^y": "root", "x²": "x³",
    "π": "φ", e: "rand",
    "(": ",", ")": "abs",
    "!": "npr", ncr: "npr",
    floor: "round", ceil: "trunc",
    cot: "sec", csc: "atan2",
    "%": "frac", "1/x": "sign",
    "±": "EE", ans: "deg"
  };

  function applyKey(session, key) {
    var s = createSession(session);
    var k = String(key || "");

    function setExpr(expr) {
      s.expression = clipExpr(expr);
      s.display = s.expression || "0";
      s.justEvaluated = false;
      s.error = false;
    }

    if (k === "2nd" || k === "SECOND") {
      s.second = !s.second;
      return s;
    }

    // Resolve 2nd-function layer, then clear it (except for 2nd itself).
    if (s.second && SECOND_MAP[k]) {
      k = SECOND_MAP[k];
      s.second = false;
    } else if (s.second && k !== "DRG" && k !== "DEG" && k !== "RAD" && k !== "GRAD") {
      s.second = false;
    }

    if (k === "AC") {
      s.expression = "";
      s.display = "0";
      s.justEvaluated = false;
      s.error = false;
      s.second = false;
      return s;
    }

    if (k === "C") {
      if (s.justEvaluated || s.error) {
        s.expression = "";
        s.display = "0";
        s.justEvaluated = false;
        s.error = false;
      } else if (s.expression.length) {
        setExpr(s.expression.slice(0, -1));
      } else {
        s.display = "0";
      }
      return s;
    }

    if (k === "DEG" || k === "RAD" || k === "GRAD") {
      s.angleMode = normalizeAngleMode(k.toLowerCase());
      return s;
    }

    if (k === "DRG") {
      s.angleMode = s.angleMode === "deg" ? "rad" : s.angleMode === "rad" ? "grad" : "deg";
      return s;
    }

    if (k === "MC") {
      s.memory = 0;
      return s;
    }
    if (k === "MR") {
      var mem = format(s.memory);
      if (s.justEvaluated || s.error) setExpr(mem);
      else setExpr(s.expression + mem);
      return s;
    }
    if (k === "M+" || k === "M-") {
      var base = s.justEvaluated && isFiniteNumber(s.ans)
        ? s.ans
        : evaluate(s.expression || s.display, { angleMode: s.angleMode, ans: s.ans });
      var val = typeof base === "number" ? base : (base.ok ? base.value : null);
      if (isFiniteNumber(val)) {
        s.memory = k === "M+" ? s.memory + val : s.memory - val;
      }
      return s;
    }

    if (k === "=") {
      var source = String(s.expression || "").replace(/=\s*$/, "");
      var result = evaluate(source, { angleMode: s.angleMode, ans: s.ans });
      if (!result.ok) {
        s.display = "Error";
        s.error = true;
        s.justEvaluated = true;
        return s;
      }
      s.ans = result.value;
      s.display = result.display;
      /* Keep the sum on the LCD: "1+2=" beside the answer. */
      s.expression = clipExpr(source ? source + "=" : result.display + "=");
      s.justEvaluated = true;
      s.error = false;
      return s;
    }

    var continues = /^(?:\+|\-|×|\*|÷|\/|%|\^|!|\)|,)$/.test(k);
    var insert = k;
    if (k === "×") insert = "*";
    if (k === "÷") insert = "/";
    if (k === "π" || k === "pi") insert = "π";
    if (k === "φ" || k === "phi") insert = "φ";
    if (k === "EE" || k === "EXP") {
      var bare = s.expression.replace(/=\s*$/, "");
      var tail = bare.charAt(bare.length - 1);
      insert = /[0-9.]/.test(tail) ? "e" : "1e";
    }
    if (FN_KEYS[k]) {
      if (k === "rand") insert = "rand()";
      else insert = k + "(";
    }
    if (k === "x²") insert = "^2";
    if (k === "x³") insert = "^3";
    if (k === "x^y") insert = "^";
    if (k === "root") insert = "root(";
    if (k === "1/x") {
      if (s.justEvaluated && isFiniteNumber(s.ans)) setExpr("(1/(" + format(s.ans) + "))");
      else if (s.expression) setExpr("(1/(" + s.expression.replace(/=\s*$/, "") + "))");
      else setExpr("(1/(");
      return s;
    }
    if (k === "±") {
      if (!s.expression || s.justEvaluated) {
        if (s.justEvaluated && isFiniteNumber(s.ans)) {
          setExpr(format(-s.ans));
        } else if (s.expression.charAt(0) === "-") {
          setExpr(s.expression.slice(1));
        } else {
          setExpr("-" + (s.expression || "0"));
        }
      } else {
        setExpr("-(" + s.expression.replace(/=\s*$/, "") + ")");
      }
      return s;
    }
    if (k === "ans") insert = "ans";

    /* After =, an operator continues from Ans; a new digit starts fresh. */
    if (s.justEvaluated || s.error) {
      if (continues && isFiniteNumber(s.ans) && !s.error) {
        setExpr(format(s.ans) + insert);
        return s;
      }
      s.expression = "";
      s.error = false;
      s.justEvaluated = false;
    }

    setExpr(s.expression + insert);
    return s;
  }

  root.Calc = {
    PI: PI,
    E: E,
    PHI: PHI,
    format: format,
    evaluate: evaluate,
    factorial: factorial,
    permutations: permutations,
    combinations: combinations,
    createSession: createSession,
    normalizeSession: normalizeSession,
    applyKey: applyKey,
    SECOND_MAP: SECOND_MAP,
    FUNCTIONS: Object.keys(FUNCTIONS),
    CONSTANTS: Object.keys(CONSTANTS)
  };
})(typeof window !== "undefined" ? window : globalThis);
