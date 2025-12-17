const axios = require('axios');

module.exports = {
  name: 'gemini tts',
  desc: 'text to speech dengan pilihan voice dan style (Leda, Zephyr, dll)',
  category: 'ai',
  method: 'get',
  path: '/gemini-tts',
  // Sesuai screenshot, parameter yang dibutuhkan: text, voice, style
  params: [
    { name: 'text', required: true },
    { name: 'voice', required: false }, // Default: Leda
    { name: 'style', required: false }  // Default: default
  ],
  
  run: async (req, res) => {
    try {
      const { text, voice, style } = req.query;

      // Validasi input text
      if (!text) {
        return res.status(400).json({
          status: false,
          message: 'parameter "text" tidak boleh kosong.'
        });
      }

      // Set default value jika user tidak mengisi parameter
      const targetVoice = voice || 'Leda';
      const targetStyle = style || 'default';

      // URL target sesuai screenshot
      const apiUrl = 'https://api.ryuzumi.vip/api/ai/tts-gender';

      // Request ke API Ryuzumi
      // PENTING: responseType 'arraybuffer' agar data audio tidak rusak
      const response = await axios.get(apiUrl, {
        params: {
          text: text,
          voice: targetVoice,
          style: targetStyle
        },
        responseType: 'arraybuffer' 
      });

      // Cek apakah response berupa audio
      const contentType = response.headers['content-type'];
      
      // Kirim balik header yang sesuai
      res.set('Content-Type', contentType || 'audio/wav');
      
      // Kirim buffer audio langsung ke user
      res.send(response.data);

    } catch (error) {
      console.error('error tts:', error.message);
      
      // Error handling jika API luar mati atau request salah
      res.status(500).json({
        status: false,
        message: 'gagal mengambil data dari server',
        error: error.message
      });
    }
  }
};