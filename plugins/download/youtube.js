const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = {
  name: 'youTube Downloader',
  desc: 'Mendapatkan detail video dan link download dari YouTube',
  category: 'Downloader',
  method: 'GET',
  path: '/youtube',
  params: [
    { name: 'url', required: true }
  ],
  example: '/downloader/youtube?url=https://www.youtube.com/watch?v=CfdkLVxVJC0',

  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: 'Parameter URL wajib diisi.'
      });
    }

    let browser = null;

    try {
      // --- KONFIGURASI KHUSUS VERCEL/SERVERLESS ---
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();

      // Manual User Agent (Pengganti Stealth Plugin agar tidak terdeteksi)
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setViewport({ width: 1280, height: 720 });

      // Timeout dipercepat agar tidak kena limit Vercel (maks 10 detik di plan Hobby)
      await page.goto('https://www.ytbsaver.com', {
        waitUntil: 'domcontentloaded', // Lebih cepat daripada networkidle2
        timeout: 10000 
      });

      // Tunggu selector muncul (lebih aman daripada sleep manual)
      // Kita tunggu input field atau tombol convert muncul
      await new Promise(r => setTimeout(r, 1000)); 

      const result = await page.evaluate(async (targetUrl) => {
        try {
          const res = await fetch(
            'https://api.ytbvideoly.com/api/thirdvideo/parse',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                // Header tambahan agar terlihat lebih "real"
                'Origin': 'https://www.ytbsaver.com',
                'Referer': 'https://www.ytbsaver.com/'
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

      if (result.errno !== 0) {
        throw new Error('Gagal parsing data dari sumber.');
      }

      const v = result.data;
      
      const data = {
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        source: 'YouTube',
        links: {
          best_quality: {
            url: v.best_down_url,
            type: 'video/mp4'
          },
          video_variants: v.videos || {},
          audio_variants: v.audios || {}
        }
      };

      return res.status(200).json({
        status: true,
        message: 'Berhasil mengambil data video',
        data: data
      });

    } catch (error) {
      console.error('Vercel Scrape Error:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal Server Error',
        error: error.message
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
};