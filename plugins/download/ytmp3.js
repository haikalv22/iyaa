const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os'); // Wajib untuk Vercel

// --- 1. Scraper Clipto (Mengambil Link GoogleVideo) ---
async function cliptoAudio(youtubeUrl) {
  try {
    const res = await axios.post(
      'https://www.clipto.com/api/youtube',
      { url: youtubeUrl },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.clipto.com/',
          'Origin': 'https://www.clipto.com',
          'Content-Type': 'application/json'
        },
        timeout: 10000 
      }
    );

    if (!res.data || !res.data.medias) throw new Error('Clipto tidak memberikan data media.');

    const medias = res.data.medias || [];
    const audio = medias
      .filter(m => m.type === 'audio')
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (!audio) throw new Error('Tidak ditemukan format audio pada link ini.');

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
    if (err.response) throw new Error(`HTTP Error: ${err.response.status}`);
    throw err;
  }
}

// --- 2. Upload ke Uguu ---
async function uploadToUguu(filePath) {
  try {
    const form = new FormData();
    form.append('files[]', fs.createReadStream(filePath));

    const res = await axios.post('https://uguu.se/upload', form, {
      headers: { ...form.getHeaders() },
      timeout: 30000 // Uguu kadang butuh waktu agak lama
    });

    if (res.data?.files?.[0]?.url) return res.data.files[0].url;
    throw new Error('Respon Uguu tidak valid.');
  } catch (e) {
    throw new Error('Gagal upload ke Uguu: ' + e.message);
  }
}

module.exports = {
  name: "download audio youtube",
  desc: "download youtube audio -> server tmp -> uguu (Vercel Support)",
  category: "downloader",
  method: "GET",
  path: "/ytmp3",
  params: ['url'],
  
  run: async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "parameter 'url' diperlukan." });

    // A. Setup Path File Sementara yang Aman (os.tmpdir)
    // Nama file dibuat random agar tidak bentrok antar user
    const tempFileName = `yt_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      // B. Dapatkan URL Source dari Clipto
      const dataClip = await cliptoAudio(url);
      
      // C. Download Stream ke File Sementara (Lebih hemat RAM daripada Buffer)
      const writer = fs.createWriteStream(tempFilePath);
      
      const response = await axios({
        url: dataClip.url,
        method: 'GET',
        responseType: 'stream', // Penting: Mode stream
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      response.data.pipe(writer);

      // Tunggu sampai download selesai ditulis ke disk
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // D. Upload ke Uguu
      const uguuUrl = await uploadToUguu(tempFilePath);

      // E. Kirim Respon
      const finalResult = {
        ...dataClip,
        url: uguuUrl,
        original_format: dataClip.format,
        final_format: "mp3"
      };

      res.json({
        status: true,
        creator: "haikal",
        message: "berhasil mengambil data audio",
        result: finalResult
      });

    } catch (error) {
      console.error('[plugin error]', error);
      res.status(500).json({ status: false, message: error.message });
    } finally {
      // F. Hapus File Sampah (PENTING untuk Vercel agar tidak kena limit storage)
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          console.error("Gagal menghapus file temp:", e);
        }
      }
    }
  }
};