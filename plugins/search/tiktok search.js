const axios = require("axios");

// --- FUNGSI HELPER SCRAPER ---

async function tiktokSearch(keywords) {
  try {
    const response = await axios({
      method: "POST",
      url: "https://tikwm.com/api/feed/search",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: "current_language=en",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
      },
      data: {
        keywords: keywords,
        count: 12, 
        cursor: 0,
        HD: 1,
      },
    });

    const videos = response?.data?.data?.videos;
    if (!videos || videos.length === 0) {
      throw new Error("tidak ada video ditemukan.");
    }

    // Mengambil 1 video secara acak dari hasil pencarian
    const selectedVideo = videos[Math.floor(Math.random() * videos.length)];

    return {
      type: "search_result",
      title: selectedVideo.title,
      cover: selectedVideo.cover,
      origin_cover: selectedVideo.origin_cover,
      no_watermark: selectedVideo.play,
      music: selectedVideo.music,
      author: selectedVideo.author,
      stats: {
        plays: selectedVideo.play_count,
        digg: selectedVideo.digg_count,
        comment: selectedVideo.comment_count,
        share: selectedVideo.share_count
      }
    };
  } catch (error) {
    throw new Error(`gagal mencari video: ${error.message}`);
  }
}

// --- KONFIGURASI PLUGIN ---

module.exports = {
  name: 'tiktok search',
  desc: 'cari video tiktok berdasarkan kata kunci',
  method: 'GET',
  path: '/tiktoksearch',
  category: 'search',
  params: ['text'],
  example: '/search/tiktoksearch?text=jedagjedug',
  
  run: async (req, res) => {
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        status: false,
        message: 'parameter "text" diperlukan.'
      });
    }

    try {
      const result = await tiktokSearch(text);

      res.json({
        status: true,
        creator: 'haikal',
        result: result
      });

    } catch (error) {
      res.status(500).json({
        status: false,
        message: 'pencarian gagal.',
        error: error.message
      });
    }
  }
};