const axios = require('axios');

// --- Fungsi Helper (Logic Asli) ---
async function cliptoAudio(youtubeUrl) {
  const res = await axios.post(
    'https://www.clipto.com/api/youtube',
    { url: youtubeUrl },
    {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      }
    }
  );

  if (!res.data || res.data.success !== true) {
    throw new Error('Respon tidak valid dari Clipto API');
  }

  const medias = res.data.medias || [];

  // Filter audio m4a/mp3/opus dan urutkan berdasarkan bitrate tertinggi
  const audio = medias
    .filter(m =>
      m.type === 'audio' &&
      ['m4a', 'mp3', 'opus'].includes(m.ext)
    )
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!audio) {
    throw new Error('Tidak ditemukan audio yang valid');
  }

  return {
    title: res.data.title,
    duration: res.data.duration, // Menambahkan durasi jika tersedia
    format: audio.ext,
    bitrate: audio.bitrate,
    size: audio.size, // Menambahkan ukuran file jika tersedia
    url: audio.url,
    thumbnail: res.data.thumbnail // Menambahkan thumbnail
  };
}

// --- Struktur Plugin untuk Server.js ---
module.exports = {
  name: "Clipto YouTube Audio",
  desc: "Download audio YouTube menggunakan layanan Clipto",
  category: "Downloader",
  method: "GET",
  path: "/yt-audio-clipto",
  params: ['url'], // Parameter yang dibutuhkan agar muncul di dokumentasi
  
  // Fungsi utama yang dijalankan server
  run: async (req, res) => {
    // Ambil parameter url dari query string (karena method GET)
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' diperlukan. Contoh: ?url=https://youtu.be/..."
      });
    }

    try {
      // Panggil fungsi helper
      const result = await cliptoAudio(url);

      // Kirim respon sukses
      res.json({
        status: true,
        message: "Berhasil mengambil data audio",
        result: result
      });

    } catch (error) {
      // Kirim respon error
      res.status(500).json({
        status: false,
        message: error.message
      });
    }
  }
};