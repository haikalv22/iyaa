const axios = require('axios');
const vm = require('node:vm');
const { FormData } = require('axios'); // Axios versi baru mungkin butuh ini atau form-data manual

// --- Logika Scraper (Diadaptasi ke CommonJS) ---
async function scrapeSnapSave(targetUrl) {
  try {
    const formData = new URLSearchParams();
    formData.append('url', targetUrl);

    const { data } = await axios.post('https://snapsave.app/id/action.php?lang=id', formData, {
      headers: {
        'origin': 'https://snapsave.app',
        'referer': 'https://snapsave.app/id/download-video-instagram',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded' // Penting untuk URLSearchParams
      }
    });

    // Simulasi Browser Environment untuk VM
    const ctx = {
      window: {},
      document: { getElementById: () => ({ value: '' }) },
      console: console,
      eval: (res) => res
    };

    vm.createContext(ctx);
    // Eksekusi script yang didapat dari response SnapSave
    const decoded = vm.runInContext(data, ctx);
    
    // Regex untuk mengambil URL video
    const regex = /https:\/\/d\.rapidcdn\.app\/v2\?[^"]+/g;
    const matches = decoded.match(regex);

    if (matches && matches.length > 0) {
      // Bersihkan URL (&amp; menjadi &)
      const cleanUrls = [...new Set(matches.map(url => url.replace(/&amp;/g, '&')))];
      
      return {
        status: true,
        count: cleanUrls.length,
        data: cleanUrls
      };
    }

    return {
      status: false,
      message: "No media found",
      count: 0,
      data: []
    };

  } catch (e) {
    console.error(e);
    return {
      status: false,
      message: e.message,
      count: 0,
      data: []
    };
  }
}

// --- Struktur Plugin untuk Server.js ---
module.exports = {
  name: 'Instagram Downloader',
  desc: 'Download Instagram Video/Reels/Stories via SnapSave',
  method: 'GET',
  category: 'downloader',
  path: '/igdl', // Endpoint akan menjadi /api/downloader/igdl (tergantung kategori folder)
  params: ['url'], // Parameter yang dibutuhkan
  
  // Fungsi utama yang dipanggil server.js
  run: async (req, res) => {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'Parameter "url" diperlukan!'
      });
    }

    try {
      const result = await scrapeSnapSave(url);
      
      if (result.status) {
        res.json({
          status: true,
          creator: "API Server",
          result: result
        });
      } else {
        res.status(404).json(result);
      }

    } catch (error) {
      res.status(500).json({
        status: false,
        message: 'Internal Server Error',
        error: error.message
      });
    }
  }
};