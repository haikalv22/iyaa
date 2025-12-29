const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- KELAS UNBLUR UPSCALER (Dari Kodemu) ---
class UnblurUpscaler {
  constructor() {
    this.apiHost = 'https://api.unblurimage.ai';
    this.productSerial = 'b8f269563db275c805d81a5ecd1a8709';
    this.userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36';
  }

  async uploadImage(filePath) {
    const form = new FormData();
    form.append('original_image_file', fs.createReadStream(filePath));

    const response = await axios.post(`${this.apiHost}/api/imgupscaler/v2/image-upscaler-v2/create-job`, form, {
      headers: {
        ...form.getHeaders(),
        'product-serial': this.productSerial,
        'user-agent': this.userAgent,
        'origin': 'https://unblurimage.ai',
        'referer': 'https://unblurimage.ai/'
      }
    });

    if (response.data && response.data.result) {
      return response.data.result.job_id || this.extractJobId(response.data.result.input_url);
    }
    return null;
  }

  extractJobId(url) {
    if (!url) return null;
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.split('_')[0];
  }

  async checkStatus(jobId) {
    const response = await axios.get(`${this.apiHost}/api/imgupscaler/v2/image-upscaler-v2/get-job/${jobId}`, {
      headers: {
        'product-serial': this.productSerial,
        'user-agent': this.userAgent,
        'origin': 'https://unblurimage.ai',
        'referer': 'https://unblurimage.ai/'
      }
    });
    return response.data;
  }

  async process(imagePath) { // Typo fix: proccess -> process
    try {
      const jobId = await this.uploadImage(imagePath);
      if (!jobId) return { success: false, message: 'Gagal mendapatkan Job ID' };

      // Polling status
      while (true) {
        const status = await this.checkStatus(jobId);
        
        if (status.code === 100000) {
          return {
            success: true,
            url: status.result.output_url[0]
          };
        }

        if (status.code !== 300006) { // 300006 biasanya code 'processing'
          return {
            success: false,
            message: status.message?.en || 'Unknown error'
          };
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// --- HELPER UNTUK DOWNLOAD ---
const downloadImage = async (url, filepath) => {
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// --- MODULE EXPORT (Format Plugin Server.js) ---
module.exports = {
  name: 'Unblur Image AI',
  desc: 'Memperjelas dan meningkatkan resolusi gambar yang buram.',
  category: 'Tools',
  method: 'GET',
  path: '/unblur',
  params: [
    { name: 'url', required: true }
  ],
  example: '/api/tools/unblur?url=https://example.com/foto_buram.jpg',
  
  run: async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.json({
        status: false,
        message: 'Parameter url diperlukan!'
      });
    }

    // Path sementara untuk menyimpan gambar
    const tempFileName = `unblur_${Date.now()}.jpg`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      // 1. Download gambar dari URL user
      await downloadImage(url, tempFilePath);

      // 2. Proses menggunakan Class UnblurUpscaler
      const Upscaler = new UnblurUpscaler();
      const result = await Upscaler.process(tempFilePath);

      // 3. Kirim respon
      if (result.success) {
        res.json({
          status: true,
          message: 'Berhasil unblur gambar',
          result: {
            original_url: url,
            upscaled_url: result.url
          }
        });
      } else {
        res.json({
          status: false,
          message: result.message || result.error || 'Gagal memproses gambar'
        });
      }

    } catch (error) {
      console.error(error);
      res.json({
        status: false,
        message: 'Terjadi kesalahan internal',
        error: error.message
      });
    } finally {
      // 4. PENTING: Hapus file sementara agar server tidak penuh
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
};