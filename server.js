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

// Fungsi auto-register plugins dengan support params dan logging
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

      // Validasi plugin
      if (!plugin.name || !plugin.desc || !plugin.method || !plugin.path || typeof plugin.run !== 'function') {
        console.error(`Plugin ${file} tidak valid: Missing required properties (name, desc, method, path, run)`);
        return;
      }

      // Set default category jika belum ada
      if (!plugin.category) {
        plugin.category = category.charAt(0).toUpperCase() + category.slice(1);
      }

      const method = plugin.method.toLowerCase();
      
      // Format path
      let fullPath = plugin.path;
      if (!fullPath.startsWith('/')) {
        fullPath = '/' + fullPath;
      }
      // Tambahkan kategori di depan path
      fullPath = `/${plugin.category.toLowerCase()}${fullPath}`;

      // Register route
      if (['get', 'post', 'put', 'delete'].includes(method)) {
        app[method](fullPath, async (req, res) => {
          try {
            // --- TRACKING HIT (MEMORY) ---
            addHit(fullPath); 
            // -----------------------------
            await plugin.run(req, res);
          } catch (err) {
            console.error(`Error di ${fullPath}:`, err.message);
            res.status(500).json({ 
              status: false, 
              message: 'Internal Server Error: ' + err.message 
            });
          }
        });

        console.log(`Registered: ${method.toUpperCase()} ${fullPath} -> ${plugin.name}`);
        registeredCount++;

        // Tambahkan ke daftar API dengan informasi params (diadopsi dari kode kedua)
        const apiInfo = {
          nama: plugin.name,
          deskripsi: plugin.desc,
          kategori: plugin.category,
          method: plugin.method.toUpperCase(),
          endpoint: fullPath
        };

        // Jika plugin memiliki params, tambahkan ke info
        if (plugin.params && Array.isArray(plugin.params)) {
          apiInfo.parameter = plugin.params.map(param => ({
            nama: param,
            tipe: 'query', // Asumsi default adalah query parameter
            required: true // Asumsi default adalah required
          }));
          
          // Tambahkan contoh penggunaan otomatis jika GET
          if (method === 'get' && !plugin.example) {
            const exampleParams = plugin.params.map(p => `${p}=value`).join('&');
            apiInfo.contoh = `${fullPath}?${exampleParams}`;
          }
        }

        // Tambahkan contoh jika ada di plugin (override yang dibuat otomatis)
        if (plugin.example) {
          apiInfo.contoh = plugin.example;
        }

        apiList.push(apiInfo);
      }
    });
  });

  return { count: registeredCount, list: apiList };
}

// Register semua plugin
const { count, list: apiList } = registerPlugins();

// Endpoint /api/info (Versi Memory dengan detail)
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
      version: "1.0.0", // Tambahan
      total_endpoints: formattedApis.length,
      total_requests: statsData.total, // Total dari memory
      endpoint_categories: [...new Set(formattedApis.map(api => api.kategori))],
      apis: formattedApis.sort((a, b) => {
        // Sort by category first, then by name
        if (a.kategori !== b.kategori) {
          return a.kategori.localeCompare(b.kategori);
        }
        return a.nama.localeCompare(b.nama);
      })
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error in /api/info endpoint:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Failed to load API information',
      error: error.message
    });
  }
});

// Endpoint untuk test koneksi
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    total_plugins: count
  });
});

// Test endpoint
app.get('/api/ping', (req, res) => {
  res.status(200).json({
    status: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Route utama - serve frontend
app.get('/', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve semua file statis dari public (diadopsi dari kode kedua)
app.get('/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public', filename);
  
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory() && !filename.includes('..')) {
    res.sendFile(filePath);
  } else {
    next(); // Lanjutkan ke 404 handler
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    status: false, 
    message: 'Endpoint tidak ditemukan',
    requested_url: req.originalUrl,
    method: req.method,
    available_endpoints: '/api/info'
  });
});

// Global Error Handler (diadopsi dari kode kedua)
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).json({ 
    status: false, 
    message: 'Server Error: ' + err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📊 Total plugin terdaftar: ${count}`);
  
  // Tampilkan semua endpoint yang terdaftar (diadopsi dari kode kedua)
  if (apiList.length > 0) {
    console.log('\n📋 Endpoint yang tersedia:');
    const categories = {};
    
    apiList.forEach(api => {
      if (!categories[api.kategori]) {
        categories[api.kategori] = [];
      }
      categories[api.kategori].push(api);
    });
    
    Object.keys(categories).sort().forEach(category => {
      console.log(`  📁 ${category}:`);
      categories[category].forEach(api => {
        const paramInfo = api.parameter ? ` [${api.parameter.map(p => p.nama).join(', ')}]` : '';
        console.log(`    ${api.method} ${api.endpoint} - ${api.nama}${paramInfo}`);
      });
    });
  } else {
    console.log('\n⚠️  Tidak ada plugin yang terdaftar. Pastikan folder "plugins" berisi plugin.');
  }
  
  console.log(`\n📚 Dokumentasi: http://localhost:${PORT}`);
  console.log(`🔍 API Info: http://localhost:${PORT}/api/info`);
  console.log(`🏓 Health Check: http://localhost:${PORT}/api/health`);
});