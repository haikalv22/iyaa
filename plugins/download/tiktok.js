// plugins/Downloader/tiktok.js
const axios = require("axios");

module.exports = {
  name: "tiktok downloader",
  desc: "download video tiktok tanpa watermark",
  category: "downloader",
  method: "GET",
  path: "/tiktok",
  params: ["url"],
  example: "https://domainweb.com/downloader/tiktok?url=https://tiktok.com/@user/video/123456789",

  async run(req, res) {
    const { url } = req.query;

    // Validasi URL
    if (!url || !/^https?:\/\/(www\.)?(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|m\.tiktok\.com)\/.+/i.test(url)) {
      return res.status(400).json({
        status: false,
        message: "masukkan parameter ?url= tiktok yang valid.",
        contoh: "?url=https://www.tiktok.com/@username/video/123456789"
      });
    }

    try {
      // Ganti dengan API key RapidAPI Anda
      const apiKey = "ca5c6d6fa3mshfcd2b0a0feac6b7p140e57jsn72684628152a";
      
      const { data } = await axios.get("https://tiktok-scraper7.p.rapidapi.com", {
        headers: {
          "Accept-Encoding": "gzip",
          Connection: "Keep-Alive",
          Host: "tiktok-scraper7.p.rapidapi.com",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
          "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com",
          "X-RapidAPI-Key": apiKey,
        },
        params: {
          url: url,
          hd: "1",
        },
      });

      // Format response yang rapi
      res.json({
        status: true,
        creator: "haikal",
        data: {
          url_original: url,
          download_url: data.data?.play || data.data?.hdplay || data.data?.url,
          judul: data.data?.title || "tiktok video",
          durasi: data.data?.duration,
          ukuran: data.data?.size,
          kualitas: data.data?.hd ? "HD" : "SD"
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: "tiktok scraper api"
        }
      });
    } catch (error) {
      console.error("tiktok download error:", error.message);
      res.status(500).json({
        status: false,
        message: "gagal mengambil data tiktok",
        error: error.response?.data?.message || error.message,
        timestamp: new Date().toISOString()
      });
    }
  },
};
