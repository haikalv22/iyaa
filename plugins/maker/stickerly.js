const axios = require('axios');

// 1. Fungsi Scraper (Helper Function)
async function smartSearchSticker(keyword = 'anime') {
  const response = await axios.post(
    'https://api.sticker.ly/v4/stickerPack/smartSearch',
    {
      keyword,
      enabledKeywordSearch: true,
      filter: {
        extendSearchResult: false,
        sortBy: 'RECOMMENDED',
        languages: ['ALL'],
        minStickerCount: 5,
        searchBy: 'ALL',
        stickerType: 'ALL'
      }
    },
    {
      headers: {
        'User-Agent': 'androidapp.stickerly/3.25.2 (220333QAG; U; Android 30; ms-MY; id;)',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'x-duid': Buffer.from(Date.now().toString()).toString('base64') // btoa di nodejs pakai Buffer
      }
    }
  );
  const packs = response.data?.result?.stickerPacks || [];
  return packs.map(pack => {
    const prefix = pack.resourceUrlPrefix;
    return {
      ...pack,
      resourceFiles: pack.resourceFiles.map(file =>
        file.startsWith('http') ? file : prefix + file
      ),
      resourceZip: prefix + pack.resourceZip
    };
  });
}

// 2. Export Plugin sesuai format server.js
module.exports = {
  // Metadata Plugin
  name: 'sticker ly search',
  desc: 'mencari pack stiker dari sticker ly',
  method: 'GET',         // Bisa GET atau POST
  path: '/stickerly',    // Endpoint jadi: /api/search/stickerly (tergantung kategori folder)
  category: 'maker',    // Opsional, akan menimpa nama folder jika diisi
  params: ['query'],     // Agar muncul di /api/info sebagai parameter required

  // Fungsi Utama yang dijalankan server
  run: async (req, res) => {
    try {
      // Ambil parameter query dari URL (karena method GET)
      const keyword = req.query.query;

      if (!keyword) {
        return res.status(400).json({
          status: false,
          message: 'parameter "query" diperlukan. contoh: ?query=anime'
        });
      }

      // Panggil fungsi scraper
      const result = await smartSearchSticker(keyword);

      if (!result || result.length === 0) {
        return res.status(404).json({
          status: false,
          message: 'stiker tidak ditemukan'
        });
      }

      // Kirim response JSON
      res.json({
        status: true,
        creator: 'haikal', // Ganti nama creator Anda
        result: result
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: false,
        message: 'internal server error',
        error: error.message
      });
    }
  }
};