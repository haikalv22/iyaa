const axios = require('axios');

// --- Fungsi Utama dari kodemu ---
async function downloadYoutubeShort(videoUrl) {
  try {
    // 1. Bypass Cloudflare Turnstile
    const cfApiUrl = 'https://api.nekolabs.web.id/tools/bypass/cf-turnstile';
    const cfPayload = {
      url: 'https://ezconv.cc',
      siteKey: '0x4AAAAAAAi2NuZzwS99-7op'
    };
    
    const { data: cfResponse } = await axios.post(cfApiUrl, cfPayload);
    
    if (!cfResponse.success || !cfResponse.result) {
      return {
        success: false,
        message: 'Gagal mendapatkan token captcha (CF Bypass Error)'
      };
    }
    
    const captchaToken = cfResponse.result;
    
    // 2. Request Konversi ke EZConv
    const convertApiUrl = 'https://ds1.ezsrv.net/api/convert';
    const convertPayload = {
      url: videoUrl,
      quality: '320', // Default quality
      trim: false,
      startT: 0,
      endT: 0,
      captchaToken: captchaToken
    };
    
    const { data: convertResponse } = await axios.post(convertApiUrl, convertPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (convertResponse.status !== 'done') {
      return {
        success: false,
        message: `Konversi gagal. Status: ${convertResponse.status}`
      };
    }
    
    // 3. Sukses
    return {
      success: true,
      data: {
        title: convertResponse.title,
        downloadUrl: convertResponse.url,
        status: convertResponse.status,
        quality: convertResponse.quality
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: error.response?.data ? JSON.stringify(error.response.data) : error.message
    };
  }
}

// --- Integrasi ke Server.js (Format Plugin) ---
module.exports = {
  name: 'YouTube Short Downloader',
  desc: 'Download video YouTube Short tanpa watermark via EZConv',
  method: 'GET',            // Menggunakan method GET agar mudah dites di browser
  path: '/ytshort',         // Endpoint akan menjadi /downloader/ytshort
  category: 'downloader',
  params: ['url'],          // Parameter yang dibutuhkan di query ?url=...
  
  // Fungsi yang akan dijalankan oleh server.js
  run: async (req, res) => {
    const url = req.query.url;

    // Validasi input
    if (!url) {
      return res.json({
        status: false,
        message: 'Masukkan parameter url! Contoh: ?url=https://www.youtube.com/shorts/...'
      });
    }

    // Eksekusi fungsi download
    const result = await downloadYoutubeShort(url);

    // Kirim respon ke user
    if (result.success) {
      res.json({
        status: true,
        creator: "haikal",
        result: result.data
      });
    } else {
      res.json({
        status: false,
        message: result.message
      });
    }
  }
};