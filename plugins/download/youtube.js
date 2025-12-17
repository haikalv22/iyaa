const axios = require('axios');

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
        
        // HAPUS FORMAT AUDIO, HANYA VIDEO SAJA
        this.videoFormats = ['4k', '1440', '1080', '720', '480', '320', '240', '144'];
        this.supportedFormats = [...this.videoFormats];
    }

    validateFormat(formatQuality) {
        return this.supportedFormats.includes(formatQuality);
    }

    async requestDownload(youtubeUrl, formatQuality) {
        // Jika format salah atau user input mp3, paksa balik ke 720 (Video)
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
                timeout: 10000 
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
            console.error("Error requesting download:", error.message);
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
            throw new Error("Gagal mendapatkan metadata video. Cek URL atau coba lagi.");
        }
        
        const downloadData = await this.checkProgress(progressData.progress_url);
        
        if (!downloadData) {
            throw new Error("Waktu habis saat memproses video.");
        }
        
        return {
            title: progressData.title,
            thumbnail: progressData.image,
            quality: formatQuality, // Info kualitas yang dipilih
            type: 'mp4', // Hardcoded karena sekarang khusus video
            download_url: downloadData.download_url
        };
    }
}

module.exports = {
    name: 'YouTube Video Downloader (MP4)',
    desc: 'Download Video MP4 dari YouTube (No Audio Support)',
    method: 'GET',
    category: 'Downloader',
    path: '/youtube',
    params: [
        { name: 'url', required: true },
        { name: 'format', required: false }
    ],
    example: '/downloader/youtube?url=https://www.youtube.com/watch?v=daQSMxfvelw&format=720',
    
    run: async (req, res) => {
        const { url, format } = req.query;
        
        // Inisialisasi class di awal untuk mengambil daftar format
        const downloader = new YouTubeDownloader();
        const availableFormats = downloader.videoFormats;

        if (!url) {
            return res.json({
                status: false,
                message: 'Parameter URL diperlukan.',
                available_formats: availableFormats // Tampilkan list format saat error/info
            });
        }

        const selectedFormat = format || '720';

        try {
            const result = await downloader.download(url, selectedFormat);

            return res.json({
                status: true,
                message: 'Berhasil mengambil data video',
                available_formats: availableFormats, // FITUR BARU: Menampilkan list format di sini
                result: result
            });

        } catch (error) {
            return res.json({
                status: false,
                message: error.message || 'Terjadi kesalahan internal',
                available_formats: availableFormats // Tetap tampilkan list meski error agar user tahu opsinya
            });
        }
    }
};