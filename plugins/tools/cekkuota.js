const fetch = require('node-fetch');

module.exports = {
    // Properti Wajib untuk server.js
    name: "cek kuota axis/xl",
    desc: "cek detail kuota dan masa aktif kartu axis atau xl",
    method: "GET",
    category: "tools",
    path: "/cekkuota",
    params: ["number"], // Parameter yang dibutuhkan di URL
    example: "/api/tools/cekkuota?number=0878xxxx",

    // Logika Utama
    run: async (req, res) => {
        const { number } = req.query;

        // 1. Validasi Input
        if (!number) {
            return res.json({
                status: false,
                message: "parameter 'number' wajib diisi. contoh: 0878xxx"
            });
        }

        if (!/^\d+$/.test(number)) {
            return res.json({
                status: false,
                message: "format nomor salah, harap hanya gunakan angka."
            });
        }

        try {
            // 2. Logika API (Sama seperti bot, tapi disesuaikan)
            const url = 'https://bendith.my.id/end.php';
            const params = new URLSearchParams({
                check: 'package',
                number: number,
                version: '2'
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Origin': 'https://bendith.my.id',
                    'Referer': 'https://bendith.my.id/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Infinix X652B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.94 Mobile Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`http error status: ${response.status}`);
            }

            const data = await response.json();

            // 3. Cek Error dari Provider API
            if (!data.success || !data.data) {
                return res.json({
                    status: false,
                    message: data.message || 'gagal mengambil data dari provider.'
                });
            }

            // 4. Formatting Response untuk Web API (JSON)
            // Kita kembalikan JSON rapi agar bisa diolah frontend/user
            const info = data.data.subs_info;
            const packageInfo = data.data.package_info;
            
            // Opsional: Jika ingin tetap menyertakan format teks ala WhatsApp
            // Kamu bisa menyimpannya di field 'formatted_text'
            
            res.json({
                status: true,
                creator: "haikal",
                data: {
                    nomor: info.msisdn,
                    provider: info.operator,
                    status_kartu: {
                        registrasi: info.id_verified,
                        jaringan: info.net_type,
                        umur_kartu: info.tenure,
                        masa_aktif: info.exp_date,
                        masa_tenggang: info.grace_until
                    },
                    paket: packageInfo.packages || [],
                    raw_error: packageInfo.error_message || null
                }
            });

        } catch (error) {
            console.error("error cekkuota:", error);
            res.status(500).json({
                status: false,
                message: 'internal server error',
                error: error.message
            });
        }
    }
};