const axios = require('axios');

module.exports = {
  name: 'Ryuzumi TTS Gemini',
  desc: 'Text to Speech Gemini dengan pilihan Voice dan Style',
  category: 'ai',
  method: 'get',
  path: '/gemini-tts',
  params: [
    { name: 'text', required: true },
    { name: 'voice', required: false }, // Default: Leda
    { name: 'style', required: false }  // Default: default
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

      // --- URL YANG SUDAH DIPERBAIKI (TIDAK ADA TYPO) ---
      const apiUrl = 'https://api.ryzumi.vip/api/ai/tts-gemini';

      const response = await axios.get(apiUrl, {
        params: {
          text: text,
          voice: targetVoice,
          style: targetStyle
        },
        responseType: 'arraybuffer' 
      });

      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType || 'audio/wav');
      res.send(response.data);

    } catch (error) {
      console.error('Error Ryuzumi TTS:', error.message);
      res.status(500).json({
        status: false,
        message: 'Gagal mengambil data dari server Ryzumi.',
        error: error.message
      });
    }
  }
};