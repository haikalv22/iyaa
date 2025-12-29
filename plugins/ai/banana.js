const axios = require("axios");

// User Agent tetap sama
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36";

// --- FUNGSI HELPER (Ditaruh di luar module.exports agar rapi) ---

async function obtenerTurnstileToken() {
    const { data } = await axios.post(
        "https://api.nekolabs.web.id/tools/bypass/cf-turnstile",
        {
            url: "https://image-editor.org/editor",
            siteKey: "0x4AAAAAACE-XLGoQUckKKm_"
        },
        {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": UA
            }
        }
    );
    if (!data.success) throw new Error("Gagal mendapatkan Turnstile Token");
    return data.result;
}

async function obtenerUpload(filename) {
    const { data } = await axios.post(
        "https://image-editor.org/api/upload/presigned",
        {
            filename,
            contentType: "image/jpeg"
        },
        {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": UA,
                Referer: "https://image-editor.org/editor"
            }
        }
    );
    return data.data;
}

// Dimodifikasi untuk menerima Buffer (bukan path file)
async function subirImagen(uploadUrl, buffer) {
    await axios.put(uploadUrl, buffer, {
        headers: {
            "Content-Type": "image/jpeg"
        }
    });
}

async function editarImagen(fileUrl, uploadId, turnstileToken, prompt) {
    const { data } = await axios.post(
        "https://image-editor.org/api/edit",
        {
            prompt: prompt,
            image_urls: [fileUrl],
            image_size: "9:16",
            turnstileToken,
            uploadIds: [uploadId],
            userUUID: "1e793048-8ddd-4eae-bc23-c613bf1711d7",
            imageHash: "fec2dfa087b064d080801fcc1ffc9ff09fe01f221ce0ffc07fd03fe084fe003c"
        },
        {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": UA,
                Referer: "https://image-editor.org/editor",
                Origin: "https://image-editor.org"
            }
        }
    );
    return data.data.taskId;
}

async function esperarResultado(taskId) {
    let attempts = 0;
    while (attempts < 60) { // Max 60 detik timeout
        const { data } = await axios.get(
            `https://image-editor.org/api/task/${taskId}`,
            {
                headers: {
                    "User-Agent": UA,
                    Referer: "https://image-editor.org/editor"
                }
            }
        );

        if (data.data.status === "completed") {
            return data.data.result[0];
        }

        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    throw new Error("Timeout menunggu hasil editing.");
}

// --- STRUKTUR PLUGIN ---

module.exports = {
    name: "AI Image Editor",
    desc: "Edit gambar menggunakan prompt AI (Via Image-Editor.org)",
    method: "GET",
    category: "ai",
    path: "/editor",
    params: ["url", "prompt"], // Parameter yang dibutuhkan
    
    run: async (req, res) => {
        const { url, prompt } = req.query;

        // Validasi Input
        if (!url) return res.json({ status: false, message: "Parameter 'url' wajib diisi!" });
        if (!prompt) return res.json({ status: false, message: "Parameter 'prompt' wajib diisi!" });

        try {
            // 1. Download Gambar dari URL User menjadi Buffer
            const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            
            // 2. Dapatkan Token Turnstile
            const turnstileToken = await obtenerTurnstileToken();

            // 3. Dapatkan URL Upload Presigned
            const randomName = `image_${Date.now()}.jpg`;
            const upload = await obtenerUpload(randomName);

            // 4. Upload Gambar User ke Server Editor
            await subirImagen(upload.uploadUrl, imageBuffer);

            // 5. Kirim Perintah Edit
            const taskId = await editarImagen(
                upload.fileUrl,
                upload.uploadId,
                turnstileToken,
                prompt
            );

            // 6. Polling Hasil
            const hasilUrl = await esperarResultado(taskId);

            // 7. Kirim Response JSON
            res.json({
                status: true,
                message: "Berhasil mengedit gambar",
                result: {
                    original_url: url,
                    prompt: prompt,
                    edited_url: hasilUrl
                }
            });

        } catch (error) {
            console.error(error);
            res.json({
                status: false,
                message: "Terjadi kesalahan saat memproses gambar.",
                error: error.message
            });
        }
    }
};