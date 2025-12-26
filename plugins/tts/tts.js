const axios = require('axios');

// Konfigurasi Data Tokoh
const TOKOH_DATA = {
    jokowi: {
        speed: -25,
        model: 'id-ID-ArdiNeural-Male',
        tune: -3
    },
    megawati: {
        speed: -16,
        model: 'id-ID-GadisNeural-Female',
        tune: 2
    },
    prabowo: {
        speed: -25,
        model: 'id-ID-ArdiNeural-Male',
        tune: 2
    }
};

// Fungsi Helper: Polling Audio dari Hugging Face
async function waitForAudio(session_hash) {
    for (let i = 0; i < 20; i++) { // Coba selama 40 detik (20 x 2s)
        try {
            const { data } = await axios.get(`https://deddy-tts-rvc-tokoh-indonesia.hf.space/queue/data?session_hash=${session_hash}`);
            const lines = data.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const d = JSON.parse(line.substring(6));
                    if (d.msg === 'process_completed') {
                        return d.output.data[2].url;
                    }
                }
            }
        } catch (e) {
            // Abaikan error polling sementara, lanjut loop
        }
        await new Promise(r => setTimeout(r, 2000)); // Delay 2 detik
    }
    throw new Error('Timeout: Gagal mendapatkan audio dari server pusat.');
}

// Fungsi Helper: Logic Utama Generate TTS
async function generateTTSTokoh(text, tokoh) {
    const session_hash = Math.random().toString(36).substring(2);
    const dataTokoh = TOKOH_DATA[tokoh];

    // Request masuk antrian
    await axios.post('https://deddy-tts-rvc-tokoh-indonesia.hf.space/queue/join?', {
        data: [
            tokoh,
            dataTokoh.speed,
            text,
            dataTokoh.model,
            dataTokoh.tune,
            'rmvpe',
            0.5,
            0.33
        ],
        event_data: null,
        fn_index: 0,
        trigger_id: 20,
        session_hash
    });

    // Tunggu hasil
    const audioUrl = await waitForAudio(session_hash);
    return audioUrl;
}

// FORMAT PLUGIN SESUAI SERVER.JS
module.exports = {
    name: 'TTS Tokoh Indonesia',
    desc: 'Mengubah teks menjadi suara tokoh (Jokowi, Megawati, Prabowo)',
    category: 'TTS', // Kategori folder
    method: 'GET',   // Method API
    path: '/tokoh',  // Endpoint nanti jadi: /api/tts/tokoh
    
    // Parameter untuk dokumentasi otomatis server.js
    params: [
        { name: 'text', required: true },
        { name: 'tokoh', required: true }
    ],
    
    example: '/api/tts/tokoh?text=Halo%20selamat%20pagi&tokoh=jokowi',

    // Fungsi Utama yang dijalankan server
    run: async (req, res) => {
        const { text, tokoh } = req.query;

        // Validasi Input
        if (!text) {
            return res.status(400).json({
                status: false,
                message: 'Parameter "text" tidak boleh kosong.'
            });
        }

        if (text.length > 200) {
             return res.status(400).json({
                status: false,
                message: 'Teks terlalu panjang. Maksimal 200 karakter.'
            });
        }

        const selectedTokoh = tokoh ? tokoh.toLowerCase() : '';
        if (!TOKOH_DATA[selectedTokoh]) {
            return res.status(400).json({
                status: false,
                message: `Tokoh tidak valid. Pilihan: ${Object.keys(TOKOH_DATA).join(', ')}`
            });
        }

        try {
            // Generate URL Audio
            const audioUrl = await generateTTSTokoh(text, selectedTokoh);

            // Fetch Audio Buffer agar user langsung download file, bukan link
            const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });

            // Kirim sebagai file audio
            res.set('Content-Type', 'audio/mp4');
            res.send(response.data);

        } catch (err) {
            console.error(err);
            res.status(500).json({
                status: false,
                message: 'Gagal memproses audio.',
                error: err.message
            });
        }
    }
};