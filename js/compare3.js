// Inspired by "Image Compare Pixaroma" from https://github.com/pixaroma/ComfyUI-Pixaroma (MIT).
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const STATE_KEY = "compare3State";
const ACCENT = "#e0702d";
const WIPES = [[1, 2], [1, 3], [2, 3]];

function viewUrl(d) {
  return api.apiURL(
    `/view?filename=${encodeURIComponent(d.filename)}&type=${encodeURIComponent(d.type)}` +
    `&subfolder=${encodeURIComponent(d.subfolder || "")}&t=${Date.now()}`
  );
}

function makeBtn(label) {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    "flex:1;min-width:0;padding:3px 2px;font:11px 'Segoe UI',sans-serif;cursor:pointer;" +
    "background:#2a2c2e;color:#999;border:1px solid #444;border-radius:3px;white-space:nowrap;";
  return b;
}

function setActive(btn, on) {
  btn.style.background = on ? ACCENT : "#2a2c2e";
  btn.style.borderColor = on ? ACCENT : "#444";
  btn.style.color = on ? "#fff" : "#999";
}

function flash(btn, text) {
  const old = btn.dataset.label;
  btn.textContent = text;
  btn.style.background = "#3ec371";
  btn.style.borderColor = "#3ec371";
  btn.style.color = "#fff";
  setTimeout(() => {
    btn.textContent = old;
    setActive(btn, false);
  }, 900);
}

function toast(msg) {
  const t = app.extensionManager?.toast;
  if (t?.add) t.add({ severity: "warn", summary: "MiCompare 3 images", detail: msg, life: 2500 });
  else console.warn("[Compare3]", msg);
}

function buildUI(node) {
  const root = document.createElement("div");
  root.style.cssText =
    "display:flex;flex-direction:column;gap:4px;width:100%;height:100%;box-sizing:border-box;" +
    // Never let the content push the node's column wider than the node itself.
    "min-width:0;overflow:hidden;contain:inline-size;";

  const row1 = document.createElement("div");
  const row2 = document.createElement("div");
  row1.style.cssText = row2.style.cssText = "display:flex;gap:3px;";

  const showBtns = [1, 2, 3].map((n) => {
    const b = makeBtn(`Show ${n}`);
    b.dataset.label = `Show ${n}`;
    b.onclick = () => { node._c3Show = n; refresh(node); saveState(node); };
    row1.appendChild(b);
    return b;
  });
  const rowD = document.createElement("div");
  rowD.style.cssText = "display:flex;gap:3px;";
  const wipeBtns = WIPES.map(([a, b]) => {
    const btn = makeBtn(`Wipe ${a}-${b}`);
    btn.dataset.label = `Wipe ${a}-${b}`;
    btn.onclick = () => { node._c3Show = `w${a}${b}`; refresh(node); saveState(node); };
    rowD.appendChild(btn);
    return btn;
  });
  const saveBtns = [1, 2, 3].map((n) => {
    const b = makeBtn(`Save ${n}`);
    b.dataset.label = `Save ${n}`;
    b.onclick = () => saveToOutput(node, n, b);
    row2.appendChild(b);
    return b;
  });

  const info = document.createElement("div");
  info.style.cssText = "display:flex;gap:3px;";
  const dims = [1, 2, 3].map(() => {
    const d = document.createElement("div");
    d.style.cssText =
      "flex:1;min-width:0;text-align:center;font:11px 'Segoe UI',sans-serif;color:#aaa;min-height:14px;";
    info.appendChild(d);
    return d;
  });

  const view = document.createElement("div");
  view.style.cssText =
    "flex:1 1 0;min-height:0;position:relative;background:#111;overflow:hidden;";
  const img = document.createElement("img");
  img.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;";
  const note = document.createElement("div");
  note.textContent = "Connect images & run to compare";
  note.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "color:#777;font:12px 'Segoe UI',sans-serif;";
  const imgB = document.createElement("img");
  imgB.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;";
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:" + ACCENT +
    ";display:none;pointer-events:none;box-shadow:0 0 4px rgba(0,0,0,.7);";
  const tagL = document.createElement("div");
  const tagR = document.createElement("div");
  const tagCss =
    "position:absolute;top:6px;padding:1px 7px;border-radius:9px;background:" + ACCENT +
    ";color:#fff;font:11px 'Segoe UI',sans-serif;display:none;pointer-events:none;";
  tagL.style.cssText = tagCss + "left:6px;";
  tagR.style.cssText = tagCss + "right:6px;";
  view.append(img, imgB, bar, tagL, tagR, note);
  view.style.cursor = "ew-resize";
  view.onmousemove = (e) => {
    if (typeof node._c3Show !== "string") return;
    const r = view.getBoundingClientRect();
    node._c3Pos = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    updateWipe(node);
  };

  root.append(row1, rowD, row2, info, view);
  node._c3 = { root, showBtns, wipeBtns, saveBtns, dims, img, imgB, bar, tagL, tagR, note, view };
  return root;
}

// Position the bar and clip image B (shown to the right of the bar).
// `node._c3Pos` is a fraction of the displayed image width.
function updateWipe(node) {
  const ui = node._c3;
  const show = node._c3Show;
  if (!ui || typeof show !== "string") return;
  const imgs = node._c3Imgs || [];
  const ma = imgs[Number(show[1]) - 1];
  const W = ui.view.clientWidth, H = ui.view.clientHeight;
  if (!ma?.w || !W || !H) return;
  const dw = ma.w * Math.min(W / ma.w, H / ma.h);
  const ox = (W - dw) / 2;
  const x = ox + (node._c3Pos ?? 0.5) * dw;
  ui.bar.style.left = `${x}px`;
  ui.imgB.style.clipPath = `inset(0 0 0 ${x}px)`;
}

function refresh(node) {
  const ui = node._c3;
  if (!ui) return;
  const imgs = node._c3Imgs || [null, null, null];
  const show = node._c3Show || 1;
  const isWipe = typeof show === "string";
  [0, 1, 2].forEach((i) => {
    setActive(ui.showBtns[i], show === i + 1);
    ui.showBtns[i].style.opacity = imgs[i] ? "1" : "0.5";
    ui.saveBtns[i].style.opacity = imgs[i] ? "1" : "0.5";
  });
  WIPES.forEach(([a, b], i) => {
    setActive(ui.wipeBtns[i], show === `w${a}${b}`);
    ui.wipeBtns[i].style.opacity = imgs[a - 1] && imgs[b - 1] ? "1" : "0.5";
  });
  ui.img.style.display = "none";
  ui.imgB.style.display = "none";
  ui.bar.style.display = "none";
  ui.tagL.style.display = "none";
  ui.tagR.style.display = "none";
  ui.note.style.display = "none";
  ui.view.style.cursor = isWipe ? "ew-resize" : "default";

  if (isWipe) {
    const a = Number(show[1]), b = Number(show[2]);
    const ma = imgs[a - 1], mb = imgs[b - 1];
    if (!ma || !mb) {
      ui.note.style.display = "flex";
      ui.note.textContent = `Wipe ${a}-${b} needs images ${a} and ${b}`;
    } else {
      ui.img.src = ma.url;
      ui.imgB.src = mb.url;
      ui.img.style.display = "block";
      ui.imgB.style.display = "block";
      ui.bar.style.display = "block";
      ui.tagL.textContent = String(a);
      ui.tagR.textContent = String(b);
      ui.tagL.style.display = "block";
      ui.tagR.style.display = "block";
      updateWipe(node);
    }
  } else {
    const cur = imgs[show - 1];
    if (cur) {
      ui.img.src = cur.url;
      ui.img.style.display = "block";
    } else {
      ui.note.style.display = "flex";
      ui.note.textContent = imgs.some(Boolean)
        ? `Image ${show} not connected`
        : "Connect images & run to compare";
    }
  }
  [0, 1, 2].forEach((i) => {
    const m = imgs[i];
    ui.dims[i].textContent = m && m.w ? `${m.w}×${m.h}` : "";
  });
}

function saveState(node) {
  node.properties = node.properties || {};
  node.properties[STATE_KEY] = {
    show: node._c3Show || 1,
    images: (node._c3Imgs || []).map((m) =>
      m ? { filename: m.filename, subfolder: m.subfolder, type: m.type } : null),
  };
}

function setImages(node, metas) {
  const imgs = [null, null, null];
  for (const m of metas) {
    const idx = (m.slot || 1) - 1;
    if (idx >= 0 && idx < 3) {
      const entry = { ...m, url: viewUrl(m) };
      imgs[idx] = entry;
      // Preload to learn the resolution, then redraw the labels.
      const probe = new Image();
      probe.onload = () => {
        entry.w = probe.naturalWidth;
        entry.h = probe.naturalHeight;
        if (node._c3Imgs?.[idx] === entry) refresh(node);
      };
      probe.src = entry.url;
    }
  }
  node._c3Imgs = imgs;
  if (typeof node._c3Show !== "string" && !imgs[(node._c3Show || 1) - 1]) {
    const first = imgs.findIndex(Boolean);
    if (first >= 0) node._c3Show = first + 1;
  }
  refresh(node);
  saveState(node);
}

async function saveToOutput(node, n, btn) {
  const m = node._c3Imgs?.[n - 1];
  if (!m) { toast(`Image ${n} is not available - run the workflow first`); return; }
  try {
    const resp = await api.fetchApi("/compare3/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: m.filename, subfolder: m.subfolder, type: m.type, slot: n }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { toast(`Save failed: ${data.error || resp.status}`); return; }
    flash(btn, "Saved");
  } catch (e) {
    console.warn("[Compare3] save failed", e);
    toast("Could not save to output");
  }
}

// The DOM widget keeps the width it had at creation (440px) until the node is
// laid out again. Re-apply the node size and redraw so it fills the real width
// after an import / paste / workflow load, and whenever the node is resized.
// ComfyUI sizes the DOM widget's wrapper itself, but in some sessions it keeps a
// stale width from an earlier node size, so the content overflows the node.
// Derive the width from the node's real size instead (the wrapper margin is
// 20px in the classic renderer and 24px in Nodes 2.0).
function fitWidth(node) {
  const root = node._c3?.root;
  if (!root || !node.size) return;
  const margin = window.LiteGraph?.vueNodesMode ? 24 : 20;
  const w = `${Math.max(120, node.size[0] - margin)}px`;
  if (root.style.width !== w) {
    root.style.width = w;
    updateWipe(node);
  }
}

function relayout(node) {
  const go = () => {
    if (!node.size) return;
    node.setSize([node.size[0], node.size[1]]);
    node.setDirtyCanvas?.(true, true);
    app.canvas?.setDirty?.(true, true);
    fitWidth(node);
    updateWipe(node);
  };
  requestAnimationFrame(go);
  setTimeout(go, 150);
}

app.registerExtension({
  name: "Compare3.ImageCompare",
  nodeCreated(node) {
    if (node.comfyClass !== "Compare3") return;
    node._c3Show = 1;
    node._c3Imgs = [null, null, null];

    const widget = node.addDOMWidget("compare3_ui", "compare3", buildUI(node), {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => 160,
    });
    node.setSize([Math.max(node.size[0], 440), 480]);

    const onExecuted = node.onExecuted;
    node.onExecuted = function (message) {
      onExecuted?.apply(this, arguments);
      setImages(this, message?.compare3 || []);
    };

    const onResize = node.onResize;
    node.onResize = function () {
      onResize?.apply(this, arguments);
      fitWidth(this);
      updateWipe(this);
    };

    const onDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function () {
      onDrawForeground?.apply(this, arguments);
      fitWidth(this);
    };

    const onConfigure = node.onConfigure;
    node.onConfigure = function () {
      onConfigure?.apply(this, arguments);
      relayout(this);
      const s = this.properties?.[STATE_KEY];
      if (!s) return;
      this._c3Show = s.show || 1;
      setImages(this, (s.images || [])
        .map((m, i) => (m ? { ...m, slot: i + 1 } : null)).filter(Boolean));
    };

    refresh(node);
    relayout(node);
  },
});
