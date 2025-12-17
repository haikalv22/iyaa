const https = require('https');
const crypto = require('crypto');

/**
 * HELPER DEOBFUSCATION
 * Bagian ini digunakan untuk memecah enkripsi key dari situs sumber
 */
function _0x3a24() {
    let e = ["error", "6C35BBC4EB", "32065fiPRVJ", "9651PJDqag", "match", "2949160OwuPPs", "1QaLwoE", "subtle", "15775023ibpdbH", "or:", "gMUfw", "12IfiARR", "importKey", "3235491JMTwmH", "334826TTrbVe", "10zgbCLj", "Format err", "2719575PhDuLf", "592dZwFMH", "7584E4A29F", "Invalid fo", "on failed:", "YrlUc", "crypto", "AES-CBC", "map"];
    return (_0x3a24 = function () { return e; })();
}

function _0x5ec9(e, t) {
    let a = _0x3a24();
    return (_0x5ec9 = function (e, t) { return a[(e -= 450)]; })(e, t);
}

const C = _0x5ec9;
const k = "C5D58EF67A" + C(456) + C(464) + "12"; // Key: C5D58EF67A6C35BBC4EB7584E4A29F12

/**
 * CORE ENCRYPTION ENGINE
 */
const formatSeed = (e) => {
    try {
        let a = e[C(467)](/[\dA-F]{2}/gi);
        let s = a[C(462)]((e) => parseInt(e, 16));
        return Buffer.from(s);
    } catch (e) { throw e; }
};

const processIncoming = async (e) => {
    try {
        let t = Buffer.from(e.replace(/\s/g, ""), 'base64');
        let a = t.slice(0, 16);
        let s = t.slice(16);
        let n = formatSeed(k);
        const decipher = crypto.createDecipheriv('aes-128-cbc', n, a);
        let decrypted = Buffer.concat([decipher.update(s), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch (e) { throw e; }
};

/**
 * SCRAPER CLASS
 */
class YTMp3Tax {
    constructor() {
        this.cdnBaseUrl = 'https://media.savetube.me/api/random-cdn';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://ytmp3.tax',
            'Referer': 'https://ytmp3.tax/'
        };
    }

    async makeRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: { ...this.headers, 'Host': urlObj.hostname }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } 
                    catch (e) { reject(new Error('Gagal memproses data dari server pusat.')); }
                });
            });

            req.on('error', (e) => reject(e));
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }

    async fetchDownload(youtubeUrl) {
        // 1. Dapatkan CDN Random
        const cdnRes = await this.makeRequest(this.cdnBaseUrl);
        const cdn = cdnRes.cdn.startsWith('http') ? cdnRes.cdn : `https://${cdnRes.cdn}`;

        // 2. Dapatkan Info Video & Enkripsi Data
        const info = await this.makeRequest(`${cdn}/v2/info`, 'POST', { url: youtubeUrl });
        if (!info.status) throw new Error(info.message || 'Video tidak ditemukan.');

        // 3. Dekripsi Key dari Response
        const decryptedData = await processIncoming(info.data);

        // 4. Request Link Download (Default Audio 128kbps)
        const finalRes = await this.makeRequest(`${cdn}/download`, 'POST', {
            downloadType: 'audio',
            quality: '128',
            key: decryptedData.key
        });

        if (!finalRes.status) throw new Error('gagal mengenerate link download.');
        return finalRes.data;
    }
}

const scraper = new YTMp3Tax();

/**
 * PLUGIN EXPORT (Untuk server.js)
 */
module.exports = {
    name: "yt mp3 downloader",
    desc: "mendownload audio dari youtube",
    category: "downloader",
    method: "GET",
    path: "/ytmp3",
    params: ["url"], // Hanya menampilkan URL di dokumentasi api/info
    example: "/downloader/ytmp3?url=https://www.youtube.com/watch?v=gzsrwM5Dhs0",
    
    run: async (req, res) => {
        const { url } = req.query;

        // Validasi input
        if (!url) {
            return res.status(400).json({
                status: false,
                message: "masukkan parameter 'url' toutube"
            });
        }

        // Validasi URL YouTube sederhana
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({
                status: false,
                message: "url yang anda masukkan bukan link youtube yang valid."
            });
        }

        try {
            const data = await scraper.fetchDownload(url);

            res.status(200).json({
                status: true,
                creator: "haikal"
                author: "yt mp3",
                result: {
                    title: data.title,
                    duration: data.duration,
                    thumbnail: data.thumbnail,
                    quality: "128kbps",
                    downloadUrl: data.downloadUrl
                }
            });
        } catch (error) {
            console.error("yt-mp3 error:", error.message);
            res.status(500).json({
                status: false,
                message: "terjadi kesalahan: " + error.message
            });
        }
    }
};