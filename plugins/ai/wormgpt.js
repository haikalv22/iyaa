const axios = require("axios");

// Konfigurasi API
const API_URL = "https://api.wrmgpt.com/v1/chat/completions";
const AUTHORIZATION = "sk_live_0003c489-6095-453d-b3f5-dd87237aa69eb001";

module.exports = {
  // Metadata untuk server.js
  name: 'WormGPT',
  desc: 'Chat dengan AI WormGPT (Uncensored/Jailbreak Model)',
  method: 'GET', // Kita gunakan GET agar mudah dites di browser
  path: '/wormgpt', // Endpoint akan menjadi /ai/wormgpt (karena kategori 'AI')
  category: 'ai',
  // Parameter yang dibutuhkan (otomatis dicatat di /api/info)
  params: [
    { name: 'text', required: true }
  ],

  // Fungsi utama yang dijalankan server
  run: async (req, res) => {
    try {
      // 1. Ambil input dari query param (contoh: ?text=halo)
      const { text } = req.query;

      // 2. Validasi input
      if (!text) {
        return res.status(400).json({
          status: false,
          message: "Parameter 'text' tidak boleh kosong. Contoh: ?text=siapa kamu"
        });
      }

      // 3. Request ke API WormGPT
      const response = await axios.post(
        API_URL,
        {
          model: "wormgpt-v7",
          messages: [
            {
              role: "user",
              content: text,
            },
          ],
        },
        {
          headers: {
            "Authorization": `Bearer ${AUTHORIZATION}`,
            "Content-Type": "application/json",
          },
        }
      );

      // 4. Ambil hasil respons
      const reply = response.data?.choices?.[0]?.message?.content || "No response from model.";

      // 5. Kirim respons JSON ke user
      res.status(200).json({
        status: true,
        creator: "API Server",
        result: reply
      });

    } catch (error) {
      // Error Handling
      console.error("[ERROR] WormGPT:", error.response?.data || error.message);
      
      res.status(500).json({
        status: false,
        message: "Gagal menghubungi layanan WormGPT.",
        error: error.message
      });
    }
  }
};