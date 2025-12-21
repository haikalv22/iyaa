const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const os = require('os'); // Import module OS

const baseApi = "https://api.unblurimage.ai";

async function jsonFetch(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { return { __httpError: true, status: res.status, raw: text }; }
    if (!res.ok) return { __httpError: true, status: res.status, raw: json };
    return json;
}

async function upscaleVideo(videoPath) {
    const productSerial = crypto.randomUUID().replace(/-/g, "");
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    try {
        const uploadForm = new FormData();
        uploadForm.append("video_file_name", `cli-${Date.now()}.mp4`);

        const uploadResp = await axios.post(
            `${baseApi}/api/upscaler/v1/ai-video-enhancer/upload-video`,
            uploadForm,
            { headers: uploadForm.getHeaders() }
        ).then(r => r.data)
         .catch(e => ({ __httpError: true, status: e.response?.status, raw: e.response?.data }));

        if (uploadResp.__httpError || uploadResp.code !== 100000) throw new Error(`Gagal upload init. Code: ${uploadResp.code}`);

        const { url: uploadUrl, object_name } = uploadResp.result || {};
        if (!uploadUrl || !object_name) throw new Error("No upload URL.");

        const fileStream = fs.createReadStream(videoPath);
        await axios.put(uploadUrl, fileStream, { 
            headers: { 
                "content-type": "video/mp4",
                "Content-Length": fs.statSync(videoPath).size 
            } 
        });

        const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;
        const jobForm = new FormData();
        jobForm.append("original_video_file", cdnUrl);
        jobForm.append("resolution", "2k");
        jobForm.append("is_preview", "false");

        const createJobResp = await axios.post(
            `${baseApi}/api/upscaler/v2/ai-video-enhancer/create-job`,
            jobForm,
            { headers: { ...jobForm.getHeaders(), "product-serial": productSerial, authorization: "" } }
        ).then(r => r.data)
         .catch(e => ({ __httpError: true, status: e.response?.status, raw: e.response?.data }));

        if (createJobResp.__httpError || createJobResp.code !== 100000) throw new Error(`Gagal create job. Code: ${createJobResp.code}`);

        const { job_id } = createJobResp.result || {};
        const maxTotalWaitMs = 5 * 60 * 1000;
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
                if (jobResp.code === 100000) { result = jobResp.result || {}; if (result.output_url) break; }
                else if (jobResp.code !== 300010) throw new Error(`Job error. Code: ${jobResp.code}`);
            }

            if (Date.now() - startTime > maxTotalWaitMs) throw new Error("Timeout.");
            await sleep(attempt === 1 ? 20000 : 5000);
        }

        return result.output_url;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    name: "hd video",
    desc: "meningkatkan kualitas video menjadi HD/2K",
    category: "tools",
    method: "GET",
    path: "/hdvid",
    params: ["url"],
    run: async (req, res) => {
        const { url } = req.query;
        if (!url) return res.status(400).json({ status: false, message: "parameter 'url' diperlukan." });

        // --- PERBAIKAN DI SINI ---
        // Menggunakan os.tmpdir() yang aman untuk Serverless/Vercel/Local
        const tempFileName = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);
        // -------------------------

        try {
            const writer = fs.createWriteStream(tempFilePath);
            const response = await axios({ url, method: 'GET', responseType: 'stream' });
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const resultUrl = await upscaleVideo(tempFilePath);

            res.json({
                status: true,
                creator: "haikal",
                message: "success",
                result: { original: url, hd: resultUrl }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ status: false, message: error.message });
        } finally {
            // Selalu hapus file temp setelah selesai
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    }
};