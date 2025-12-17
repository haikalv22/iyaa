const https = require('https');
const crypto = require('crypto');

// --- Helper Functions dari Kode Asli Anda ---
function _0x3a24() {
    let e = ["error", "6C35BBC4EB", "32065fiPRVJ", "9651PJDqag", "match", "2949160OwuPPs", "1QaLwoE", "subtle", "15775023ibpdbH", "or:", "gMUfw", "12IfiARR", "importKey", "3235491JMTwmH", "334826TTrbVe", "10zgbCLj", "Format err", "2719575PhDuLf", "592dZwFMH", "7584E4A29F", "Invalid fo", "on failed:", "YrlUc", "crypto", "AES-CBC", "map"];
    return (_0x3a24 = function () { return e; })();
}
function _0x5ec9(e, t) {
    let a = _0x3a24();
    return (_0x5ec9 = function (e, t) { return a[(e -= 450)]; })(e, t);
}

const C = _0x5ec9;
const k = "C5D58EF67A" + C(456) + C(464) + "12";

const formatSeed = (e) => {
    let a = e[C(467)](/[\dA-F]{2}/gi);
    let s = a[C(462)]((e) => parseInt(e, 16));
    return Buffer.from(s);
};

const processIncoming = async (e) => {
    let t = Buffer.from(e.replace(/\s/g, ""), 'base64');
    let a = t.slice(0, 16);
    let s = t.slice(16);
    let n = formatSeed(k);
    const decipher = crypto.createDecipheriv('aes-128-cbc', n, a);
    let decrypted = Buffer.concat([decipher.update(s), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
};

// --- Class Scraper ---
class YTMp3Tax {
    constructor() {
        this.cdnBaseUrl = 'https://media.savetube.me/api/random-cdn';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
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
                path: urlObj.pathname,
                method: method,
                headers: { ...this.headers, 'Host': urlObj.hostname }
            };
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } 
                    catch (e) { reject(new Error('Failed to parse JSON')); }
                });
            });
            req.on('error', (e) => reject(e));
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }

    async download(youtubeUrl, type = 'audio', quality = '128') {
        const cdnRes = await this.makeRequest(this.cdnBaseUrl);
        const cdnUrl = cdnRes.cdn.startsWith('http') ? cdnRes.cdn : `https://${cdnRes.cdn}`;
        
        const info = await this.makeRequest(`${cdnUrl}/v2/info`, 'POST', { url: youtubeUrl });
        if (!info.status) throw new Error(info.message);

        const decryptedData = await processIncoming(info.data);
        const dlRes = await this.makeRequest(`${cdnUrl}/download`, 'POST', {
            downloadType: type,
            quality: quality,
            key: decryptedData.key
        });

        return dlRes;
    }
}

const scraper = new YTMp3Tax();

// --- EXPORT PLUGIN UNTUK SERVER.JS ---
module.exports = {
    name: "YouTube Downloader Tax",
    desc: "Download YouTube MP3 atau MP4 menggunakan API YTMp3.tax",
    category: "Downloader",
    method: "GET",
    path: "/ytmp3",
    params: [
        { name: "url", required: true },
        { name: "type", required: false }, // audio atau video
        { name: "quality", required: false }
    ],
    example: "/downloader/ytmp3?url=https://youtu.be/gzsrwM5Dhs0",
    run: async (req, res) => {
        const { url, type, quality } = req.query;

        if (!url) {
            return res.status(400).json({ 
                status: false, 
                message: "Parameter 'url' wajib diisi." 
            });
        }

        try {
            const result = await scraper.download(url, type || 'audio', quality || '128');
            
            res.json({
                status: true,
                author: "Rest API",
                result: {
                    title: result.data.title,
                    duration: result.data.duration,
                    downloadUrl: result.data.downloadUrl,
                    quality: quality || '128',
                    type: type || 'audio'
                }
            });
        } catch (error) {
            res.status(500).json({ 
                status: false, 
                message: error.message 
            });
        }
    }
};