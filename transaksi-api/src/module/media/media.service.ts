import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly baseDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
  }

  // Helper untuk mencegah path traversal (keamanan)
  private getFullPath(reqPath: string) {
    const safePath = path.normalize(reqPath || '/').replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.baseDir, safePath);
  }

  async findAll(folderPath: string = '') {
    const targetDir = this.getFullPath(folderPath);
    if (!fs.existsSync(targetDir)) throw new NotFoundException('Folder tidak ditemukan');

    const items = fs.readdirSync(targetDir);
    const result = items.map(item => {
      const itemPath = path.join(targetDir, item);
      const stats = fs.statSync(itemPath);
      const isDir = stats.isDirectory();
      
      const relPath = folderPath ? `${folderPath}/${item}` : item; // Path relatif
      
      return {
        name: item,
        isDir,
        path: relPath, 
        url: isDir ? null : `/uploads/${relPath}`,
        size: stats.size,
        createdAt: stats.birthtime,
        fileType: isDir ? 'folder' : path.extname(item).toLowerCase().replace('.', ''),
      };
    });

    // Urutkan: Folder di atas, lalu file (diurutkan dari yang terbaru)
    return result.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  async createFolder(folderPath: string, folderName: string) {
    const targetDir = path.join(this.getFullPath(folderPath), folderName);
    if (fs.existsSync(targetDir)) throw new BadRequestException('Folder sudah ada');
    fs.mkdirSync(targetDir, { recursive: true });
    return { message: 'Folder berhasil dibuat' };
  }

  async handleUpload(file: Express.Multer.File, folderPath: string = '') {
    const targetDir = this.getFullPath(folderPath);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Pindahkan file dari tempat temp ke folder target
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const finalName = `${uniqueSuffix}${ext}`;
    const finalPath = path.join(targetDir, finalName);

    fs.renameSync(file.path, finalPath);

    return {
      message: 'Upload berhasil',
      fileName: finalName,
      url: `/uploads/${(folderPath ? folderPath + '/' : '')}${finalName}`
    };
  }

  async remove(targetPath: string) {
    const fullPath = this.getFullPath(targetPath);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Item tidak ditemukan');

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    return { message: 'Berhasil dihapus' };
  }
}