/*
 * Seclusa Calc — UI wiring.
 *
 * Math lives in calc.js. Preferences go through Store. Nothing here makes a
 * network request; connect-src 'none' would refuse one anyway.
 */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var openSheetId = null;
  var session = null;

  function toast(message) {
    var node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () { node.hidden = true; }, 2400);
  }

  function saveSession() {
    window.Store.setData({
      expression: session.expression,
      display: session.display,
      ans: session.ans,
      memory: session.memory,
      angleMode: session.angleMode,
      second: session.second,
      justEvaluated: session.justEvaluated,
      error: session.error
    });
  }

  function loadSession() {
    return window.Calc.normalizeSession(window.Store.getData());
  }

  /** Size LCD type so exactly two rows fit the current glass, any device. */
  function fitLcdType() {
    var line = $("readout-line");
    if (!line) return;
    var h = line.clientHeight;
    if (!(h > 0)) return;
    var row = Math.max(16, Math.floor(h / 2));
    line.style.setProperty("--lcd-row", row + "px");
  }

  function paint() {
    var expr = $("expr");
    var display = $("display");
    var angle = $("angle-mode");
    var mem = $("mem-indicator");
    var second = $("second-indicator");
    var shiftBtn = document.querySelector('[data-key="2nd"]');
    if (expr) {
      var showExpr = !!session.justEvaluated && !session.error && !!session.expression;
      expr.hidden = !showExpr;
      /* Flush against the answer — colour, not a gap, separates the two. */
      expr.textContent = showExpr ? session.expression : "";
    }
    if (display) {
      display.textContent = session.display || "0";
      display.classList.toggle("is-error", !!session.error);
    }
    fitLcdType();
    var line = $("readout-line");
    if (line && line.scrollHeight > line.clientHeight + 1) {
      line.scrollTop = line.scrollHeight;
    } else if (line) {
      line.scrollTop = 0;
    }
    if (angle) {
      var modeLabel = session.angleMode === "rad" ? "RAD"
        : session.angleMode === "grad" ? "GRAD" : "DEG";
      angle.textContent = modeLabel;
      angle.setAttribute("aria-pressed", String(session.angleMode !== "deg"));
    }
    if (mem) {
      var hasMem = session.memory !== 0;
      mem.hidden = !hasMem;
      mem.textContent = hasMem ? "M" : "";
    }
    if (second) {
      second.hidden = !session.second;
      second.classList.toggle("is-second", !!session.second);
    }
    if (shiftBtn) shiftBtn.setAttribute("aria-pressed", String(!!session.second));
    document.body.classList.toggle("is-second", !!session.second);
  }

  function press(key) {
    session = window.Calc.applyKey(session, key);
    saveSession();
    paint();
  }

  function syncThemeChrome() {
    if (window.Theme && window.Theme.paintModeChrome) window.Theme.paintModeChrome();
    if (window.Theme && window.Theme.paintBackground) window.Theme.paintBackground();
  }

  function showSheet(id) {
    var sheet = $(id);
    var scrim = $("scrim");
    if (!sheet) return;
    if (openSheetId && openSheetId !== id) closeSheet();
    openSheetId = id;
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    sheet.removeAttribute("inert");
    if (scrim) scrim.classList.add("open");
    var btn = $("btn-theme");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  function closeSheet() {
    if (!openSheetId) return;
    var sheet = $(openSheetId);
    var scrim = $("scrim");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
      sheet.setAttribute("inert", "");
    }
    if (scrim) scrim.classList.remove("open");
    var btn = $("btn-theme");
    if (btn) btn.setAttribute("aria-expanded", "false");
    openSheetId = null;
  }

  function wireTheme() {
    window.Theme.apply(window.Theme.current());
    syncThemeChrome();

    var button = $("btn-theme");
    if (button) {
      button.addEventListener("click", function () {
        if (openSheetId === "sheet-theme") closeSheet();
        else showSheet("sheet-theme");
      });
    }

    var scrim = $("scrim");
    if (scrim) scrim.addEventListener("click", closeSheet);

    document.querySelectorAll("[data-theme-opt]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var mode = chip.getAttribute("data-theme-opt");
        if (mode !== "system" && mode !== "light" && mode !== "dark") return;
        window.Theme.set(mode);
        syncThemeChrome();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSheet();
        return;
      }
      if (event.key !== "Tab" || !openSheetId) return;
      var sheet = $(openSheetId);
      if (!sheet) return;
      var nodes = sheet.querySelectorAll("button, input, select, textarea, a[href]");
      var list = [];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].disabled) continue;
        list.push(nodes[i]);
      }
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      var active = document.activeElement;
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function wireKeys() {
    var pad = $("keypad");
    if (!pad) return;
    pad.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-key]");
      if (!btn || !pad.contains(btn)) return;
      press(btn.getAttribute("data-key"));
    });

    document.addEventListener("keydown", function (event) {
      if (openSheetId) return;
      var target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      var key = event.key;
      var map = {
        "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
        "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
        ".": ".", "+": "+", "-": "-", "*": "×", "/": "÷",
        "%": "%", "^": "x^y", "(": "(", ")": ")", "!": "!",
        Enter: "=", "=": "=", Backspace: "C", Escape: "AC",
        p: "π", e: "e"
      };
      if (event.shiftKey && key === "Enter") {
        /* keep = */
      }
      if (key === "Delete") {
        event.preventDefault();
        press("AC");
        return;
      }
      var mapped = map[key];
      if (!mapped) return;
      if (key === "e" && (event.ctrlKey || event.metaKey || event.altKey)) return;
      if (key === "p" && (event.ctrlKey || event.metaKey || event.altKey)) return;
      event.preventDefault();
      press(mapped);
    });
  }

  function boot() {
    session = loadSession();
    wireTheme();
    wireKeys();
    paint();
    window.addEventListener("resize", function () {
      fitLcdType();
    });

    var verMeta = document.querySelector('meta[name="version"]');
    var verSlot = $("app-version");
    if (verMeta && verSlot) {
      var ver = verMeta.getAttribute("content");
      if (ver) verSlot.textContent = "v" + ver;
    }

    var angleBtn = $("angle-mode");
    if (angleBtn) {
      angleBtn.addEventListener("click", function () {
        press("DRG");
      });
    }

    var copyBtn = $("btn-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = session && session.error
          ? ""
          : (session && session.display ? String(session.display) : "");
        if (!text || text === "Error") {
          toast("Nothing to copy");
          return;
        }
        var done = function () { toast("Copied answer"); };
        var fail = function () { toast("Copy failed"); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(fail);
          return;
        }
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (ok) done();
          else fail();
        } catch (err) {
          fail();
        }
      });
    }

    var clearBtn = $("btn-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        window.Store.clearAll();
        session = window.Calc.createSession();
        window.Theme.set("dark");
        syncThemeChrome();
        paint();
        closeSheet();
        toast("Cleared data on this device");
      });
    }

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(function () {
        try {
          console.warn("Seclusa Calc: service worker registration failed");
        } catch (e) { /* ignore */ }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
