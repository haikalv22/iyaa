const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

// Fungsi utama Videy (disesuaikan untuk menerima Buffer)
async function uploadToVidey(buffer, filename = 'media.mp4') {
    try {
        const form = new FormData();
        form.append('file', buffer, {
            filename: filename,
            contentType: 'video/mp4' // Bisa dibuat dinamis jika perlu
        });

        const r = await axios.post(
            'https://videy.co/api/upload?visitorId=' + crypto.randomUUID(),
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
                    'origin': 'https://videy.co',
                    'referer': 'https://videy.co/',
                    'accept': 'application/json'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        return { 
            status: true,
            result: r.data 
        };

    } catch (e) {
        return { status: false, msg: e.message };
    }
}

module.exports = {
    // Metadata Plugin (Wajib ada agar terbaca server.js)
    name: "videy uploader",
    desc: "upload media (video/audio) ke server videy via url",
    method: "GET",       // Menggunakan GET karena kita mengambil param URL
    category: "tools",
    path: "/videy",      // Endpoint nanti jadi: /api/downloader/videy
    params: ["url"],     // Agar muncul di dokumentasi /api/info
    
    // Fungsi Eksekusi Utama
    run: async (req, res) => {
        const { url } = req.query;

        // Validasi input
        if (!url) {
            return res.status(400).json({
                status: false,
                message: "parameter 'url' diperlukan"
            });
        }

        try {
            // 1. Download dulu konten dari URL yang user kirim
            const response = await axios.get(url, { 
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            // 2. Upload ke Videy
            const videyResult = await uploadToVidey(response.data);

            // 3. Kirim respon ke user
            if (videyResult.status) {
                res.json({
                    status: true,
                    creator: "haikal",
                    data: videyResult.result
                });
            } else {
                res.json({
                    status: false,
                    message: "gagal upload ke videy",
                    error: videyResult.msg
                });
            }

        } catch (error) {
            res.status(500).json({
                status: false,
                message: "terjadi kesalahan saat memproses permintaan",
                error: error.message
            });
        }
    }
};