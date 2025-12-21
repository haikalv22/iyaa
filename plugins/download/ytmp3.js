const axios = require('axios');

async function cliptoAudio(youtubeUrl) {
  try {
    const res = await axios.post(
      'https://www.clipto.com/api/youtube',
      { url: youtubeUrl },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Penyamaran Browser
          'Referer': 'https://www.clipto.com/',
          'Origin': 'https://www.clipto.com',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        timeout: 10000 // Timeout 10 detik
      }
    );

    // --- DEBUGGING LOG (Cek ini di Vercel Logs jika error lagi) ---
    console.log(`[Clipto Debug] URL: ${youtubeUrl}`);
    console.log(`[Clipto Debug] Respon Status: ${res.data.success}`);
    
    if (!res.data || !res.data.medias) {
      console.log(`[Clipto Debug] Raw Data:`, JSON.stringify(res.data)); // Log respon aneh
      throw new Error('Clipto tidak memberikan data media. Kemungkinan IP Server diblokir.');
    }

    const medias = res.data.medias || [];

    // Filter audio, tapi kita buat lebih longgar
    const audio = medias
      .filter(m => m.type === 'audio')
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (!audio) {
      console.log(`[Clipto Debug] Available Medias:`, JSON.stringify(medias)); // Log apa yang tersedia
      throw new Error('Tidak ditemukan format audio (mp3/m4a) pada link ini.');
    }

    return {
      title: res.data.title,
      duration: res.data.duration,
      format: audio.ext,
      bitrate: audio.bitrate,
      size: audio.size,
      url: audio.url,
      thumbnail: res.data.thumbnail
    };

  } catch (err) {
    // Tangkap error axios secara spesifik
    if (err.response) {
       throw new Error(`HTTP Error: ${err.response.status} - ${err.response.statusText}`);
    }
    throw err;
  }
}

module.exports = {
  name: "Clipto YouTube Audio",
  desc: "Download audio YouTube menggunakan layanan Clipto",
  category: "downloader",
  method: "GET",
  path: "/yt-audio-clipto",
  params: ['url'],
  
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' diperlukan."
      });
    }

    try {
      const result = await cliptoAudio(url);
      res.json({
        status: true,
        message: "Berhasil mengambil data audio",
        result: result
      });

    } catch (error) {
      console.error('[Plugin Error]', error); // Agar muncul di log Vercel
      res.status(500).json({
        status: false,
        message: error.message
      });
    }
  }
};