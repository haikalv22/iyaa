const axios = require("axios");
const crypto = require("crypto");

// --- Helper User Agent (Pengganti file user-agent) ---
const getRandomUserAgent = () => {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

// --- Logika Savetube (Dari kodemu) ---
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
  formats: ["144", "240", "360", "480", "720", "1080", "mp3"],
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
  download: async (link, format) => {
    if (!link) {
      return { status: false, message: "url tidak ditemukan" };
    }
    // Default ke 720 jika format tidak valid/kosong, atau mp3 jika user minta audio tapi lupa format
    if (!format) format = "720";
    
    // Validasi format agar sesuai dengan savetube.formats
    if (!savetube.formats.includes(format)) {
       // Fallback cerdas: jika user ketik 'audio', ganti jadi 'mp3'. Jika 'video', ganti '720'
       if (format === 'audio') format = 'mp3';
       else if (format === 'video') format = '720';
       else return {
        status: false,
        message: "format salah. gunakan: " + savetube.formats.join(", "),
      };
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
      
      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id: id,
        downloadType: format === "mp3" ? "audio" : "video",
        quality: format === "mp3" ? "128" : format,
        key: decrypted.key,
      });

      return {
        status: true,
        data: {
          title: decrypted.title || "tidak diketahui",
          type: format === "mp3" ? "audio" : "video",
          quality: format,
          thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/0.jpg`,
          duration: decrypted.duration,
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
  name: 'youtube downloader',
  desc: 'download video/audio youtube via savetube',
  method: 'GET', // Menggunakan GET agar mudah dites di browser
  path: '/youtube',
  category: 'downloader',
  params: [
      { name: 'url', required: true },
      { name: 'format', required: false } // Opsional, default 720
  ],
  example: '/downloader/savetube?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=mp3',
  
  run: async (req, res) => {
    const { url, format } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'parameter url diperlukan'
      });
    }

    try {
      // Panggil fungsi download dari object savetube
      const result = await savetube.download(url, format || '720');

      if (!result.status) {
        return res.status(400).json(result);
      }

      res.status(200).json({
        status: true,
        creator: 'haikal',
        result: result.data
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