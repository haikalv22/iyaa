const fs = require("fs");
const path = require("path");

// Tentukan lokasi file stats.json relatif dari lokasi plugin.
// plugins/info/hit-stats.js -> plugins/info/ -> plugins/ -> database/stats.json
const STATS_FILE_PATH = path.join(__dirname, "..", "..", "database", "stats.json");

module.exports = {
    name: "total hit api",
    desc: "menampilkan total hit (jumlah akses) pada semua endpoint api",
    category: "info",
    method: "GET",
    path: "/hit-stats",
    // Tambahkan params agar terlihat di /api/info
    params: ["detail"], 
    
    async run(req, res) {
        try {
            const showDetail = req.query.detail === 'true';

            if (!fs.existsSync(STATS_FILE_PATH)) {
                return res.status(200).json({
                    status: true,
                    total_requests: 0,
                    message: "file statistik belum ditemukan. mungkin server baru di-deploy atau belum ada hit."
                });
            }

            // Baca data statistik
            const statsData = JSON.parse(fs.readFileSync(STATS_FILE_PATH, 'utf-8'));
            const endpoints = statsData.endpoints || {};
            const totalRequests = statsData.total || 0;

            const categoryHits = {};

            // Hitung total hit per kategori
            for (const endpoint in endpoints) {
                // Endpoint format: /kategori/path
                const match = endpoint.match(/^\/([a-z0-9]+)\//i); 
                let category = 'Uncategorized';
                
                if (match && match[1]) {
                    // Ambil nama kategori dari path dan ubah huruf pertama jadi kapital
                    category = match[1].charAt(0).toUpperCase() + match[1].slice(1);
                }

                if (!categoryHits[category]) {
                    categoryHits[category] = {
                        count: 0,
                        endpoints: []
                    };
                }
                
                categoryHits[category].count += endpoints[endpoint];
                categoryHits[category].endpoints.push({
                    endpoint: endpoint,
                    hit: endpoints[endpoint]
                });
            }

            const response = {
                status: true,
                total_requests: totalRequests,
                total_endpoints_tracked: Object.keys(endpoints).length,
                timestamp: new Date().toISOString()
            };

            if (showDetail) {
                response.detail_per_category = {};
                
                // Urutkan kategori berdasarkan nama
                const sortedCategories = Object.keys(categoryHits).sort();

                for (const category of sortedCategories) {
                    const data = categoryHits[category];
                    
                    // Urutkan endpoint dalam kategori berdasarkan hit tertinggi
                    const sortedEndpoints = data.endpoints.sort((a, b) => b.hit - a.hit);

                    response.detail_per_category[category] = {
                        total_hit: data.count,
                        endpoints: sortedEndpoints
                    };
                }
            } else {
                // Format sederhana: hanya total hit per kategori
                response.total_per_category = {};
                
                // Urutkan kategori
                const sortedCategories = Object.keys(categoryHits).sort();
                sortedCategories.forEach(category => {
                    response.total_per_category[category] = categoryHits[category].count;
                });
            }

            res.status(200).json(response);

        } catch (err) {
            console.error("error in /info/hit-stats:", err);
            res.status(500).json({
                status: false,
                message: "terjadi kesalahan saat memproses statistik: " + err.message,
                timestamp: new Date().toISOString()
            });
        }
    }
};