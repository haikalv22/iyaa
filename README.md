```markdown
# My REST API Premium

REST API modular sederhana berbasis **Express.js** dengan fitur auto-loading plugin, dokumentasi otomatis, dan frontend cantik & responsif menggunakan **Tailwind CSS via CDN**.

## Fitur Utama
- Auto-register semua endpoint dari folder `plugins` (tanpa router manual)
- Dokumentasi API otomatis di `/api/info`
- Frontend responsif dengan desain modern (mobile & desktop friendly)
- Favicon support (`public/icon.png`)
- Rate limiting untuk keamanan dasar
- Response JSON rapi dengan status code yang benar (200, 404, 500, dll)
- Mudah dikembangkan: tambah file plugin baru → otomatis terdaftar

## Struktur Folder
```
my-rest-api/
├── server.js              # File utama server
├── package.json           # Dependensi project
├── public/
│   ├── index.html         # Halaman frontend
│   └── icon.png           # Favicon website (32x32 atau 64x64 PNG)
└── plugins/
    └── user/
        └── totalfitur.js  # Contoh plugin
```

## Instalasi
1. Clone atau copy folder project ini
2. Buka terminal di folder project
3. Jalankan perintah berikut:

```bash
npm install
```

## Menjalankan Server
- Development (dengan auto-restart):
  ```bash
  npm run dev
  ```
- Production:
  ```bash
  npm start
  ```

Server akan berjalan di: **http://localhost:3000**

## Cara Menambah Endpoint Baru
1. Buat folder kategori baru di `plugins/` (misal: `downloader`, `ai`, dll)
2. Buat file `.js` di dalamnya dengan format berikut:

```js
module.exports = {
  name: "Nama Endpoint",
  desc: "Deskripsi singkat endpoint",
  category: "Kategori",          // optional
  method: "GET",                 // GET, POST, PUT, DELETE
  path: "/nama-endpoint",        // contoh: /youtube
  example: "curl http://localhost:3000/api/nama-endpoint", // optional

  async run(req, res) {
    // Logic endpoint di sini
    res.status(200).json({ status: true, data: "Hello World" });
  }
};
```

Endpoint akan otomatis terdaftar dan muncul di halaman dokumentasi!

## Akses
- **Frontend / Dokumentasi**: http://localhost:3000
- **API Info (JSON)**: http://localhost:3000/api/info
- **Contoh Endpoint**: http://localhost:3000/api/total

## Catatan
- Taruh file `icon.png` di folder `public/` agar favicon muncul.
- Project ini menggunakan Tailwind CSS via CDN → tidak perlu build CSS.

Selamat mencoba! 🚀
```
