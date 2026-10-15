'use strict';

/* =========================================================
 * Traducciones
 * ======================================================= */
const translations = {
  es: {
    language: 'Idioma',
    title: 'Netscape a formato JSON',
    subtitle: 'Convierte cookies en formato Netscape (.txt) a JSON directamente en tu navegador. Nada se envía a ningún servidor.',
    phNetscape: 'Pega aquí tus cookies en formato Netscape…',
    phJSON: 'El resultado aparecerá aquí',
    paste: 'Pegar',
    clear: 'Limpiar',
    copy: 'Copiar',
    statsNone: 'Sin cookies detectadas',
    statsOne: '1 cookie detectada',
    statsMany: '{n} cookies detectadas',
    dropTitle: 'Arrastra tus archivos .txt aquí',
    dropAction: 'o selecciona archivo(s)',
    filesTitle: 'Archivos seleccionados ({n})',
    clearFiles: 'Quitar todos',
    removeFile: 'Quitar',
    keepTxt: 'Mantener formato .txt',
    btnConvert: 'Convertir y copiar',
    btnDownload: 'Convertir y descargar',
    hint: '«Convertir y copiar» usa el texto pegado. «Convertir y descargar» usa los archivos seleccionados o, si no hay, el texto pegado.',
    emptyInput: 'Pega algún texto primero',
    noCookies: 'No se encontraron cookies válidas',
    converted: '{n} cookies convertidas y copiadas',
    convertedNoCopy: 'Convertido, pero no se pudo copiar automáticamente',
    copied: 'Copiado al portapapeles',
    copyFail: 'No se pudo copiar',
    nothingToCopy: 'No hay nada que copiar',
    pasteFail: 'No se pudo leer el portapapeles. Pega manualmente.',
    nothingToDownload: 'Pega texto o selecciona archivos primero',
    downloaded: 'Descarga lista ({n} cookies)',
    downloadedFiles: 'Descarga lista: {f} archivo(s), {n} cookies',
    emptyFilesNote: ' · {z} sin cookies válidas',
    skipped: 'Se omitieron archivos que no son .txt',
    fileError: 'Error al leer {name}',
    footer: 'Todo se procesa localmente en tu navegador.',
    loading: 'Cargando',
  },
  en: {
    language: 'Language',
    title: 'Netscape to JSON format',
    subtitle: 'Convert Netscape-format cookies (.txt) to JSON right in your browser. Nothing is sent to any server.',
    phNetscape: 'Paste your Netscape-format cookies here…',
    phJSON: 'The result will appear here',
    paste: 'Paste',
    clear: 'Clear',
    copy: 'Copy',
    statsNone: 'No cookies detected',
    statsOne: '1 cookie detected',
    statsMany: '{n} cookies detected',
    dropTitle: 'Drag your .txt files here',
    dropAction: 'or select file(s)',
    filesTitle: 'Selected files ({n})',
    clearFiles: 'Remove all',
    removeFile: 'Remove',
    keepTxt: 'Keep .txt format',
    btnConvert: 'Convert and copy',
    btnDownload: 'Convert and download',
    hint: '“Convert and copy” uses the pasted text. “Convert and download” uses the selected files or, if none, the pasted text.',
    emptyInput: 'Paste some text first',
    noCookies: 'No valid cookies found',
    converted: '{n} cookies converted and copied',
    convertedNoCopy: 'Converted, but it could not be copied automatically',
    copied: 'Copied to clipboard',
    copyFail: 'Could not copy',
    nothingToCopy: 'Nothing to copy',
    pasteFail: 'Could not read the clipboard. Please paste manually.',
    nothingToDownload: 'Paste text or select files first',
    downloaded: 'Download ready ({n} cookies)',
    downloadedFiles: 'Download ready: {f} file(s), {n} cookies',
    emptyFilesNote: ' · {z} without valid cookies',
    skipped: 'Non-.txt files were skipped',
    fileError: 'Error reading {name}',
    footer: 'Everything is processed locally in your browser.',
    loading: 'Loading',
  },
};

/* =========================================================
 * Estado y utilidades
 * ======================================================= */
const $ = (id) => document.getElementById(id);
const state = { files: [], lang: 'es' };

function t(key, vars = {}) {
  const dict = translations[state.lang] || translations.es;
  const text = dict[key] ?? translations.es[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

let toastTimer;
function toast(message, type = 'info') {
  const el = $('toast');
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function setBusy(busy) {
  $('overlay').classList.toggle('show', busy);
  document.body.setAttribute('aria-busy', String(busy));
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Respaldo para navegadores o contextos sin Clipboard API
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.setAttribute('readonly', '');
    tmp.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(tmp);
    tmp.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    tmp.remove();
    return ok;
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* =========================================================
 * Conversión Netscape -> JSON
 * ======================================================= */
function extractCookies(text) {
  const cookies = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;

    let line = rawLine;
    let httpOnly = false;
    const trimmed = rawLine.trimStart();

    if (trimmed.startsWith('#HttpOnly_')) {
      httpOnly = true;
      line = trimmed.slice('#HttpOnly_'.length);
    } else if (trimmed.startsWith('#')) {
      continue; // comentario
    }

    // Formato estándar: 7 campos separados por tabulador.
    let tokens = line.split('\t');
    if (tokens.length !== 7) {
      // Respaldo: si al copiar/pegar los tabuladores se convirtieron en espacios
      const alt = line.trim().split(/\s+/);
      if (alt.length !== 7) continue;
      tokens = alt;
    }

    const [domain, flag, path, secure, expires, name, value] = tokens.map((s) => s.trim());

    // Expiración: segundos Unix. Si viene en microsegundos desde 1601 (17 dígitos), se convierte.
    let expiration = expires;
    if (/^\d+$/.test(expires)) {
      expiration = expires.length === 17 ? Math.floor(Number(expires) / 1e6 - 11644473600) : Number(expires);
    }

    const cookie = {
      domain,
      flag: flag.toUpperCase() === 'TRUE',
      path,
      secure: secure.toUpperCase() === 'TRUE',
      name,
      value,
      expiration,
    };
    if (httpOnly) cookie.httpOnly = true;

    cookies.push(cookie);
  }

  return cookies;
}

const toJSON = (cookies) => JSON.stringify(cookies, null, 2);

/* =========================================================
 * Acciones del texto pegado
 * ======================================================= */
function updateStats() {
  const n = extractCookies($('cook').value).length;
  const el = $('stats');
  el.textContent = n === 0 ? ($('cook').value.trim() ? t('statsNone') : '') : n === 1 ? t('statsOne') : t('statsMany', { n });
  el.dataset.state = n > 0 ? 'ok' : '';
}

async function convertAndCopy() {
  const text = $('cook').value;
  if (!text.trim()) {
    $('result').value = '';
    toast(t('emptyInput'), 'error');
    return;
  }
  const cookies = extractCookies(text);
  if (cookies.length === 0) {
    $('result').value = '';
    toast(t('noCookies'), 'error');
    return;
  }
  const json = toJSON(cookies);
  $('result').value = json;
  const copied = await copyToClipboard(json);
  toast(copied ? t('converted', { n: cookies.length }) : t('convertedNoCopy'), copied ? 'ok' : 'info');
}

async function copyResult() {
  const value = $('result').value;
  if (!value) return toast(t('nothingToCopy'), 'error');
  const ok = await copyToClipboard(value);
  toast(ok ? t('copied') : t('copyFail'), ok ? 'ok' : 'error');
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    $('cook').value = text;
    updateStats();
  } catch {
    toast(t('pasteFail'), 'error');
    $('cook').focus();
  }
}

function clearInput() {
  $('cook').value = '';
  $('result').value = '';
  updateStats();
  $('cook').focus();
}

/* =========================================================
 * Archivos
 * ======================================================= */
function addFiles(fileList) {
  let skipped = false;
  for (const f of fileList) {
    const isText = /\.txt$/i.test(f.name) || f.type.startsWith('text/');
    if (!isText) {
      skipped = true;
      continue;
    }
    const duplicate = state.files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified);
    if (!duplicate) state.files.push(f);
  }
  if (skipped) toast(t('skipped'), 'error');
  renderFiles();
}

function removeFile(index) {
  state.files.splice(index, 1);
  renderFiles();
}

function renderFiles() {
  const list = $('fileList');
  list.replaceChildren();
  $('filesBlock').hidden = state.files.length === 0;
  $('filesTitle').textContent = t('filesTitle', { n: state.files.length });

  state.files.forEach((file, i) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;
    name.title = file.name;

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatSize(file.size);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.textContent = '×';
    btn.setAttribute('aria-label', `${t('removeFile')}: ${file.name}`);
    btn.addEventListener('click', () => removeFile(i));

    li.append(name, size, btn);
    list.appendChild(li);
  });
}

function outputName(original) {
  if ($('keepTxtFormat').checked) return original;
  return original.replace(/\.[^./\\]+$/, '') + '.json';
}

function uniqueName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (used.has(`${base} (${n})${ext}`)) n++;
  const finalName = `${base} (${n})${ext}`;
  used.add(finalName);
  return finalName;
}

async function convertAndDownload() {
  // Sin archivos: descarga el resultado del texto pegado
  if (state.files.length === 0) {
    const text = $('cook').value;
    if (!text.trim()) return toast(t('nothingToDownload'), 'error');
    const cookies = extractCookies(text);
    if (cookies.length === 0) return toast(t('noCookies'), 'error');
    const json = toJSON(cookies);
    $('result').value = json;
    const name = $('keepTxtFormat').checked ? 'cookies.txt' : 'cookies.json';
    download(new Blob([json], { type: 'application/json' }), name);
    return toast(t('downloaded', { n: cookies.length }), 'ok');
  }

  setBusy(true);
  try {
    const used = new Set();
    const outputs = [];
    let totalCookies = 0;
    let emptyFiles = 0;

    for (const file of state.files) {
      try {
        const cookies = extractCookies(await file.text());
        if (cookies.length === 0) emptyFiles++;
        totalCookies += cookies.length;
        outputs.push({ name: uniqueName(outputName(file.name), used), json: toJSON(cookies) });
      } catch {
        toast(t('fileError', { name: file.name }), 'error');
      }
    }

    if (outputs.length === 0) return;

    if (outputs.length === 1) {
      download(new Blob([outputs[0].json], { type: 'application/json' }), outputs[0].name);
    } else if (typeof JSZip !== 'undefined') {
      const zip = new JSZip();
      outputs.forEach((o) => zip.file(o.name, o.json));
      download(await zip.generateAsync({ type: 'blob' }), 'Cookies.zip');
    } else {
      // Si JSZip no cargó (sin conexión), descarga cada archivo por separado
      outputs.forEach((o) => download(new Blob([o.json], { type: 'application/json' }), o.name));
    }

    let message = t('downloadedFiles', { f: outputs.length, n: totalCookies });
    if (emptyFiles) message += t('emptyFilesNote', { z: emptyFiles });
    toast(message, emptyFiles ? 'info' : 'ok');
  } finally {
    setBusy(false);
  }
}

/* =========================================================
 * Idioma
 * ======================================================= */
function applyLanguage(lang) {
  state.lang = translations[lang] ? lang : 'es';
  document.documentElement.lang = state.lang;
  $('languageSelector').value = state.lang;
  try {
    localStorage.setItem('lang', state.lang);
  } catch {
    /* sin almacenamiento */
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.title = t('title');
  $('overlay').setAttribute('aria-label', t('loading'));
  $('copyright').textContent = `© 2024–${new Date().getFullYear()}. ${t('footer')}`;
  renderFiles();
  updateStats();
}

function detectLanguage() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved && translations[saved]) return saved;
  } catch {
    /* ignorar */
  }
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/* =========================================================
 * Eventos
 * ======================================================= */
$('conversionForm').addEventListener('submit', (e) => e.preventDefault());
$('btnConvertir').addEventListener('click', convertAndCopy);
$('convert').addEventListener('click', convertAndDownload);
$('btnCopy').addEventListener('click', copyResult);
$('btnPaste').addEventListener('click', pasteFromClipboard);
$('btnClear').addEventListener('click', clearInput);
$('btnClearFiles').addEventListener('click', () => {
  state.files = [];
  renderFiles();
});
$('cook').addEventListener('input', updateStats);
$('languageSelector').addEventListener('change', (e) => applyLanguage(e.target.value));

$('file-input').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = ''; // permite volver a elegir el mismo archivo
});

// Arrastrar y soltar
const dz = $('dropzone');
['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.add('is-over');
  }),
);
['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.remove('is-over');
  }),
);
dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

// Evita que el navegador abra el archivo si se suelta fuera de la zona
['dragover', 'drop'].forEach((ev) =>
  window.addEventListener(ev, (e) => {
    if (!dz.contains(e.target)) e.preventDefault();
  }),
);

applyLanguage(detectLanguage());
