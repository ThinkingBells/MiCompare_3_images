import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const STATE_KEY = "compare3State";
const ACCENT = "#e0702d";

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
    "display:flex;flex-direction:column;gap:4px;width:100%;height:100%;box-sizing:border-box;";

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
  view.append(img, note);

  root.append(row1, row2, info, view);
  root.insertBefore(info, row2.nextSibling);
  node._c3 = { showBtns, saveBtns, dims, img, note };
  return root;
}

function refresh(node) {
  const ui = node._c3;
  if (!ui) return;
  const imgs = node._c3Imgs || [null, null, null];
  const show = node._c3Show || 1;
  [0, 1, 2].forEach((i) => {
    setActive(ui.showBtns[i], show === i + 1);
    ui.showBtns[i].style.opacity = imgs[i] ? "1" : "0.5";
    ui.saveBtns[i].style.opacity = imgs[i] ? "1" : "0.5";
  });
  const cur = imgs[show - 1];
  if (cur) {
    ui.img.src = cur.url;
    ui.img.style.display = "block";
    ui.note.style.display = "none";
  } else {
    ui.img.removeAttribute("src");
    ui.img.style.display = "none";
    ui.note.style.display = "flex";
    ui.note.textContent = imgs.some(Boolean)
      ? `Image ${show} not connected`
      : "Connect images & run to compare";
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
  if (!imgs[(node._c3Show || 1) - 1]) {
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

    const onConfigure = node.onConfigure;
    node.onConfigure = function () {
      onConfigure?.apply(this, arguments);
      const s = this.properties?.[STATE_KEY];
      if (!s) return;
      this._c3Show = s.show || 1;
      setImages(this, (s.images || [])
        .map((m, i) => (m ? { ...m, slot: i + 1 } : null)).filter(Boolean));
    };

    refresh(node);
  },
});
