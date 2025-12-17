const axios = require('axios');

module.exports = {
  name: 'gemini tts',
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

      // --- PERBAIKAN UTAMA DI SINI ---
      // Kita tambahkan 'headers' agar dianggap sebagai browser (Bypass 403)
      const response = await axios.get(apiUrl, {
        params: {
          text: text,
          voice: targetVoice,
          style: targetStyle
        },
        headers: {
          // User-Agent ini membuat server mengira kita adalah browser Chrome di Windows
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
          'Accept': 'audio/wav,application/json,text/plain,*/*'
        },
        responseType: 'arraybuffer' 
      });

      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType || 'audio/wav');
      res.send(response.data);

    } catch (error) {
      console.error('Error Ryuzumi TTS:', error.message);
      
      // Tampilkan error lebih detail jika ada response body dari sana
      if (error.response) {
          console.error('Data Error:', error.response.data.toString());
      }

      res.status(500).json({
        status: false,
        message: 'Gagal mengambil data dari server Ryzumi (Terblokir/Error).',
        error: error.message
      });
    }
  }
};