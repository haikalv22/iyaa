const axios = require("axios");
const crypto = require("crypto");
const ytSearch = require("yt-search"); // Tambahkan module yt-search

// --- Helper User Agent ---
const getRandomUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

// --- Logika Savetube ---
const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info",
    download: "/download",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": getRandomUserAgent(),
  },
  crypto: {
    hexToBuffer: (hexString) => {
      const matches = hexString.match(/.{1,2}/g);
      return Buffer.from(matches.join(""), "hex");
    },
    decrypt: async (enc) => {
      try {
        const secretKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
        const data = Buffer.from(enc, "base64");
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = savetube.crypto.hexToBuffer(secretKey);
        const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        let decrypted = decipher.update(content);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString());
      } catch (error) {
        throw new Error(error);
      }
    },
  },
  youtube: (url) => {
    if (!url) return null;
    const a = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    ];
    for (let b of a) {
      if (b.test(url)) return url.match(b)[1];
    }
    return null;
  },
  request: async (endpoint, data = {}, method = "post") => {
    try {
      const { data: response } = await axios({
        method,
        url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
        headers: savetube.headers,
      });
      return {
        status: true,
        code: 200,
        data: response,
      };
    } catch (error) {
      throw new Error(error);
    }
  },
  getCDN: async () => {
    const response = await savetube.request(savetube.api.cdn, {}, "get");
    if (!response.status) throw new Error(response);
    return {
      status: true,
      code: 200,
      data: response.data.cdn,
    };
  },
  // FUNGSI INI DIUBAH: Tidak butuh parameter format lagi, otomatis MP3
  download: async (link) => {
    if (!link) {
      return { status: false, message: "url tidak ditemukan" };
    }

    const id = savetube.youtube(link);
    if (!id) return { status: false, message: "link youtube tidak valid" };

    try {
      const cdnx = await savetube.getCDN();
      if (!cdnx.status) return cdnx;
      const cdn = cdnx.data;
      
      const result = await savetube.request(
        `https://${cdn}${savetube.api.info}`,
        { url: `https://www.youtube.com/watch?v=${id}` }
      );
      if (!result.status) return result;
      
      const decrypted = await savetube.crypto.decrypt(result.data.data);
      
      // HARDCODE: Selalu minta audio (MP3) quality 128
      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id: id,
        downloadType: "audio", 
        quality: "128",
        key: decrypted.key,
      });

      return {
        status: true,
        data: {
          title: decrypted.title || "tidak diketahui",
          type: "mp3",
          quality: "128kbps",
          thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/0.jpg`,
          duration: decrypted.duration,
          durationLabel: decrypted.durationLabel,
          download_url: dl.data.data.downloadUrl,
        },
      };
    } catch (error) {
      console.error(error);
      return { status: false, message: error.message };
    }
  },
};

// --- Format Plugin untuk Server.js ---
module.exports = {
  name: 'youtube play/mp3',
  desc: 'cari lagu youtube dan download mp3 via savetube',
  method: 'GET',
  path: '/play', // Ubah path agar lebih sesuai (misal /play)
  category: 'downloader',
  params: [
      { name: 'query', required: true } // Parameter diubah jadi query (judul lagu)
  ],
  example: '/downloader/play?query=never gonna give you up',
  
  run: async (req, res) => {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: 'parameter query (judul lagu) diperlukan'
      });
    }

    try {
      // 1. Cari video menggunakan yt-search
      const searchResult = await ytSearch(query);
      const video = searchResult.videos.length > 0 ? searchResult.videos[0] : null;

      if (!video) {
        return res.status(404).json({
          status: false,
          message: 'lagu tidak ditemukan'
        });
      }

      // 2. Ambil URL dari hasil pencarian pertama
      const videoUrl = video.url;

      // 3. Panggil fungsi download savetube (otomatis MP3)
      const result = await savetube.download(videoUrl);

      if (!result.status) {
        return res.status(400).json(result);
      }

      // Tambahkan info metadata dari hasil pencarian agar lebih lengkap
      res.status(200).json({
        status: true,
        creator: 'haikal',
        result: {
            ...result.data,
            search_info: {
                title: video.title,
                views: video.views,
                author: video.author.name,
                ago: video.ago
            }
        }
      });

    } catch (e) {
      res.status(500).json({
        status: false,
        message: 'internal server error',
        error: e.message
      });
    }
  }
};