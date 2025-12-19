const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Aktifkan Stealth Plugin agar tidak terdeteksi sebagai bot
puppeteer.use(StealthPlugin());

module.exports = {
  // Informasi Plugin untuk Server.js
  name: 'YouTube Downloader',
  desc: 'Mendapatkan detail video dan link download dari YouTube',
  category: 'Downloader', // Akan menjadi prefix path: /downloader
  method: 'GET',
  path: '/youtube', // Endpoint akhir: /downloader/youtube
  params: [
    { name: 'url', required: true } // Parameter yang dibutuhkan
  ],
  example: '/downloader/youtube?url=https://www.youtube.com/watch?v=CfdkLVxVJC0',

  // Logika Utama
  run: async (req, res) => {
    const { url } = req.query;

    // Validasi URL
    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'Parameter URL wajib diisi.'
      });
    }

    let browser = null;

    try {
      // Launch Browser
      browser = await puppeteer.launch({
        headless: 'new', // Mode tanpa tampilan GUI
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const page = await browser.newPage();

      // Set User Agent agar terlihat seperti browser asli
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setViewport({ width: 1366, height: 768 });

      // Pergi ke website target
      await page.goto('https://www.ytbsaver.com', {
        waitUntil: 'networkidle2',
        timeout: 60000 // Timeout 60 detik jaga-jaga koneksi lambat
      });

      // Tunggu sebentar (sesuai kode aslimu)
      await new Promise(r => setTimeout(r, 2000));

      // Eksekusi script di dalam halaman browser (evaluate)
      const result = await page.evaluate(async (targetUrl) => {
        try {
          const res = await fetch(
            'https://api.ytbvideoly.com/api/thirdvideo/parse',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                url: targetUrl,
                from: 'ytbdownload'
              })
            }
          );
          return await res.json();
        } catch (e) {
          return { errno: -1, msg: e.message };
        }
      }, url);

      // Cek hasil dari website target
      if (result.errno !== 0) {
        throw new Error('Gagal mengambil data. Pastikan URL valid atau coba lagi nanti.');
      }

      const v = result.data;

      // Rapikan data respons
      const data = {
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        source: 'YouTube',
        links: {
          best_quality: {
            url: v.best_down_url,
            type: 'video/mp4' // Asumsi
          },
          video_variants: v.videos || {},
          audio_variants: v.audios || {}
        }
      };

      // Kirim respons sukses ke user API
      return res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data video',
        data: data
      });

    } catch (error) {
      console.error('Scraping Error:', error.message);
      return res.status(500).json({
        status: false,
        message: 'Internal Server Error',
        error: error.message
      });
    } finally {
      // PENTING: Selalu tutup browser agar RAM server tidak habis
      if (browser) {
        await browser.close();
      }
    }
  }
};