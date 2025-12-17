const axios = require('axios');

// --- Logika YouTube Downloader (Class) ---
class YouTubeDownloader {
    constructor() {
        this.baseUrl = 'https://p.savenow.to';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://y2down.cc/',
            'Origin': 'https://y2down.cc',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Priority': 'u=4',
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        };
        
        this.audioFormats = ['mp3', 'm4a', 'webm', 'aac', 'flac', 'opus', 'ogg', 'wav'];
        this.videoFormats = ['4k', '1440', '1080', '720', '480', '320', '240', '144'];
        this.supportedFormats = [...this.audioFormats, ...this.videoFormats];
    }

    validateFormat(formatQuality) {
        return this.supportedFormats.includes(formatQuality);
    }

    async requestDownload(youtubeUrl, formatQuality) {
        // Default ke 720 jika format salah
        if (!this.validateFormat(formatQuality)) {
            formatQuality = '720'; 
        }
    
        const params = {
            copyright: '0',
            format: formatQuality,
            url: youtubeUrl,
            api: 'dfcb6d76f2f6a9894gjkege8a4ab232222'
        };

        const downloadUrl = `${this.baseUrl}/ajax/download.php`;

        try {
            const response = await axios.get(downloadUrl, {
                params: params,
                headers: this.headers,
                timeout: 10000 // 10 detik timeout awal
            });

            if (response.data.progress_url) {
                return {
                    progress_url: response.data.progress_url,
                    title: response.data.info?.title || null,
                    image: response.data.info?.image || null
                };
            } else {
                return null;
            }

        } catch (error) {
            console.error("error requesting download:", error.message);
            return null;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkProgress(progressUrl, maxAttempts = 30, delay = 2000) {
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await axios.get(progressUrl, {
                    headers: this.headers,
                    timeout: 10000
                });

                const data = response.data;
                const text = data.text || '';
                const success = data.success || 0;
                const downloadUrl = data.download_url || '';

                if (downloadUrl && downloadUrl.trim() !== '') {
                    return { download_url: downloadUrl };
                }

                if (data.error || (success === 0 && text.toLowerCase().includes('error'))) {
                    return null;
                }

                attempts++;
                await this.sleep(delay);

            } catch (error) {
                attempts++;
                await this.sleep(delay);
            }
        }

        return null;
    }

    async download(youtubeUrl, formatQuality = '720') {
        const progressData = await this.requestDownload(youtubeUrl, formatQuality);
        
        if (!progressData) {
            throw new Error("gagal mendapatkan metadata video, cek url atau coba lagi.");
        }
        
        const downloadData = await this.checkProgress(progressData.progress_url);
        
        if (!downloadData) {
            throw new Error("waktu habis saat memproses video atau terjadi kesalahan server.");
        }
        
        return {
            title: progressData.title,
            thumbnail: progressData.image,
            format: formatQuality,
            download_url: downloadData.download_url
        };
    }
}

// --- Struktur Plugin untuk Server.js ---
module.exports = {
    name: 'youtube download',
    desc: 'download audio/video dari youtube menggunakan api',
    method: 'GET',
    category: 'download', // Akan menjadi /downloader/youtube
    path: '/youtube',
    // Parameter untuk dokumentasi otomatis
    params: [
        { name: 'url', required: true },
        { name: 'format', required: false }
    ],
    example: '/downloader/youtube?url=https://www.youtube.com/watch?v=daQSMxfvelw&format=mp3',
    
    // Fungsi utama yang dipanggil server.js
    run: async (req, res) => {
        const { url, format } = req.query;

        // 1. Validasi Input
        if (!url) {
            return res.json({
                status: false,
                message: 'parameter url diperlukan. contoh: ?url=https://youtube.com/watch?v=...'
            });
        }

        // Tentukan format default jika tidak diisi
        const selectedFormat = format || '720';

        try {
            // 2. Eksekusi Downloader
            const downloader = new YouTubeDownloader();
            const result = await downloader.download(url, selectedFormat);

            // 3. Kirim Response Sukses
            return res.json({
                status: true,
                creator: "haikal",
                message: 'berhasil mengambil data video',
                result: result
            });

        } catch (error) {
            // 4. Handle Error
            return res.json({
                status: false,
                message: error.message || 'terjadi kesalahan internal'
            });
        }
    }
};