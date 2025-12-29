const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { basename } = require('path');

const BASE_URL = 'https://imgeditor.co';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
    'dnt': '1',
    'sec-ch-ua-mobile': '?1',
    'origin': BASE_URL,
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'referer': `${BASE_URL}/generator`,
    'accept-language': 'id,en-US;q=0.9,en;q=0.8,ja;q=0.7',
    'priority': 'u=1, i'
};

const imgeditor = {
    getPresign: async (fileName, contentType = 'image/jpeg', fileSize) => {
        try {
            const response = await axios.post(
                `${BASE_URL}/api/get-upload-url`,
                { fileName, contentType, fileSize },
                { headers: { ...HEADERS, 'Content-Type': 'application/json' } }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get presigned URL: ${error.message}`);
        }
    },

    upload: async (uploadUrl, fileData, contentType = 'image/jpeg') => {
        try {
            const response = await axios.put(uploadUrl, fileData, {
                headers: {
                    'User-Agent': HEADERS['User-Agent'],
                    'Accept-Encoding': HEADERS['Accept-Encoding'],
                    'Content-Type': contentType,
                    'sec-ch-ua-platform': HEADERS['sec-ch-ua-platform'],
                    'sec-ch-ua': HEADERS['sec-ch-ua'],
                    'DNT': HEADERS['dnt'],
                    'sec-ch-ua-mobile': HEADERS['sec-ch-ua-mobile'],
                    'Origin': BASE_URL,
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    'Referer': `${BASE_URL}/`,
                    'Accept-Language': HEADERS['accept-language']
                }
            });
            return { success: response.status === 200, etag: response.headers.etag };
        } catch (error) {
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    },

    submit: async (options) => {
        const {
            prompt,
            imageUrl,
            styleId = 'realistic',
            mode = 'image',
            imageSize = 'auto',
            quality = 'standard',
            numImages = 1,
            outputFormat = 'png',
            model = 'nano-banana'
        } = options;

        try {
            const response = await axios.post(
                `${BASE_URL}/api/generate-image`,
                { prompt, styleId, mode, imageUrl, imageUrls: [imageUrl], imageSize, quality, numImages, outputFormat, model },
                { headers: { ...HEADERS, 'Content-Type': 'application/json' } }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to submit generation: ${error.message}`);
        }
    },

    status: async (taskId) => {
        try {
            const response = await axios.get(`${BASE_URL}/api/generate-image/status`, {
                params: { taskId },
                headers: HEADERS
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to check status: ${error.message}`);
        }
    },

    // Dimodifikasi untuk menerima Buffer langsung agar lebih cepat di server
    createFromBuffer: async (buffer, prompt, options = {}, pollInterval = 5000) => {
        try {
            const fileName = `upload_${Date.now()}.jpg`;
            const contentType = 'image/jpeg';
            const fileSize = buffer.length;

            const presignData = await imgeditor.getPresign(fileName, contentType, fileSize);
            await imgeditor.upload(presignData.uploadUrl, buffer, contentType);

            const submitData = await imgeditor.submit({
                prompt,
                imageUrl: presignData.publicUrl,
                ...options
            });

            let statusData;
            let attempts = 0;
            const maxAttempts = 60; 
            
            while (attempts < maxAttempts) {
                statusData = await imgeditor.status(submitData.taskId);

                if (statusData.status === 'completed') {
                    return {
                        imageUrl: statusData.imageUrl,
                        taskId: submitData.taskId,
                        completedAt: statusData.completedAt
                    };
                } else if (statusData.status === 'failed') {
                    throw new Error(`Generation failed: ${statusData.error || 'Unknown error'}`);
                }
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                attempts++;
            }
            throw new Error('Generation timeout after 5 minutes');
        } catch (error) {
            throw new Error(`Create failed: ${error.message}`);
        }
    }
};

// --- STRUKTUR PLUGIN SESUAI SERVER.JS ---
module.exports = {
    name: 'hytamkan orang',
    desc: 'mengubah warna kulit subjek dalam gambar menjadi hitam (black skin filter)',
    method: 'GET',
    category: 'ai',
    path: '/hytamkan',
    params: [
        { name: 'url', required: true }
    ],
    example: '/api/ai/hytamkan?url=https://example.com/foto.jpg',
    
    run: async (req, res) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter "url" wajib diisi.'
            });
        }

        try {
            // 1. Download gambar dari URL user ke Buffer
            const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
            const inputBuffer = Buffer.from(imageResponse.data);

            // 2. Proses menggunakan imgeditor
            // Prompt hardcoded sesuai request awal: 'Change his skin color to black'
            const result = await imgeditor.createFromBuffer(inputBuffer, 'Change his skin color to black');

            // 3. Download hasil jadi (karena result.imageUrl adalah link eksternal)
            const finalImage = await axios.get(result.imageUrl, { responseType: 'arraybuffer' });
            
            // 4. Kirim sebagai gambar (Content-Type image/png)
            res.set('Content-Type', 'image/png');
            res.send(Buffer.from(finalImage.data));

        } catch (error) {
            console.error(error);
            res.status(500).json({
                status: false,
                message: 'Gagal memproses gambar.',
                error: error.message
            });
        }
    }
};