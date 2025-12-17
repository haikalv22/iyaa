const axios = require('axios');

// =================== Konfigurasi ===================
// Sesuaikan API KEY di sini jika ada
const ANABOT_BASE = 'https://anabot.my.id/api/ai/geminiOption';
const ANABOT_APIKEY = 'freeApikey'; 
const ANABOT_COOKIE = 'HSID=AB-lg7jP-dDvpf4uX; SSID=AmvfQTsbjoVITgisI; APISID=CU1lOC1Z9CKjjQnX/AQ0Dxt0zzK8JKxHcg; SAPISID=JNT3wq_ia33e0MSq/Alu2HrES38I3SOV-w; __Secure-1PAPISID=JNT3wq_ia33e0MSq/Alu2HrES38I3SOV-w; __Secure-3PAPISID=JNT3wq_ia33e0MSq/Alu2HrES38I3SOV-w; SEARCH_SAMESITE=CgQIl58B; __Secure-1PSIDTS=sidts-CjEBmkD5SyyZx4H9zfbozdBPPWU5MHvl-_8S-ORmnnVgnz3NZCQ0Ai9AUu-abHhiN1rcEAA; __Secure-3PSIDTS=sidts-CjEBmkD5SyyZx4H9zfbozdBPPWU5MHvl-_8S-ORmnnVgnz3NZCQ0Ai9AUu-abHhiN1rcEAA; SID=g.a0003giOR7ItumfZ41X_VB_iFZQ-nJK8FaiIWtiNO8oskNnt2LZoFpKi9zclftU9K9n1ZXC1UAACgYKAaQSARQSFQHGX2MizqXlEbfUKikMIQIN3nC1ihoVAUF8yKrlqiA8GkzheFsFlISRiYHZ0076; __Secure-1PSID=g.a0003giOR7ItumfZ41X_VB_iFZQ-nJK8FaiIWtiNO8oskNnt2LZo_mCIwlrAsw_lIyzrZPc4dwACgYKAfISARQSFQHGX2Mi6LJmOc068vbK309AuOjvABoVAUF8yKoPVCuSJ06YnzJPxf3hMZ-10076; __Secure-3PSID=g.a0003giOR7ItumfZ41X_VB_iFZQ-nJK8FaiIWtiNO8oskNnt2LZogyQJk9nDm_g4fTf7m0MBqgACgYKAU8SARQSFQHGX2MiPrmvTmnfDHk2ANaFk1OuMBoVAUF8yKo8-PvyQ6Y3NTvhN4s5wGRL0076; S=billing-ui-v3=3pTsdTXwfMYLGM8TdQvxx29UZCDBadse:billing-ui-v3-efe=3pTsdTXwfMYLGM8TdQvxx29UZCDBadse; AEC=AaJma5uuo8BehTf_sEizynqB16dFGLcaD38qrrPq01qoQPyp4zS6QWDpIw; NID=527=OKUfmS4enDsSVJM5WvGQmxU0iPIUYChtHM7CgUIV4dz1mE6REB3OtZwks8bEpyLIVl7QKjoph2c2dg6o5nbetkS2j4uZMZNSRK8EgX51juWNPsZvbvC_dK9bsHClkFb57IuZnK2xBcCC4htWUNldkb4nb5f2guC28hCrP6cw_7RDTBq1rG4D8jaVrgJgn8JL9x2EsiRo7FSfFcEOTgnKKcKasNqhTUzlUwv9uUqxb5YI9PZKi7PL5p-o2Hr6pDAF1uKIkSrDDcS3SXW--tMuGkvVIj28I5IZbOOn_txRNZSnAR8ZRViohb6ntbiPKzBNMNtVK6Zdr7EUVO5HH-P3mspnxNOTVIl5t6ukO4WoxOCusw4hQk4FllYEdzA9HK4b2uujTbLKbouAMDR3oaeiHSV1V6_QmtnA42NtaeSGISorWUmV4lhTElMV1vXMU6u7sK307BCK8oLSjudWUbQH9Ie7dxlbsyegakbhCgcVlmaR8wj-cCOwBBKQLsbE-q7FvPa0LNktDZxGLGkO8M7Yj8_ksfLjVftllheM0jTSAKqtI7BHIzC0M8j9FrCRlHjtKf6PNxYMf-zLkTNxELXqRZLU57S5lkx6hDJpi-hTCF8VRZI-7tL-BymqREpCK3M5xYNGHD88P2JCjpeKNYQjx9ZN7_vWD-o7_I0x42xlXbH7KmjkL9DpmM_HOTT441U7m8Z-nGQ70CXu10_nXYkq48KXYTPWh0LtERsyXkjh4nmNLhD3yMEa; __Secure-STRP=ADq1D7oxL-vzfHhSrwXFu7oW0q8bmz1kZwKGlAyHfIp_KTHKvjJmmVCrmlkFMVKpg0yMEdXskuXOzHiIH2vq55sdUOAvQ7NBYmyf; _gcl_gs=2.1.k1$i1765194004$u18075439; _gcl_au=1.1.295777098.1765194007; _ga=GA1.1.121593812.1765194010; _gcl_aw=GCL.1765194042.Cj0KCQiAi9rJBhCYARIsALyPDtu0_qZfeRW0ByLYORsq_Zp-kkeGbKNNFDI3DpiS_eKeIrsHjgeXRtgaAvclEALw_wcB; _gcl_dc=GCL.1765194042.Cj0KCQiAi9rJBhCYARIsALyPDtu0_qZfeRW0ByLYORsq_Zp-kkeGbKNNFDI3DpiS_eKeIrsHjgeXRtgaAvclEALw_wcB; _ga_WC57KJ50ZZ=GS2.1.s1765194009$o1$g1$t1765194045$j24$l0$h0; _ga_BF8Q35BMLM=GS2.1.s1765194011$o1$g1$t1765194046$j25$l0$h0; SIDCC=AKEyXzX0tR0moH1N5gxw1FEe85hatwFY73oU70_6JdgRVuGHmIZTcNBc9L_Rgj4mIaFj8AfAerA; __Secure-1PSIDCC=AKEyXzWgQMMOtqCovJGSthCe5jMqqZnDghHXS6wLwTxGAVRUDXCCNbjmuyugODU55rm9KYyJQPk; __Secure-3PSIDCC=AKEyXzU20wTUCFFrjimdD6cI_o3uS96Xd0easpESzzCjJIl16QeQd928gZsjndtnw6HxCBWQxYQ';
const ANABOT_TYPE = 'Chat';

// =================== Helper Functions ===================

function maskSensitive(url) {
  return String(url).replace(/(apikey=)[^&]+/i, '$1[MASKED]').replace(/(cookie=)[^&]+/i, '$1[MASKED]');
}

async function fetchAnabotResponse({ prompt, imageUrls = [] }) {
  // Retry logic sederhana
  const RETRY_COUNT = 3;
  
  for (let i = 0; i < RETRY_COUNT; i++) {
    try {
      const qs = new URLSearchParams();
      qs.set('prompt', prompt);
      qs.set('type', ANABOT_TYPE);
      qs.set('cookie', ANABOT_COOKIE);
      qs.set('apikey', ANABOT_APIKEY);

      // Menangani input URL gambar
      imageUrls.forEach((url, index) => {
          if(url) qs.set(`imageUrl${index === 0 ? '' : index + 1}`, url);
      });

      const requestUrl = `${ANABOT_BASE}?${qs.toString()}`;
      console.log(`→ Anabot Request:`, maskSensitive(requestUrl));
      
      const res = await axios.get(requestUrl, { 
        timeout: 60000, // 60 detik timeout
        validateStatus: s => s >= 200 && s < 500 
      });

      if (!res.data?.success || !res.data?.data?.result) {
        throw new Error('Respons API tidak valid atau data hasil tidak ditemukan.');
      }
      return res.data.data.result;

    } catch (e) {
      console.warn(`❌ Anabot attempt ${i + 1}/${RETRY_COUNT} gagal: ${e.message}`);
      if (i === RETRY_COUNT - 1) throw e;
      // Tunggu 1 detik sebelum retry
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// =================== Module Export (Format Plugin Server) ===================

module.exports = {
  name: 'gemini ai',
  desc: 'tanya jawab dengan ai gemini (support text & image url)',
  category: 'ai',
  method: 'get',           // Bisa diakses via GET
  path: '/gemini',         // Endpoint: /api/ai/gemini
  params: ['prompt', 'url'], // Parameter yang dibutuhkan
  example: '/api/ai/gemini?prompt=jelaskan+gambar+ini&url=https://example.com/gambar.jpg', // Contoh untuk /api/info
  
  run: async (req, res) => {
    try {
      // 1. Ambil data dari Query Parameter
      const { prompt, url } = req.query;

      // 2. Validasi Input
      if (!prompt) {
        return res.status(400).json({
          status: false,
          message: 'parameter "prompt" wajib diisi.',
          example: '/api/ai/gemini?prompt=halo&url=OPTIONAL_IMAGE_URL'
        });
      }

      // 3. Proses Gambar (Jika ada URL)
      const imageUrls = [];
      if (url) {
        // Validasi sederhana apakah itu URL
        if (/^https?:\/\//i.test(url)) {
            imageUrls.push(url);
        } else {
            return res.status(400).json({
                status: false,
                message: 'parameter "url" harus berupa link gambar yang valid (http/https).'
            });
        }
      }

      // 4. Panggil Fungsi AI
      const result = await fetchAnabotResponse({
        prompt: prompt,
        imageUrls: imageUrls
      });

      // 5. Kirim Response JSON ke User
      // Kita cek apakah hasilnya gambar atau teks
      const responseData = {
        status: true,
        creator: "haikal",
        data: {
            text: result.text || null,
            image_response: result.url || null // Jika Gemini membalas dengan gambar
        }
      };

      return res.json(responseData);

    } catch (err) {
      console.error('error gemni plugin:', err);
      return res.status(500).json({
        status: false,
        message: 'terjadi kesalahan internal pada server.',
        error: err.message
      });
    }
  }
};