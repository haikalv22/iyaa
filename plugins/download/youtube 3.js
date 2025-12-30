const axios = require("axios");

// --- Fungsi Asli dari Snippet Kamu ---
async function meow(url) {
  try {
    const res = await axios.post(
      "https://www.meowtxt.com/api/video-info",
      { url },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
          "Referer": "https://www.meowtxt.com/convert/yt-to-mp3"
        }
      }
    );

    const d = res.data;
    const formats = d.formats || [];

    const audio = formats.find(v => v.hasAudio && !v.hasVideo) || null;
    const video = formats.find(v => v.hasAudio && v.hasVideo) || null;

    return {
      status: 200,
      video_id: d.videoId || null,
      title: d.title || null,
      duration: d.duration || null,
      author: d.author || d.uploader || null,
      thumbnail: d.thumbnailUrl || null,
      views: d.viewCount || null,
      upload_date: d.uploadDate || null,
      description: d.description || null,
      audio_url: audio?.url || null,
      video_url: video?.url || null
    };
  } catch (error) {
    console.error("Meow API Error:", error.message);
    return { status: 500, message: "Gagal mengambil data dari sumber." };
  }
}

// --- Integrasi ke Server.js ---
module.exports = {
  name: "YouTube Downloader",
  desc: "Download Audio (MP3) & Video (MP4) dari YouTube",
  method: "GET",       // Kita gunakan GET agar mudah diakses via browser
  category: "downloader",
  path: "/youtube33",    // Nanti akan jadi /downloader/youtube
  params: [
    { name: "url", required: true }
  ],
  example: "/downloader/youtube?url=https://youtu.be/hz76_oCcOy4",
  
  // Fungsi utama yang dijalankan server.js
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi!"
      });
    }

    try {
      const result = await meow(url);
      
      if (result.status !== 200) {
        return res.status(500).json({
          status: false,
          message: result.message || "Terjadi kesalahan pada server lain."
        });
      }

      res.status(200).json({
        status: true,
        creator: "API Server",
        result: result
      });

    } catch (e) {
      res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: e.message
      });
    }
  }
};