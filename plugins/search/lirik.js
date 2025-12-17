// plugins/ai/lyrics.js
const fetch = require('node-fetch'); // Import node-fetch di sini jika belum ada di server.js

// Fungsi inti untuk mengambil lirik dari API eksternal
const generateLyrics = async (prompt) => {
  const url = 'https://lyricsgenerator.com/api/completion';
  const payload = { prompt };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'content-type': 'text/plain;charset=UTF-8',
      'origin': 'https://lyricsgenerator.com',
      'referer': 'https://lyricsgenerator.com',
      // User-Agent bisa dipertimbangkan untuk dihilangkan atau diubah
      'user-agent': 'Mozilla/5.0 (Node.js REST API)', 
    },
    body: JSON.stringify(payload),
  });
  
  // Asumsi API mengembalikan teks mentah
  return response.text(); 
};

module.exports = {
  name: 'generator lirik',
  desc: 'membuat lirik lagu berdasarkan prompt (dari api eksternal).',
  method: 'GET', // Kita gunakan GET untuk endpoint sederhana dengan query parameter
  path: '/lyrics',
  category: 'search', // Kategorinya akan menjadi bagian dari path: /ai/lyrics
  params: ['prompt'], // Parameter yang dibutuhkan
  example: '/ai/lyrics?prompt=jika kamu mendua',
  
  // Fungsi utama yang akan dijalankan ketika endpoint diakses
  run: async (req, res) => {
    // Ambil parameter 'prompt' dari query string
    const prompt = req.query.prompt;
    
    if (!prompt) {
      return res.status(400).json({
        status: false,
        message: 'parameter "prompt" wajib diisi.'
      });
    }

    try {
      const lyricsText = await generateLyrics(prompt);
      
      // Mengirimkan respons dengan status 200 (OK)
      res.status(200).json({
        status: true,
        creator: "haikal",
        message: 'lirik berhasil dibuat',
        prompt: prompt,
        result: lyricsText.trim() // Hapus spasi di awal/akhir jika ada
      });
    } catch (error) {
      console.error('error saat generate lirik:', error);
      res.status(500).json({
        status: false,
        message: 'gagal mengambil lirik dari api eksternal.',
        error: error.message
      });
    }
  }
};