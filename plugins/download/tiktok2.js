const axios = require("axios");
const cheerio = require("cheerio");

// --- FUNGSI HELPER SCRAPER ---

async function tiktok(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const params = new URLSearchParams();
      params.set("url", url);
      params.set("hd", "1");

      const response = await axios({
        method: "POST",
        url: "https://tikwm.com/api/",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: "current_language=en",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
        },
        data: params,
      });

      const data = response.data.data;
      if (!data) throw new Error("video tidak ditemukan atau link tidak valid.");

      resolve({
        type: "video",
        title: data.title,
        cover: data.cover,
        origin_cover: data.origin_cover,
        no_watermark: data.play,
        watermark: data.wmplay,
        music: data.music,
        author: data.author,
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function ttslide(url) {
  try {
    const response = await axios.get(`https://dlpanda.com/id?url=${url}&token=G7eRpMaa`);
    const html = response.data;
    const $ = cheerio.load(html);
    const images = [];
    const creator = "haikal";

    $("div.col-md-12 > img").each((_, element) => {
      const imgSrc = $(element).attr("src");
      if (imgSrc) images.push(imgSrc);
    });

    if (images.length === 0) throw new Error("tidak ada gambar slide ditemukan.");

    return {
      type: "slide",
      creator,
      images: images,
    };
  } catch (error) {
    throw new Error(`gagal memproses slide: ${error.message}`);
  }
}

// --- KONFIGURASI PLUGIN ---

module.exports = {
  name: 'tiktok2 downloader',
  desc: 'download video dan slide tiktok tanpa watermark',
  method: 'GET',
  path: '/tiktok2',
  category: 'downloader',
  params: ['url'],
  example: '/downloader/tiktok?url=https://vt.tiktok.com/xxxx',
  
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'parameter "url" diperlukan.'
      });
    }

    try {
      let result;
      // Logika: Coba download video dulu, kalau error coba download slide
      try {
        result = await tiktok(url);
      } catch (e) {
        console.log("mode video gagal, mencoba mode slide...");
        result = await ttslide(url);
      }

      res.json({
        status: true,
        creator: 'haikal',
        result: result
      });

    } catch (error) {
      res.status(500).json({
        status: false,
        message: 'gagal mendownload media. pastikan link valid.',
        error: error.message
      });
    }
  }
};