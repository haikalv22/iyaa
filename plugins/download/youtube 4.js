const axios = require('axios');
const crypto = require('crypto');

// --- Helper Functions ---
const ranHash = () => crypto.randomBytes(16).toString('hex');
const encodeData = (text) => text.split('').map(char => String.fromCharCode(char.charCodeAt(0) ^ 1)).join('');
const encodePath = (text) => text.split('').map(char => char.charCodeAt(0)).reverse().join(',');

const getApiEndpoint = (format, mp3Quality) => {
    if (format === '1') return 'https://api5.apiapi.lat';
    if (mp3Quality === '128') return 'https://api.apiapi.lat';
    return 'https://api3.apiapi.lat';
};

// --- Class Scraper ---
class OgMp3Scraper {
    constructor() {
        this.headers = {
            'accept': '*/*',
            'accept-language': 'id,en;q=0.9',
            'content-type': 'application/json',
            'origin': 'https://ogmp3.pw',
            'referer': 'https://ogmp3.pw/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
        };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async convert(youtubeUrl, format = '0', quality = '128') {
        try {
            const apiEndPoint = getApiEndpoint(format, quality);
            const pathEncoded = encodePath(youtubeUrl);
            const bodyEncoded = encodeData(youtubeUrl);
            const initUrl = `${apiEndPoint}/${ranHash()}/init/${pathEncoded}/${ranHash()}/`;
            
            const payload = {
                data: bodyEncoded,
                format: format,
                referer: "https://ogmp3.pw/",
                mp3Quality: quality,
                mp4Quality: format === '1' ? quality : "720",
                userTimeZone: "-420"
            };

            const { data: initData } = await axios.post(initUrl, payload, { headers: this.headers });
            
            if (!initData || initData.error) {
                throw new Error('Gagal inisialisasi convert atau URL tidak valid.');
            }

            let taskData = initData;
            let attempt = 0;
            const maxAttempts = 30; // Max tunggu sekitar 60 detik

            // Polling status
            while (taskData.s === 'P' && attempt < maxAttempts) {
                attempt++;
                // Kita tidak menggunakan console.log di sini agar log server bersih, 
                // tapi proses tetap berjalan.
                await this.sleep(2000);
                
                const statusUrl = `${apiEndPoint}/${ranHash()}/status/${taskData.i}/${ranHash()}/`;
                const { data: statusRes } = await axios.post(statusUrl, { data: taskData.i }, { headers: this.headers });
                
                taskData = statusRes;
            }

            if (taskData.s === 'C') {
                const downloadUrl = `${apiEndPoint}/${ranHash()}/download/${taskData.i}/${ranHash()}/`;
                return {
                    status: true,
                    message: 'Success',
                    result: {
                        title: taskData.t || 'Unknown Title',
                        format: format === '1' ? 'MP4' : 'MP3',
                        quality: quality,
                        download_url: downloadUrl
                    }
                };
            } else {
                return {
                    status: false,
                    message: 'Timeout: Proses konversi memakan waktu terlalu lama.',
                    data: taskData
                };
            }
        } catch (error) {
            return {
                status: false,
                message: error.message
            };
        }
    }
}

// --- Integrasi Plugin ke Server.js ---
module.exports = {
    name: 'OGMP3 Youtube Downloader',
    desc: 'Download Audio (MP3) atau Video (MP4) dari YouTube via OGMP3',
    method: 'GET',
    category: 'downloader',
    path: '/ogmp3', 
    // Parameter yang dibutuhkan untuk dokumentasi otomatis server.js Anda
    params: [
        { name: 'url', required: true },
        { name: 'type', required: false }, // 'mp3' atau 'mp4'
        { name: 'quality', required: false } // '128', '320', '720', dll
    ], 
    example: '/downloader/ogmp3?url=https://www.youtube.com/watch?v=ASsXs-sVaFw&type=mp3&quality=128',

    run: async (req, res) => {
        const { url, type, quality } = req.query;

        // Validasi input
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter URL diperlukan. Contoh: ?url=https://youtu.be/...'
            });
        }

        // Mapping parameter user ke parameter internal scraper
        // Default ke MP3 (0) jika tidak ditentukan
        let formatCode = '0'; 
        if (type && type.toLowerCase() === 'mp4') {
            formatCode = '1';
        }

        // Default quality logic
        let qualityCode = quality || '128';
        // Jika MP4 dan user tidak set quality, default ke 720
        if (formatCode === '1' && !quality) {
            qualityCode = '720';
        }

        try {
            const scraper = new OgMp3Scraper();
            const result = await scraper.convert(url, formatCode, qualityCode);

            if (result.status) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }

        } catch (e) {
            res.status(500).json({
                status: false,
                message: 'Internal Server Error',
                error: e.message
            });
        }
    }
};