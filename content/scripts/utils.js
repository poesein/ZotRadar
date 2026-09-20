(function (ZR) {
  'use strict';

  const GREEK = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'κ': 'kappa', 'δ': 'delta' };

  function nowISO() { return new Date().toISOString(); }
  function clamp(v, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Number(v))); }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function prefKey(name) { return `extensions.zotradar.${name}`; }
  function getPref(name, fallback = null) {
    const v = Zotero.Prefs.get(prefKey(name), true);
    return v === undefined || v === null ? fallback : v;
  }
  function setPref(name, value) { Zotero.Prefs.set(prefKey(name), value, true); }
  function log(...args) {
    if (getPref('debug', false)) Zotero.debug('[ZotRadar] ' + args.map(String).join(' '));
  }
  function error(err, context = '') {
    Zotero.logError(err instanceof Error ? err : new Error(`${context}: ${String(err)}`));
  }
  function normalizeText(input) {
    let s = String(input || '').normalize('NFKC').toLowerCase();
    s = s.replace(/[αβγκδ]/g, ch => GREEK[ch] || ch);
    s = s.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function containsTerm(normalizedBlob, term) {
    const t = normalizeText(term);
    if (!t) return false;
    if (/^[a-z0-9 ]+$/.test(t)) {
      const pattern = `(^|[^a-z0-9])${escapeRegex(t).replace(/\\ /g, '\\s+')}([^a-z0-9]|$)`;
      return new RegExp(pattern, 'i').test(normalizedBlob);
    }
    return normalizedBlob.includes(t);
  }
  function hashString(str) {
    // FNV-1a 64-ish (two 32-bit lanes); cache/version hash, not a cryptographic primitive.
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 0x01000193);
      h2 ^= c + i; h2 = Math.imul(h2, 0x85ebca6b);
    }
    return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
  }
  function safeJSON(text, fallback = null) {
    try { return JSON.parse(String(text)); } catch (_) { return fallback; }
  }
  function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
  }
  function randomToken(n = 48) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    try {
      const c = globalThis.crypto;
      if (c && typeof c.getRandomValues === 'function') {
        const bytes = new Uint8Array(n); c.getRandomValues(bytes);
        let out = ''; for (let i = 0; i < n; i++) out += chars[bytes[i] % chars.length];
        return out;
      }
    } catch (_) {}
    try { return Zotero.Utilities.randomString(n); }
    catch (_) {
      let out = ''; for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }
  }
  function localDayKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.valueOf())) return null;
    const pad = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function stripMarkup(value) {
    const s = String(value || '');
    try {
      const Parser = Services.appShell.hiddenDOMWindow.DOMParser;
      const doc = new Parser().parseFromString(s, 'text/html');
      return (doc.body && doc.body.textContent || s).replace(/\s+/g, ' ').trim();
    }
    catch (_) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  }
  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function parseQueryString(data) {
    const out = {};
    const q = String(data || '').replace(/^\?/, '');
    if (!q) return out;
    for (const part of q.split('&')) {
      const [k, v = ''] = part.split('=');
      if (!k) continue;
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
    return out;
  }
  function parseDateLoose(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
  }
  function normalizeDOI(v) {
    let s = String(v || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
    return s || null;
  }
  function extractIDs(extra) {
    const text = String(extra || '');
    const pmid = (text.match(/\bPMID\s*:\s*(\d+)/i) || [])[1] || null;
    const pmcid = (text.match(/\bPMCID\s*:\s*(PMC\d+)/i) || [])[1] || null;
    return { pmid, pmcid };
  }
  function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { const x=+a[i], y=+b[i]; dot += x*y; aa += x*x; bb += y*y; }
    return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
  }
  function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
  function robustTopMean(values, k = 5) {
    let vals = (values || []).map(v => clamp(v, -1, 1)).sort((a,b)=>b-a).slice(0, Math.max(1, k));
    if (!vals.length) return 0;
    if (vals.length >= 5) vals = vals.slice(1, -1);
    return mean(vals);
  }
  function formatError(e) { return e && e.stack ? e.stack : String(e); }

  let _netUtil = null;
  function getNetUtil() {
    if (_netUtil) return _netUtil;
    _netUtil = ChromeUtils.importESModule('resource://gre/modules/NetUtil.sys.mjs').NetUtil;
    return _netUtil;
  }
  function readResourceText(relativePath) {
    const spec = String(relativePath || '').includes('://')
      ? String(relativePath)
      : ZR.rootURI + String(relativePath || '').replace(/^\/+/, '');
    const NetUtil = getNetUtil();
    return new Promise((resolve, reject) => {
      // Firefox 140 / Zotero 10 requires a channel/load-info context for
      // privileged jar: resources. Passing an nsIURI directly to
      // NetUtil.asyncFetch() is deprecated and fails for XPI jar URLs.
      const source = { uri: spec, loadUsingSystemPrincipal: true };
      try {
        NetUtil.asyncFetch(source, (inputStream, status) => {
          try {
            if (!Components.isSuccessCode(status)) {
              let detail = '';
              try { detail = Components.Exception('', status).name; } catch (_) {}
              reject(new Error(`Failed to read bundled resource: ${spec} (status ${status}${detail ? ', ' + detail : ''})`));
              return;
            }
            const count = inputStream.available();
            const text = count
              ? NetUtil.readInputStreamToString(inputStream, count, { charset: 'UTF-8' })
              : '';
            resolve(text);
          }
          catch (e) {
            reject(new Error(`Failed to decode bundled resource ${spec}: ${e && e.message ? e.message : e}`));
          }
        });
      }
      catch (e) {
        reject(new Error(`Failed to open bundled resource ${spec}: ${e && e.message ? e.message : e}`));
      }
    });
  }
  async function readResourceJSON(relativePath) {
    return JSON.parse(await readResourceText(relativePath));
  }

  ZR.Utils = { nowISO, clamp, sleep, getPref, setPref, prefKey, log, error, normalizeText,
    containsTerm, hashString, safeJSON, stableStringify, randomToken, stripMarkup, escapeHTML,
    parseQueryString, parseDateLoose, normalizeDOI, extractIDs, cosine, robustTopMean, formatError, localDayKey, readResourceText, readResourceJSON };
})(ZR);
