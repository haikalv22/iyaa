const path = require('path');
const fs = require('fs');

// --- KONFIGURASI PLUGIN ---
exports.name = 'tess';
exports.desc = 'Chat dengan Google Gemini (Support Context/Nyambung)';
exports.category = 'ai';
exports.method = 'GET';
exports.path = '/geminiii'; // Sesuaikan path jika mau
exports.params = [
    { name: 'query', required: true },
    { name: 'id', required: false } 
];
exports.example = '/ai/geminiii?query=Halo&id=';

// --- LOGIKA UTAMA GEMINI ---

// User Agent yang lebih baru biar tidak dianggap bot jadul
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let _fetch = globalThis.fetch;
async function ensureFetch() {
    if (typeof _fetch === 'function') return _fetch;
    try {
        const mod = await import('node-fetch');
        _fetch = mod.default;
        return _fetch;
    } catch (e) {
        throw new Error('Module node-fetch tidak ditemukan.');
    }
}

function btoa2(str) { return Buffer.from(str, 'utf8').toString('base64'); }
function atob2(b64) { return Buffer.from(b64, 'base64').toString('utf8'); }

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

// 1. Dapatkan Cookie Baru
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

// 2. Dapatkan SNlM0e (Token XSRF) menggunakan Cookie yang spesifik
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

// 3. Parser Response (Lebih teliti mencari Conversation ID)
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
            
            // A. Cari Text
            const candidates = [];
            const walk = (node) => {
                if (typeof node === 'string' && node.length > 5 && !node.startsWith('http')) candidates.push(node);
                if (Array.isArray(node)) node.forEach(walk);
            };
            walk(parsed);
            candidates.sort((a, b) => b.length - a.length);
            if(candidates.length > 0) bestText = candidates[0];

            // B. Cari Conversation Context (resumeArray)
            // Biasanya ada di index 1: [content, [c_id, r_id, rc_id], ...]
            if (Array.isArray(parsed) && parsed.length > 1 && Array.isArray(parsed[1])) {
                // Pastikan array ini berisi string ID (c_...)
                const candidateArray = parsed[1];
                if (candidateArray.length >= 2 && typeof candidateArray[0] === 'string' && candidateArray[0].startsWith('c_')) {
                    resumeArray = candidateArray;
                }
            }
        } catch (e) {}
    }
    
    if(!bestText) bestText = "Maaf, saya tidak bisa memproses jawaban saat ini.";
    
    // Bersihkan formatting aneh dari Gemini
    bestText = bestText
        .replace(/\*\*(.+?)\*\*/g, '*$1*') // Bold
        .replace(/\[Image of.*?\]/g, '') // Hapus placeholder image
        .trim();
        
    images = extractImageUrlsFromText(data);

    return { text: bestText, resumeArray, images };
}

async function askGemini(prompt, previousId = null) {
    const f = await ensureFetch();
    
    let resumeArray = null;
    let activeCookie = null;

    // --- DECODE CONTEXT ---
    if (previousId) {
        try {
            const j = JSON.parse(atob2(previousId));
            resumeArray = j?.r || null; 
            activeCookie = j?.c || null; 
            
            // Validasi format resumeArray harus benar
            if (!Array.isArray(resumeArray) || resumeArray.length < 2) {
                resumeArray = null; // Reset jika korup
            }
        } catch (e) {
            console.log("ID tidak valid, membuat sesi baru.");
        }
    }

    // Jika Cookie hilang, buat baru
    if (!activeCookie) {
        activeCookie = await getAnonCookie();
    }

    // Fetch Token XSRF baru menggunakan Cookie yang SAMA
    const xsrf = await getXsrfToken(activeCookie);
    if (!xsrf) {
        // Jika gagal dapat token pakai cookie lama, berarti cookie expired.
        // Terpaksa buat cookie baru (Context hilang, tapi bot tetap jalan)
        activeCookie = await getAnonCookie();
        // Coba ambil token lagi
    }

    // --- PAYLOAD REVISED ---
    // Menggunakan 'null' bukan 'en-US' kadang lebih stabil untuk context lanjutan
    const payload = [[prompt], null, resumeArray]; 
    
    const params = new URLSearchParams({
        'f.req': JSON.stringify([null, JSON.stringify(payload)]),
        at: xsrf || ''
    });

    const response = await f('https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': UA,
            'cookie': activeCookie, 
            'origin': 'https://gemini.google.com',
            'referer': 'https://gemini.google.com/'
        },
        body: params
    });

    if (!response.ok) {
        throw new Error(`Gemini Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    const parsed = parseStream(data);
    
    // Simpan context baru
    // Jika Gemini tidak mengembalikan context baru, kita GUNAKAN context lama + update r_id jika mungkin (tapi sulit)
    // Jadi kita prioritaskan context dari response baru.
    let finalResume = parsed.resumeArray || resumeArray; 
    
    let newId = null;
    if (finalResume) {
        newId = btoa2(JSON.stringify({ 
            r: finalResume, 
            c: activeCookie 
        }));
    }
    
    return { text: parsed.text, id: newId, images: parsed.images };
}

exports.run = async (req, res) => {
    const { query, id } = req.query;

    if (!query) {
        return res.json({
            status: false,
            message: 'Parameter query diperlukan.'
        });
    }

    try {
        const result = await askGemini(query, id);
        
        res.json({
            status: true,
            creator: "Rest API",
            result: {
                reply: result.text,
                conversation_id: result.id, 
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