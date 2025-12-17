const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// --- PERBAIKAN: GUNAKAN GLOBAL VARIABLE, BUKAN FILE ---
// Kita simpan stats di variable global agar bisa diakses di mana saja
global.apiStats = {
  total: 0,
  endpoints: {}
};

// Fungsi untuk menambah Hit (Versi Memory)
const addHit = (endpoint) => {
  // Tambah total global
  global.apiStats.total += 1;
  
  // Tambah hit spesifik endpoint
  if (!global.apiStats.endpoints[endpoint]) {
    global.apiStats.endpoints[endpoint] = 0;
  }
  global.apiStats.endpoints[endpoint] += 1;
};
// ----------------------------------

app.set('json spaces', 2);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { status: false, message: 'Terlalu banyak request, coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Fungsi auto-register plugins
function registerPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins');
  const apiList = [];
  let registeredCount = 0;

  if (!fs.existsSync(pluginsDir)) {
    console.log('Folder plugins tidak ditemukan.');
    return { count: 0, list: [] };
  }

  const categories = fs.readdirSync(pluginsDir)
    .filter(file => fs.statSync(path.join(pluginsDir, file)).isDirectory());

  categories.forEach(category => {
    const categoryPath = path.join(pluginsDir, category);
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    files.forEach(file => {
      const filePath = path.join(categoryPath, file);
      const plugin = require(filePath);

      if (!plugin.name || !plugin.desc || !plugin.method || !plugin.path || typeof plugin.run !== 'function') {
        return;
      }

      if (!plugin.category) {
        plugin.category = category.charAt(0).toUpperCase() + category.slice(1);
      }

      const method = plugin.method.toLowerCase();
      let fullPath = plugin.path;
      if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;
      fullPath = `/${plugin.category.toLowerCase()}${fullPath}`;

      if (['get', 'post', 'put', 'delete'].includes(method)) {
        app[method](fullPath, async (req, res) => {
          try {
            // --- TRACKING HIT (MEMORY) ---
            addHit(fullPath); 
            // -----------------------------
            await plugin.run(req, res);
          } catch (err) {
            console.error(`Error di ${fullPath}:`, err.message);
            res.status(500).json({ status: false, message: 'Server Error' });
          }
        });

        registeredCount++;

        const apiInfo = {
          nama: plugin.name,
          deskripsi: plugin.desc,
          kategori: plugin.category,
          method: plugin.method.toUpperCase(),
          endpoint: fullPath
        };
        
        if (plugin.params) apiInfo.parameter = plugin.params;
        if (plugin.example) apiInfo.contoh = plugin.example;

        apiList.push(apiInfo);
      }
    });
  });

  return { count: registeredCount, list: apiList };
}

const { count, list: apiList } = registerPlugins();

// Endpoint /api/info (Versi Memory)
app.get('/api/info', (req, res) => {
  try {
    // Ambil stats dari memory global
    const statsData = global.apiStats;

    const formattedApis = apiList.map(api => ({
        ...api,
        // Ambil info hit dari memory
        total_hit: statsData.endpoints[api.endpoint] || 0
    }));

    const response = {
      status: true,
      server: "REST API Premium",
      total_endpoints: formattedApis.length,
      total_requests: statsData.total, // Total dari memory
      endpoint_categories: [...new Set(formattedApis.map(api => api.kategori))],
      apis: formattedApis.sort((a, b) => a.kategori.localeCompare(b.kategori))
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Endpoint standard
app.get('/api/health', (req, res) => res.json({ status: true, message: 'Healthy' }));
app.get('/api/ping', (req, res) => res.json({ status: true, message: 'Running' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ status: false, message: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});