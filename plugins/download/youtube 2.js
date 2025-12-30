const axios = require('axios');

// --- Logika Scraper (Dari kode kamu) ---
const headers = {
  'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://ytdown.to/id2/',
  'Origin': 'https://ytdown.to'
};

async function processMedia(mediaUrl) {
  try {
    const response = await axios.post('https://ytdown.to/proxy.php', new URLSearchParams({
      url: mediaUrl
    }), { headers });

    if (response.data && response.data.api) {
      return response.data.api.fileUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function scrapeYtDown(ytUrl) {
  try {
    const response = await axios.post('https://ytdown.to/proxy.php', new URLSearchParams({
      url: ytUrl
    }), { headers });

    const data = response.data;
    if (!data.api || !data.api.mediaItems) {
      throw new Error('Gagal mengambil data video. Pastikan URL valid atau layanan sedang gangguan.');
    }

    const items = data.api.mediaItems;
    
    // Logika pemilihan kualitas (Video & Audio)
    const videoItem = items.find(item => item.type === 'Video' && item.mediaQuality === 'FHD') || items.find(item => item.type === 'Video');
    const audioItem = items.find(item => item.type === 'Audio' && item.mediaQuality.includes('128')) || items.find(item => item.type === 'Audio');

    const result = {
      title: data.api.title,
      duration: data.api.mediaItems[0]?.mediaDuration,
      thumbnail: data.api.imagePreviewUrl,
      downloads: {}
    };

    if (videoItem) {
      const link = await processMedia(videoItem.mediaUrl);
      result.downloads.video = {
        quality: videoItem.mediaQuality,
        size: videoItem.mediaFileSize,
        url: link
      };
    }

    if (audioItem) {
      const link = await processMedia(audioItem.mediaUrl);
      result.downloads.audio = {
        quality: audioItem.mediaQuality,
        size: audioItem.mediaFileSize,
        url: link
      };
    }

    return result;

  } catch (error) {
    console.error(error.message);
    return null;
  }
}

// --- Integrasi ke Server ---
module.exports = {
  // Properti wajib agar terbaca oleh server.js
  name: 'YouTube Downloader',
  desc: 'Download Video & Audio YouTube via ytdown.to',
  method: 'GET', // Kita gunakan GET agar mudah diakses via browser
  path: '/ytdown2', // Endpoint akan menjadi /downloader/ytdown
  category: 'downloader',
  params: ['url'], // Parameter yang dibutuhkan
  
  // Fungsi utama yang dijalankan server
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'Parameter "url" wajib diisi!'
      });
    }

    try {
      const result = await scrapeYtDown(url);

      if (!result) {
        return res.status(404).json({
          status: false,
          message: 'Video tidak ditemukan atau terjadi kesalahan pada server pihak ketiga.'
        });
      }

      res.json({
        status: true,
        creator: 'API Server',
        result: result
      });

    } catch (e) {
      res.status(500).json({
        status: false,
        message: 'Internal Server Error',
        error: e.message
      });
    }
  }
};