const axios = require("axios");
const sizeOf = require("image-size"); // Library wajib diinstall

// User Agent
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36";

// Daftar ukuran yang didukung
const VALID_SHAPES = [
    "1:1", "16:9", "9:16", "5:4", "4:5", 
    "4:3", "3:4", "3:2", "2:3", "21:9"
];

// --- FUNGSI HELPER UTAMA ---

// Fungsi mencari shape yang paling mirip dengan gambar asli
function detectShape(buffer) {
    try {
        const dimensions = sizeOf(buffer);
        const ratio = dimensions.width / dimensions.height;
        
        // Cari shape yang rasionya paling mendekati
        let closestShape = "1:1";
        let minDiff = Infinity;

        VALID_SHAPES.forEach(shape => {
            const [w, h] = shape.split(":").map(Number);
            const shapeRatio = w / h;
            const diff = Math.abs(ratio - shapeRatio);

            if (diff < minDiff) {
                minDiff = diff;
                closestShape = shape;
            }
        });

        return closestShape;
    } catch (e) {
        console.error("Gagal mendeteksi ukuran, default ke 1:1", e);
        return "1:1";
    }
}

// --- FUNGSI API ---

async function obtenerTurnstileToken() {
    const { data } = await axios.post(
        "https://api.nekolabs.web.id/tools/bypass/cf-turnstile",
        { url: "https://image-editor.org/editor", siteKey: "0x4AAAAAACE-XLGoQUckKKm_" },
        { headers: { "Content-Type": "application/json", "User-Agent": UA } }
    );
    if (!data.success) throw new Error("Gagal mendapatkan Turnstile Token");
    return data.result;
}

async function obtenerUpload(filename) {
    const { data } = await axios.post(
        "https://image-editor.org/api/upload/presigned",
        { filename, contentType: "image/jpeg" },
        { headers: { "Content-Type": "application/json", "User-Agent": UA, Referer: "https://image-editor.org/editor" } }
    );
    return data.data;
}

async function subirImagen(uploadUrl, buffer) {
    await axios.put(uploadUrl, buffer, {
        headers: { "Content-Type": "image/jpeg" }
    });
}

async function editarImagen(fileUrl, uploadId, turnstileToken, prompt, imageSize) {
    const { data } = await axios.post(
        "https://image-editor.org/api/edit",
        {
            prompt: prompt,
            image_urls: [fileUrl],
            image_size: imageSize,
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
    while (attempts < 120) { 
        const { data } = await axios.get(
            `https://image-editor.org/api/task/${taskId}`,
            { headers: { "User-Agent": UA, Referer: "https://image-editor.org/editor" } }
        );
        if (data.data.status === "completed") return data.data.result[0];
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    throw new Error("Timeout menunggu hasil editing.");
}

// --- STRUKTUR PLUGIN ---

module.exports = {
    name: "AI Image Editor",
    desc: "Edit gambar dengan prompt (Otomatis mendeteksi ukuran)",
    method: "GET",
    category: "ai",
    path: "/editor",
    params: [
        { name: 'url', required: true },
        { name: 'prompt', required: true },
        { name: 'shape', required: false } // Opsional, jika kosong akan auto-detect
    ],
    example: "/ai/editor?url=https://example.com/foto.jpg&prompt=make it anime",
    
    run: async (req, res) => {
        let { url, prompt, shape } = req.query;

        if (!url) return res.json({ status: false, message: "Parameter 'url' wajib diisi!" });
        if (!prompt) return res.json({ status: false, message: "Parameter 'prompt' wajib diisi!" });

        // Validasi Manual Shape jika user mengisinya
        if (shape && !VALID_SHAPES.includes(shape)) {
            return res.json({ 
                status: false, 
                message: "Parameter 'shape' tidak valid.",
                available_shapes: VALID_SHAPES
            });
        }

        try {
            // 1. Download Gambar
            const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);

            // 2. AUTO DETECT SHAPE (Jika user tidak mengisi shape)
            let detectedShape = "1:1";
            let mode = "manual";

            if (!shape) {
                detectedShape = detectShape(imageBuffer);
                shape = detectedShape; // Gunakan hasil deteksi
                mode = "auto";
            }

            // 3. Proses API
            const turnstileToken = await obtenerTurnstileToken();
            const randomName = `image_${Date.now()}.jpg`;
            const upload = await obtenerUpload(randomName);
            
            await subirImagen(upload.uploadUrl, imageBuffer);

            const taskId = await editarImagen(
                upload.fileUrl,
                upload.uploadId,
                turnstileToken,
                prompt,
                shape
            );

            const hasilUrl = await esperarResultado(taskId);

            res.json({
                status: true,
                message: "Berhasil mengedit gambar",
                result: {
                    original_url: url,
                    prompt: prompt,
                    shape_mode: mode, // Info apakah manual atau auto
                    used_shape: shape, // Ukuran yang akhirnya dipakai
                    edited_url: hasilUrl
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat memproses gambar.",
                error: error.message
            });
        }
    }
};