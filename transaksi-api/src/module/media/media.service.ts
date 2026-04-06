import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Pastikan folder uploads ada saat aplikasi jalan
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async findAll() {
    const files = fs.readdirSync(this.uploadDir);
    
    return files.map((file) => {
      const filePath = path.join(this.uploadDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        fileName: file,
        filePath: file, // Karena kita akses via static serve
        fileSize: stats.size,
        createdAt: stats.birthtime,
        // Deteksi tipe file sederhana dari ekstensi
        fileType: path.extname(file).replace('.', ''), 
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Urutkan terbaru
  }

  async remove(fileName: string) {
    const filePath = path.join(this.uploadDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { message: 'File deleted successfully' };
    }
    throw new NotFoundException('File tidak ditemukan');
  }
}