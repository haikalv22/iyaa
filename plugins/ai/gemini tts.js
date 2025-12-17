const axios = require('axios');

module.exports = {
  name: 'kon TTS Gemini',
  desc: 'Text to Speech Gemini dengan pilihan Voice dan Style',
  category: 'ai',
  method: 'get',
  path: '/gemini-tts',
  params: [
    { name: 'text', required: true },
    { name: 'voice', required: false }, 
    { name: 'style', required: false }  
  ],
  
  run: async (req, res) => {
    try {
      const { text, voice, style } = req.query;

      if (!text) {
        return res.status(400).json({
          status: false,
          message: 'Parameter "text" tidak boleh kosong.'
        });
      }

      const targetVoice = voice || 'Leda';
      const targetStyle = style || 'default';
      const apiUrl = 'https://api.ryzumi.vip/api/ai/tts-gemini';

      // --- KONFIGURASI STEALTH (MENYAMAR SEBAGAI BROWSER) ---
      const response = await axios.get(apiUrl, {
        params: {
          text: text,
          voice: targetVoice,
          style: targetStyle
        },
        headers: {
          // 1. User Agent Chrome terbaru
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          
          // 2. Referer: Berpura-pura kita mengakses dari halaman web mereka sendiri
          'Referer': 'https://api.ryzumi.vip/docs',
          'Origin': 'https://api.ryzumi.vip',
          
          // 3. Accept Language: Bahasa browser (Inggris/Indonesia)
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          
          // 4. Accept tipe konten umum
          'Accept': 'application/json, text/plain, */*',
          
          // 5. Header tambahan agar terlihat 'polite'
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Connection': 'keep-alive'
        },
        // Wajib arraybuffer untuk file audio
        responseType: 'arraybuffer' 
      });

      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType || 'audio/wav');
      res.send(response.data);

    } catch (error) {
      console.error('Error Ryuzumi TTS:', error.message);
      
      // Jika masih error, kita intip pesan error dari server sana
      if (error.response) {
          console.error('Status Code:', error.response.status);
          // Convert buffer ke string untuk melihat pesan error html/json
          const errorData = Buffer.from(error.response.data).toString();
          console.error('Data Error dari Ryuzumi:', errorData.substring(0, 200)); // Lihat 200 huruf pertama
      }

      res.status(500).json({
        status: false,
        message: 'Gagal mengambil data (Kemungkinan IP Server Anda diblokir Cloudflare).',
        error: error.message
      });
    }
  }
};