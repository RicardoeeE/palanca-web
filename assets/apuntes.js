// ═══════════════════════════════════════════════════════════════════
//  Palanca · ApuntesStore — subida y persistencia local de apuntes
// ───────────────────────────────────────────────────────────────────
//  Imita una subida web real, pero persiste en la CARPETA del proyecto
//  `apuntes/`, que hace de base de datos:
//
//    • Fuente de verdad: apuntes/apuntes.json (el "manifiesto").
//      El sitio lo lee al arrancar → lo que haya listado, aparece.
//      Añade/quita entradas o archivos → se refleja al recargar.
//
//    • Escritura desde la web: File System Access API (Chrome/Edge sobre
//      localhost). Al publicar, escribe el archivo en apuntes/files/ y
//      actualiza apuntes.json. La 1ª vez pide elegir la carpeta `apuntes`.
//
//    • Fallback (navegador sin la API, o file://): guarda en localStorage
//      para verlo al instante y ofrece descargar el archivo para colocarlo
//      a mano en apuntes/files/.
//
//  Requiere: taxonomy.js (enrichResource) y simcatalog.js (SIMS).
//  Suponemos usuario ya autenticado (fuera del alcance de esta fase).
// ═══════════════════════════════════════════════════════════════════

const ApuntesStore = (() => {
  const MANIFEST_URL = "apuntes/apuntes.json";
  const LS_KEY       = "palanca:apuntes:local";
  let _dirHandle = null;   // handle de la carpeta apuntes/ (sesión)

  const supportsFS = () => typeof window.showDirectoryPicker === "function";

  // slug legible y seguro para nombres de archivo / id
  function slugify(str) {
    return (str || "apunte").toString().toLowerCase().trim()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 60) || "apunte";
  }

  // ── localStorage (fallback) ──
  function _readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch (e) { return []; }
  }
  function _writeLocal(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function clearLocal() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  // ── ¿Hay servidor de desarrollo con API? (serve.py) ──
  async function ping() {
    // serve.py solo corre en local: en la web publicada no se pregunta (evita un 404 en cada visita).
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return false;
    try {
      const res = await fetch("/api/ping", { cache: "no-store" });
      return res.ok;
    } catch (e) { return false; }
  }

  // Guardar vía servidor local: escribe en apuntes/ sin selector de carpeta
  async function _writeToServer(meta, fileText, ext) {
    const res = await fetch("/api/apuntes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta, fileText, ext }),
    });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    return data.entry;
  }

  // ── Cargar el manifiesto de la carpeta ──
  async function _loadManifest() {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.apuntes) ? data.apuntes : [];
    } catch (e) { return []; }
  }

  // Registrar un recurso en SIMS (para que el overlay lo encuentre)
  function _register(item) {
    if (typeof enrichResource === "function") enrichResource(item);
    if (typeof SIMS !== "undefined" && !SIMS.some(s => s.id === item.id)) SIMS.push(item);
    // profesor libre: si trae un id que no está en la taxonomía, añadirlo
    if (item.profesor && typeof TAXONOMY !== "undefined" &&
        !TAXONOMY.profesor.some(p => p.id === item.profesor)) {
      TAXONOMY.profesor.push({ id: item.profesor, label: item.profesorLabel || item.profesor, carrera: item.carrera });
    }
    return item;
  }

  // Carga todo (manifiesto + locales pendientes) y lo mete en SIMS.
  // El manifiesto manda; un local solo se muestra si su id no está en carpeta.
  async function load() {
    const manifest = await _loadManifest();
    const inManifest = new Set(manifest.map(a => a.id));
    const local = _readLocal().filter(a => !inManifest.has(a.id));
    const out = [];
    for (const a of manifest.concat(local)) out.push(_register({ ...a }));
    return out;
  }

  // ── Escribir en la carpeta con File System Access API ──
  async function _writeToFolder(entry, fileText, fileName) {
    if (!_dirHandle) {
      _dirHandle = await window.showDirectoryPicker({ id: "palanca-apuntes", mode: "readwrite" });
    }
    const filesDir = await _dirHandle.getDirectoryHandle("files", { create: true });
    const fh = await filesDir.getFileHandle(fileName, { create: true });
    let w = await fh.createWritable(); await w.write(fileText); await w.close();

    const mh = await _dirHandle.getFileHandle("apuntes.json", { create: true });
    let manifest = { apuntes: [] };
    try {
      const f = await mh.getFile(); const txt = await f.text();
      if (txt.trim()) manifest = JSON.parse(txt);
    } catch (e) {}
    if (!Array.isArray(manifest.apuntes)) manifest.apuntes = [];
    manifest.apuntes = manifest.apuntes.filter(a => a.id !== entry.id);
    manifest.apuntes.push(entry);
    let mw = await mh.createWritable();
    await mw.write(JSON.stringify(manifest, null, 2)); await mw.close();
  }

  // Descargar el archivo (para el flujo manual del fallback)
  function download(fileName, fileText, ext) {
    const blob = new Blob([fileText], { type: ext === "svg" ? "image/svg+xml" : "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ── Guardar un apunte ──
  //  meta: { titleEs, titleEn, bodyEs, bodyEn, subject, curso,
  //          profesor, profesorLabel, tags:[], level }
  //  fileText: contenido del archivo; ext: "svg" | "html"
  //  Devuelve { entry, mode, error, fileName, fileText, ext }
  //    mode: "server" (servidor local, carpeta predeterminada, sin selector)
  //        | "folder" (File System Access API, con selector)
  //        | "local"  (fallback navegador + descarga)
  async function save(meta, fileText, ext) {
    // ── 1) Servidor local (serve.py): guarda en apuntes/ sin selector ──
    try {
      const entry = await _writeToServer(meta, fileText, ext);
      const runtime = _register({ ...entry });
      return { entry: runtime, mode: "server", fileName: entry.file.split("/").pop(), fileText, ext };
    } catch (e) { /* sin servidor con API; probar otros modos */ }

    const base = slugify(meta.titleEs || meta.titleEn);
    const id = "apunte-" + base + "-" + Date.now().toString(36).slice(-4);
    const fileName = base + "." + ext;
    const entry = {
      id,
      file:    "apuntes/files/" + fileName,
      formato: ext,
      tipo:    "apunte",
      subject: meta.subject,
      curso:   meta.curso || null,
      profesor: meta.profesor || null,
      titleEs: meta.titleEs,
      titleEn: meta.titleEn || meta.titleEs,
      bodyEs:  meta.bodyEs || "",
      bodyEn:  meta.bodyEn || meta.bodyEs || "",
      tags:    meta.tags || [],
      level:   meta.level || 1,
    };
    if (meta.profesorLabel) entry.profesorLabel = meta.profesorLabel;

    let mode = "local", error = null;
    if (supportsFS()) {
      try { await _writeToFolder(entry, fileText, fileName); mode = "folder"; }
      catch (e) { mode = "local"; error = e; }   // incluye cancelar el diálogo
    }

    // Runtime: el que se muestra ya. En folder, apunta al archivo real;
    // en local, a un data URL para verlo sin tocar disco.
    const runtime = { ...entry };
    if (mode !== "folder") {
      const dataUrl = "data:" + (ext === "svg" ? "image/svg+xml" : "text/html")
        + ";charset=utf-8," + encodeURIComponent(fileText);
      runtime.file = dataUrl;
      const arr = _readLocal().filter(a => a.id !== id);
      arr.push(runtime);
      _writeLocal(arr);
    }
    _register(runtime);

    return { entry: runtime, mode, error, fileName, fileText, ext };
  }

  // ── Editar un apunte (solo modo servidor) ──
  // fileText/ext opcionales: si no se pasan, se conserva el archivo actual.
  async function update(id, meta, fileText, ext) {
    const res = await fetch("/api/apuntes/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta, fileText: fileText || null, ext: ext || null }),
    });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    const runtime = { ...data.entry };
    if (typeof SIMS !== "undefined") {
      const i = SIMS.findIndex(s => s.id === id);
      if (i >= 0) SIMS[i] = runtime;
    }
    _register(runtime);   // enriquece y da de alta profesores nuevos
    return runtime;
  }

  // ── Borrar un apunte (su archivo va a apuntes/_papelera/) ──
  async function remove(id) {
    const res = await fetch("/api/apuntes/" + encodeURIComponent(id), { method: "DELETE" });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    if (typeof SIMS !== "undefined") {
      const i = SIMS.findIndex(s => s.id === id);
      if (i >= 0) SIMS.splice(i, 1);
    }
    _writeLocal(_readLocal().filter(a => a.id !== id));   // por si era local
    return true;
  }

  return { load, save, update, remove, download, supportsFS, slugify, clearLocal, ping };
})();
