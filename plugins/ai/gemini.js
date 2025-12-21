const path = require('path');
const fs = require('fs');

// --- KONFIGURASI PLUGIN ---
exports.name = 'Gemini Chat Tess';
exports.desc = 'Chat dengan Google Gemini (Support Context/Nyambung)';
exports.category = 'ai';
exports.method = 'GET';
exports.path = '/geminiii';
exports.params = [
    { name: 'query', required: true },
    { name: 'id', required: false } // ID bersifat opsional untuk chat pertama
];
exports.example = '/ai/gemini?query=Halo&id=';

// --- LOGIKA UTAMA GEMINI ---

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

// Helper untuk fetch
let _fetch = globalThis.fetch;
async function ensureFetch() {
    if (typeof _fetch === 'function') return _fetch;
    try {
        const mod = await import('node-fetch');
        _fetch = mod.default;
        return _fetch;
    } catch (e) {
        throw new Error('Module node-fetch tidak ditemukan. Install dengan: npm install node-fetch');
    }
}

// Helper Encode/Decode
function btoa2(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function atob2(b64) { return Buffer.from(b64, 'base64').toString('utf8'); }

// Helper Parse Response
function cleanUrlCandidate(s) {
    if (typeof s !== 'string') return '';
    return s.trim().replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\u002f/gi, '/').replace(/\\/g, '').replace(/[\\'"\]\)>,.]+$/g, '');
}

function extractImageUrlsFromText(text) {
    const out = new Set();
    const regex = /https:\/\/[\w\-\.]+(?:googleusercontent\.com|ggpht\.com)[^\s"'<>)]+|https:\/\/[^\s"'<>)]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>)]*)?/gi;
    for (const m of (text.match(regex) || [])) {
        const u = cleanUrlCandidate(m);
        if (!u.includes('image_generation_content')) out.add(u);
    }
    return Array.from(out);
}

// Mendapatkan Cookie Baru
async function getAnonCookie() {
    const f = await ensureFetch();
    try {
        const r = await f('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&rt=c', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': UA },
            body: 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&',
        });
        const setCookie = r.headers.get('set-cookie');
        if (!setCookie) throw new Error('Gagal mendapatkan session cookie.');
        return setCookie.split(';')[0];
    } catch (e) {
        throw new Error('Gagal fetch cookie: ' + e.message);
    }
}

// Mendapatkan Token XSRF (Wajib agar tidak 403)
async function getXsrfToken(cookieHeader) {
    try {
        const f = await ensureFetch();
        const res = await f('https://gemini.google.com/app', {
            method: 'GET',
            headers: { 'user-agent': UA, cookie: cookieHeader },
        });
        const html = await res.text();
        const m1 = html.match(/"SNlM0e":"([^"]+)"/);
        return m1?.[1] || null;
    } catch { return null; }
}

function parseStream(data) {
    if (!data) throw new Error('Empty response');
    const chunks = Array.from(data.matchAll(/^\d+\r?\n([\s\S]+?)\r?\n(?=\d+\r?\n|$)/gm)).map(m => m[1]).reverse();
    
    let bestText = '';
    let resumeArray = null;
    let images = [];

    for (const c of chunks) {
        try {
            const outer = JSON.parse(c);
            const payloadStr = outer?.[0]?.[2]; 
            if (typeof payloadStr !== 'string') continue;
            
            const parsed = JSON.parse(payloadStr);
            
            // 1. Ambil Text Jawaban
            const candidates = [];
            const walk = (node) => {
                if (typeof node === 'string' && node.length > 5 && !node.startsWith('http')) candidates.push(node);
                if (Array.isArray(node)) node.forEach(walk);
            };
            walk(parsed);
            candidates.sort((a, b) => b.length - a.length);
            if(candidates.length > 0) bestText = candidates[0];

            // 2. Ambil History Context (Resume Array)
            // Cek di parsed[1] (Posisi standard)
            if (Array.isArray(parsed?.[1])) {
                resumeArray = parsed[1];
            }
        } catch (e) {}
    }
    
    if(!bestText) bestText = "Maaf, saya tidak bisa memproses jawaban saat ini.";
    bestText = bestText.replace(/\*\*(.+?)\*\*/g, '*$1*').trim(); 
    images = extractImageUrlsFromText(data);

    return { text: bestText, resumeArray, images };
}

async function askGemini(prompt, previousId = null) {
    const f = await ensureFetch();
    
    let resumeArray = null;
    let activeCookie = null;

    // --- FIX UTAMA: LOAD COOKIE LAMA ---
    if (previousId) {
        try {
            const j = JSON.parse(atob2(previousId));
            resumeArray = j?.r || null; // 'r' singkatan resumeArray
            activeCookie = j?.c || null; // 'c' singkatan cookie
        } catch (e) {
            console.log("ID tidak valid, membuat sesi baru.");
        }
    }

    // Jika tidak ada cookie lama, buat baru
    if (!activeCookie) {
        activeCookie = await getAnonCookie();
    }

    const xsrf = await getXsrfToken(activeCookie);
    
    const payload = [[prompt], ['en-US'], resumeArray];
    const params = new URLSearchParams({
        'f.req': JSON.stringify([null, JSON.stringify(payload)]),
        at: xsrf || ''
    });

    const response = await f('https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': UA,
            'cookie': activeCookie, // GUNAKAN COOKIE KONSISTEN
        },
        body: params
    });

    const data = await response.text();
    const parsed = parseStream(data);
    
    // --- FIX UTAMA: SIMPAN COOKIE KE ID ---
    // Kita simpan cookie + resumeArray ke dalam ID agar bisa dipakai request berikutnya
    let newId = null;
    if (parsed.resumeArray) {
        newId = btoa2(JSON.stringify({ 
            r: parsed.resumeArray, 
            c: activeCookie 
        }));
    }
    
    return { text: parsed.text, id: newId, images: parsed.images };
}

// --- FUNGSI EKSEKUSI PLUGIN ---
exports.run = async (req, res) => {
    const { query, id } = req.query;

    if (!query) {
        return res.json({
            status: false,
            message: 'Parameter query diperlukan. Contoh: ?query=Halo'
        });
    }

    try {
        const result = await askGemini(query, id);
        
        res.json({
            status: true,
            creator: "Rest API",
            result: {
                reply: result.text,
                conversation_id: result.id, // ID ini sekarang mengandung Context + Cookie
                images: result.images
            }
        });
    } catch (e) {
        console.error(e);
        res.json({
            status: false,
            message: 'Terjadi kesalahan pada server Gemini',
            error: e.message
        });
    }
};