module.exports = {
    name: "total hit api",
    desc: "menampilkan total hit (jumlah akses) pada semua endpoint api (in-memory).",
    category: "info",
    method: "GET",
    path: "/hit-stats",
    params: ["detail"], 
    
    async run(req, res) {
        try {
            const showDetail = req.query.detail === 'true';

            // Ambil data dari Global Variable (Memory)
            // Jika belum ada (baru start), gunakan default 0
            const statsData = global.apiStats || { total: 0, endpoints: {} };
            
            const endpoints = statsData.endpoints || {};
            const totalRequests = statsData.total || 0;
            const categoryHits = {};

            // Logika sorting dan grouping sama seperti sebelumnya
            for (const endpoint in endpoints) {
                const match = endpoint.match(/^\/([a-z0-9]+)\//i); 
                let category = 'Uncategorized';
                if (match && match[1]) category = match[1].charAt(0).toUpperCase() + match[1].slice(1);

                if (!categoryHits[category]) {
                    categoryHits[category] = { count: 0, endpoints: [] };
                }
                
                categoryHits[category].count += endpoints[endpoint];
                categoryHits[category].endpoints.push({
                    endpoint: endpoint,
                    hit: endpoints[endpoint]
                });
            }

            const response = {
                status: true,
                creator: "haikal",
                storage_mode: "memory (resets on restart)", // Info bahwa ini di memori
                total_requests: totalRequests,
                total_endpoints_tracked: Object.keys(endpoints).length,
                timestamp: new Date().toISOString()
            };

            if (showDetail) {
                response.detail_per_category = {};
                const sortedCategories = Object.keys(categoryHits).sort();
                for (const category of sortedCategories) {
                    response.detail_per_category[category] = {
                        total_hit: categoryHits[category].count,
                        endpoints: categoryHits[category].endpoints.sort((a, b) => b.hit - a.hit)
                    };
                }
            } else {
                response.total_per_category = {};
                Object.keys(categoryHits).sort().forEach(category => {
                    response.total_per_category[category] = categoryHits[category].count;
                });
            }

            res.status(200).json(response);

        } catch (err) {
            console.error("error in /info/hit-stats:", err);
            res.status(500).json({ status: false, message: err.message });
        }
    }
};