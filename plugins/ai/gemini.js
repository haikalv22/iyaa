const fs = require('fs');
const path = require('path');

// --- KONFIGURASI GEMINI (Dikonversi ke CommonJS) ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

let _fetch = globalThis.fetch;

async function ensureFetch() {
  if (typeof _fetch === 'function') return _fetch;
  // Dynamic import untuk node-fetch (karena v3+ adalah ESM only)
  const mod = await import('node-fetch');
  _fetch = mod.default;
  return _fetch;
}

function btoa2(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function atob2(b64) { return Buffer.from(b64, 'base64').toString('utf8'); }

function walkDeep(node, visit, depth = 0, maxDepth = 7) {
  if (depth > maxDepth) return;
  if (visit(node, depth) === false) return;
  if (Array.isArray(node)) {
    for (const x of node) walkDeep(x, visit, depth + 1, maxDepth);
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) walkDeep(node[k], visit, depth + 1, maxDepth);
  }
}

function cleanUrlCandidate(s, { stripSpaces = false } = {}) {
  if (typeof s !== 'string') return '';
  let t = s.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\/g, '')
    .replace(/[\\'"\]\)>,.]+$/g, '');
  if (stripSpaces) t = t.replace(/\s+/g, '');
  return t;
}

function looksLikeImageUrl(u) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u) || /googleusercontent\.com|ggpht\.com/i.test(u);
}

async function getAnonCookie() {
  const f = await ensureFetch();
  const r = await f(
    'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&rt=c',
    {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': UA,
      },
      body: 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&',
    }
  );

  const setCookie = r.headers.get('set-cookie');
  if (!setCookie) throw new Error('Gemini no devolvió cookies (bloqueado o rate limit)');
  return setCookie.split(';')[0];
}

async function getXsrfToken(cookieHeader) {
  try {
    const f = await ensureFetch();
    const res = await f('https://gemini.google.com/app', {
      method: 'GET',
      headers: {
        'user-agent': UA,
        cookie: cookieHeader,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const html = await res.text();
    const m1 = html.match(/"SNlM0e":"([^"]+)"/);
    if (m1?.[1]) return m1[1];
    const m2 = html.match(/"at":"([^"]+)"/);
    if (m2?.[1]) return m2[1];
  } catch {}
  return null;
}

function extractImageUrlsFromText(text) {
  const out = new Set();
  if (typeof text !== 'string' || !text) return [];
  const regex = /https:\/\/[\w\-\.]+(?:googleusercontent\.com|ggpht\.com)[^\s"'<>)]+|https:\/\/[^\s"'<>)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>)]*)?/gi;
  for (const m of (text.match(regex) || [])) {
    const u = cleanUrlCandidate(m);
    if (/googleusercontent\.com\/image_generation_content\/0$/.test(u)) continue;
    out.add(u);
  }
  return Array.from(out);
}

function isLikelyText(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (!t) return false;
  if (t.length < 2) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^\/\/www\./i.test(t)) return false;
  if (/maps\/vt\/data/i.test(t)) return false;
  if (/^c_[0-9a-f]{6,}$/i.test(t)) return false;
  if (/^[A-Za-z0-9_\-+/=]{16,}$/.test(t) && !/\s/.test(t)) return false;
  if (/^\{.*\}$/.test(t) || /^\[.*\]$/.test(t)) return false;
  if (/https?:\/\//i.test(t) && t.length < 40) return false;
  return t.length >= 8 || /\s/.test(t);
}

function pickBestTextFromAny(parsed) {
  const found = [];
  walkDeep(parsed, (n) => {
    if (typeof n === 'string' && isLikelyText(n)) found.push(n.trim());
  });
  found.sort((a, b) => b.length - a.length);
  return found[0] || '';
}

function pickFirstString(parsed, accept) {
  let first = '';
  walkDeep(parsed, (n) => {
    if (first) return false;
    if (typeof n !== 'string') return;
    const t = n.trim();
    if (t && (!accept || accept(t))) first = t;
    if (first) return false;
  });
  return first;
}

function findInnerPayloadString(outer) {
  const candidates = [];
  const add = (s) => {
    if (typeof s !== 'string') return;
    const t = s.trim();
    if (!t) return;
    candidates.push(t);
  };

  add(outer?.[0]?.[2]); add(outer?.[2]); add(outer?.[0]?.[0]?.[2]);
  walkDeep(outer, (n) => {
    if (typeof n !== 'string') return;
    const t = n.trim();
    if ((t.startsWith('[') || t.startsWith('{')) && t.length > 20) add(t);
  }, 0, 5);

  for (const s of candidates) {
    try {
      JSON.parse(s);
      return s;
    } catch {}
  }
  return null;
}

function parseStream(data) {
  if (typeof data !== 'string' || !data.trim()) throw new Error('Respuesta vacía de Gemini');
  if (/<html|<!doctype/i.test(data)) throw new Error('Gemini devolvió HTML (posible bloqueo).');

  const chunks = Array.from(
    data.matchAll(/^\d+\r?\n([\s\S]+?)\r?\n(?=\d+\r?\n|$)/gm)
  ).map(m => m[1]).reverse();
  if (!chunks.length) throw new Error('Respuesta inválida de Gemini (sin chunks)');

  let best = { text: '', resumeArray: null, parsed: null };

  for (const c of chunks) {
    try {
      const outer = JSON.parse(c);
      const inner = findInnerPayloadString(outer);
      if (!inner) continue;
      const parsed = JSON.parse(inner);

      const text = pickBestTextFromAny(parsed);
      const resumeArray = Array.isArray(parsed?.[1]) ? parsed[1] : null;

      if (!best.parsed) {
        best = { text, resumeArray, parsed };
      } else if (text && text.length > (best.text?.length || 0)) {
        best = { text, resumeArray, parsed };
      }
    } catch {}
  }

  if (!best.parsed) throw new Error('Respuesta inválida de Gemini (no parseable)');
  const urls = new Set(extractImageUrlsFromText(data));
  walkDeep(best.parsed, (n, depth) => {
    if (depth > 6) return false;
    if (typeof n !== 'string') return;
    const u = cleanUrlCandidate(n, { stripSpaces: true });
    if (!/^https:\/\//i.test(u)) return;
    if (looksLikeImageUrl(u)) urls.add(u);
  }, 0, 7);

  let cleanText = (best.text || '').replace(/\*\*(.+?)\*\*/g, '*$1*').trim();
  if (!cleanText) {
    const accept = (t) => {
      if (/^https?:\/\//i.test(t)) return false;
      if (/^\/\/www\./i.test(t)) return false;
      if (/maps\/vt\/data/i.test(t)) return false;
      if (/^http:\/\/googleusercontent\.com\/image_collection\//i.test(t)) return false;
      return true;
    };
    cleanText = pickFirstString(best.parsed, accept) || pickFirstString(best.parsed)
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      .trim();
  }

  return { text: cleanText, resumeArray: best.resumeArray, images: Array.from(urls) };
}

async function ask(prompt, previousId = null) {
  const f = await ensureFetch();
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Prompt es requerido');

  let resumeArray = null;
  if (previousId) {
    try {
      const j = JSON.parse(atob2(previousId));
      resumeArray = j?.resumeArray || null;
    } catch {}
  }

  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cookie = await getAnonCookie();
      const xsrf = await getXsrfToken(cookie);

      const payload = [[prompt.trim()], ['en-US'], resumeArray];
      const fReq = [null, JSON.stringify(payload)];
      const params = { 'f.req': JSON.stringify(fReq) };
      if (xsrf) params.at = xsrf;

      const response = await f(
        'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': UA,
            'x-same-domain': '1',
            cookie,
          },
          body: new URLSearchParams(params),
        }
      );

      if (!response.ok) {
        const textBody = await response.text().catch(() => '');
        throw new Error(`${response.status} ${response.statusText} ${textBody || '(cuerpo vacío)'}`);
      }

      const data = await response.text();
      const parsed = parseStream(data);
      const id = btoa2(JSON.stringify({ resumeArray: parsed.resumeArray }));
      return { text: parsed.text, id, images: parsed.images };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 700));
        continue;
      }
    }
  }

  throw lastErr || new Error('Error desconocido');
}

// --- IMPLEMENTASI PLUGIN SERVER.JS ---

module.exports = {
  name: 'Gemini Chat',
  desc: 'Chat dengan Gemini AI (Unofficial Scraper)',
  method: 'GET', // Bisa 'get' atau 'post' tergantung preferensi
  path: '/geminii',
  category: 'ai',
  params: [
    { name: 'query', required: true }
  ],
  example: '/ai/gemini?query=siapa presiden indonesia',
  run: async (req, res) => {
    try {
      const query = req.query.query || req.body.query;
      
      if (!query) {
        return res.json({
          status: false,
          message: 'Parameter query diperlukan'
        });
      }

      // Opsional: Support conversation ID untuk chat lanjutan
      // Anda bisa mengirim parameter &id=... jika ingin melanjutkan chat
      const previousId = req.query.id || req.body.id || null;

      const result = await ask(query, previousId);

      res.json({
        status: true,
        creator: "REST API", // Sesuaikan nama creator
        result: {
          response: result.text,
          images: result.images, // Array URL gambar jika ada
          conversation_id: result.id // ID untuk melanjutkan percakapan
        }
      });

    } catch (err) {
      console.error('Gemini Plugin Error:', err);
      res.json({
        status: false,
        message: 'Error processing request',
        error: err.message
      });
    }
  }
};