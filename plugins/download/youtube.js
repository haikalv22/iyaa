const axios = require("axios");
const cheerio = require("cheerio");
const qs = require("qs");

// --- Fungsi Scraper YeteeDeel ---
async function YeteeDeel(youtubeUrl) {
    const postData = qs.stringify({
        url: youtubeUrl
    });

    const { data: html } = await axios.post(
        "https://www.mediamister.com/get_youtube_video",
        postData,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "*/*",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": "Mozilla/5.0"
            },
            timeout: 20000
        }
    );

    const $ = cheerio.load(html);

    const thumbnail = $(".yt_thumb img").attr("src") || null;
    const title = $("h2").first().text().trim();

    const videos = [];
    $(".yt_format")
        .first()
        .find("a.download-button")
        .each((_, el) => {
            const a = $(el);
            videos.push({
                quality: a.text().replace(/\s+/g, " ").trim(),
                url: a.attr("href"),
                format: a.attr("href")?.includes("mime=video/webm")
                    ? "webm"
                    : "mp4"
            });
        });

    const audios = [];
    $(".yt_format")
        .last()
        .find("a.download-button.audio")
        .each((_, el) => {
            const a = $(el);
            audios.push({
                quality: a.text().replace(/\s+/g, " ").trim(),
                url: a.attr("href"),
                format: a.attr("href")?.includes("mime=audio/webm")
                    ? "webm"
                    : "m4a"
            });
        });

    if (!title && videos.length === 0) {
        throw new Error("Gagal mengambil data video. Pastikan URL valid atau coba lagi nanti.");
    }

    return {
        title,
        thumbnail,
        videos,
        audios
    };
}

// --- Integrasi ke Server ---
module.exports = {
    name: "YouTube Downloader",
    desc: "Download Video & Audio dari YouTube",
    method: "GET",       // Menggunakan method GET agar mudah diakses via browser/url
    path: "/youtube",    // Endpoint path
    category: "downloader",
    // Parameter yang dibutuhkan (sesuai logika server.js Anda)
    params: [
        { name: 'url', required: true }
    ],
    // Contoh penggunaan untuk dokumentasi
    example: "/api/downloader/youtube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    
    // Logika Utama
    run: async (req, res) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'url' diperlukan!"
            });
        }

        try {
            // Panggil fungsi scraper
            const result = await YeteeDeel(url);

            return res.status(200).json({
                status: true,
                message: "Berhasil mengambil data video",
                result: result
            });

        } catch (error) {
            console.error("Error YouTube DL:", error);
            return res.status(500).json({
                status: false,
                message: "Terjadi kesalahan saat mengambil data",
                error: error.message
            });
        }
    }
};