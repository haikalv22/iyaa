const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// Base URL API External
const baseApi = "https://api.unblurimage.ai";

// Fungsi Helper: Fetch JSON wrapper
async function jsonFetch(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { return { __httpError: true, status: res.status, raw: text }; }
    if (!res.ok) return { __httpError: true, status: res.status, raw: json };
    return json;
}

// Fungsi Utama: Logic Upscale (Diadaptasi dari kode asli Anda)
async function upscaleVideo(videoPath) {
    const productSerial = crypto.randomUUID().replace(/-/g, "");
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    try {
        // 1. Request Upload URL
        const uploadForm = new FormData();
        uploadForm.append("video_file_name", `cli-${Date.now()}.mp4`);

        const uploadResp = await axios.post(
            `${baseApi}/api/upscaler/v1/ai-video-enhancer/upload-video`,
            uploadForm,
            { headers: uploadForm.getHeaders() }
        ).then(r => r.data)
         .catch(e => ({ __httpError: true, status: e.response?.status, raw: e.response?.data }));

        if (uploadResp.__httpError || uploadResp.code !== 100000) {
            throw new Error(`Gagal meminta URL upload. Code: ${uploadResp.code || uploadResp.status}`);
        }

        const { url: uploadUrl, object_name } = uploadResp.result || {};
        if (!uploadUrl || !object_name) throw new Error("Tidak mendapatkan URL upload atau object name.");

        // 2. Upload Video ke URL yang didapat
        const fileStream = fs.createReadStream(videoPath);
        await axios.put(uploadUrl, fileStream, { 
            headers: { 
                "content-type": "video/mp4",
                "Content-Length": fs.statSync(videoPath).size 
            } 
        });

        // 3. Create Job Upscale
        const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;
        const jobForm = new FormData();
        jobForm.append("original_video_file", cdnUrl);
        jobForm.append("resolution", "2k"); // Default 2k
        jobForm.append("is_preview", "false");

        const createJobResp = await axios.post(
            `${baseApi}/api/upscaler/v2/ai-video-enhancer/create-job`,
            jobForm,
            { headers: { ...jobForm.getHeaders(), "product-serial": productSerial, authorization: "" } }
        ).then(r => r.data)
         .catch(e => ({ __httpError: true, status: e.response?.status, raw: e.response?.data }));

        if (createJobResp.__httpError || createJobResp.code !== 100000) {
            throw new Error(`Gagal membuat job. Code: ${createJobResp.code || createJobResp.status}`);
        }

        const { job_id } = createJobResp.result || {};
        if (!job_id) throw new Error("Job ID tidak ditemukan.");

        // 4. Polling Status (Menunggu hasil)
        const maxTotalWaitMs = 5 * 60 * 1000; // 5 menit timeout
        const startTime = Date.now();
        let attempt = 0;
        let result;

        while (true) {
            attempt++;
            const jobResp = await jsonFetch(`${baseApi}/api/upscaler/v2/ai-video-enhancer/get-job/${job_id}`, { 
                method: "GET", 
                headers: { "product-serial": productSerial, authorization: "" } 
            });

            if (!jobResp.__httpError) {
                if (jobResp.code === 100000) { 
                    result = jobResp.result || {}; 
                    if (result.output_url) break; // Selesai
                } else if (jobResp.code !== 300010) { // 300010 biasanya "processing"
                    throw new Error(`Job gagal atau status unknown. Code: ${jobResp.code}`);
                }
            }

            if (Date.now() - startTime > maxTotalWaitMs) {
                throw new Error("Timeout: Proses terlalu lama (> 5 menit).");
            }

            // Tunggu sebelum cek lagi
            const waitTime = attempt === 1 ? 20000 : 5000; // Interval polling
            await sleep(waitTime);
        }

        const { output_url } = result;
        if (output_url) return output_url;
        else throw new Error("Job selesai tapi URL output tidak ditemukan.");

    } catch (err) {
        throw err;
    }
}

// Ekspor Module sesuai standar server.js Anda
module.exports = {
    name: "AI Video Upscaler",
    desc: "Meningkatkan kualitas video menjadi HD/2K menggunakan AI",
    category: "AI", // Kategori folder
    method: "GET",
    path: "/unblur-video",
    params: ["url"], // Parameter yang dibutuhkan
    run: async (req, res) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' video diperlukan."
            });
        }

        // Path sementara untuk menyimpan video yang didownload
        const tempFileName = `temp_${Date.now()}.mp4`;
        const tempFilePath = path.join(__dirname, '../../tmp', tempFileName);

        // Pastikan folder tmp ada
        const tmpDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        try {
            // 1. Download video dari URL user ke server sementara
            const writer = fs.createWriteStream(tempFilePath);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // 2. Proses Upscale
            const resultUrl = await upscaleVideo(tempFilePath);

            // 3. Kirim Respon Sukses
            res.json({
                status: true,
                message: "Berhasil meningkatkan kualitas video",
                result: {
                    original_url: url,
                    hd_url: resultUrl
                }
            });

        } catch (error) {
            console.error("Error Unblur Video:", error);
            res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat memproses video.",
                error: error.message
            });
        } finally {
            // 4. Bersihkan file sampah (temp)
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }
};