const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// --- Fungsi Utama Upscale (Dari kode Anda) ---
async function imgupscale(image, { scale = 4 } = {}) {
    try {
        const scales = [1, 4, 8, 16];
        
        if (!Buffer.isBuffer(image)) throw new Error('Image must be a buffer.');
        if (!scales.includes(scale) || isNaN(scale)) throw new Error(`Available scale options: ${scales.join(', ')}.`);
        
        const identity = uuidv4();
        const inst = axios.create({
            baseURL: 'https://supawork.ai/supawork/headshot/api',
            headers: {
                authorization: 'null',
                origin: 'https://supawork.ai/',
                referer: 'https://supawork.ai/ai-photo-enhancer',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36',
                'x-auth-challenge': '',
                'x-identity-id': identity
            }
        });
        
        const { data: up } = await inst.get('/sys/oss/token', {
            params: {
                f_suffix: 'png',
                get_num: 1,
                unsafe: 1
            }
        });
        
        const img = up?.data?.[0];
        if (!img) throw new Error('Upload url not found.');
        
        await axios.put(img.put, image);
        
        const { data: cf } = await axios.post('https://api.nekolabs.web.id/tools/bypass/cf-turnstile', {
            url: 'https://supawork.ai/ai-photo-enhancer',
            siteKey: '0x4AAAAAACBjrLhJyEE6mq1c'
        });
        
        if (!cf?.result) throw new Error('Failed to get cf token.');
        
        const { data: t } = await inst.get('/sys/challenge/token', {
            headers: {
                'x-auth-challenge': cf.result
            }
        });
        
        if (!t?.data?.challenge_token) throw new Error('Failed to get token.');
        
        const { data: task } = await inst.post('/media/image/generator', {
            aigc_app_code: 'image_enhancer',
            model_code: 'supawork-ai',
            image_urls: [img.get],
            extra_params: {
                scale: parseInt(scale)
            },
            currency_type: 'silver',
            identity_id: identity
        }, {
            headers: {
                'x-auth-challenge': t.data.challenge_token
            }
        });
        
        if (!task?.data?.creation_id) throw new Error('failed to create task.');
        
        while (true) {
            const { data } = await inst.get('/media/aigc/result/list/v1', {
                params: {
                    page_no: 1,
                    page_size: 10,
                    identity_id: identity
                }
            });
            
            const list = data?.data?.list?.[0]?.list?.[0];
            if (list && list.status === 1) return list.url; // Added check for list existence
            
            await new Promise(res => setTimeout(res, 1000));
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

// --- Format Module Exports untuk Server.js ---
module.exports = {
    name: "supawork Image upscale",
    desc: "meningkatkan resolusi (HD) gambar menggunakan ai",
    category: "tools",
    method: "GET",
    path: "/upscale",
    params: ["url", "scale"], // Parameter yang akan muncul di dokumentasi
    example: "/tools/upscale?url=https://example.com/foto.jpg&scale=4",
    
    run: async (req, res) => {
        const { url, scale } = req.query;

        // 1. Validasi Parameter
        if (!url) {
            return res.status(400).json({
                status: false,
                message: "parameter 'url' wajib diisi!"
            });
        }

        // Default scale ke 4 jika tidak diisi user
        const scaleInt = scale ? parseInt(scale) : 4;
        const allowedScales = [1, 4, 8, 16];
        
        if (!allowedScales.includes(scaleInt)) {
             return res.status(400).json({
                status: false,
                message: `scale tidak valid. pilihan: ${allowedScales.join(', ')}`
            });
        }

        try {
            // 2. Download Gambar dari URL ke Buffer
            // Karena fungsi imgupscale butuh Buffer, kita download dulu gambarnya
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            // 3. Panggil Fungsi Upscale
            const resultUrl = await imgupscale(buffer, { scale: scaleInt });

            // 4. Kirim Respon JSON
            res.json({
                status: true,
                creator: "haikal",
                message: "berhasil meningkatkan resolusi gambar",
                result: {
                    original_url: url,
                    scale: scaleInt,
                    hd_url: resultUrl
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                status: false,
                message: "terjadi kesalahan saat memproses gambar",
                error: error.message
            });
        }
    }
};