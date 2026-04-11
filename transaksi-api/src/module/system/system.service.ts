import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SystemService {
  // Tentukan path ke folder log Anda.
  // Misalnya kita taruh di folder 'logs' di root project NestJS
  private readonly logDirectory = path.join(process.cwd(), 'logs');
  private readonly defaultLogFile = path.join(this.logDirectory, 'api.log');

  constructor() {
    // Pastikan folder logs ada saat service diinisialisasi
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
    // Buat file log kosong jika belum ada agar tidak error saat dibaca pertama kali
    if (!fs.existsSync(this.defaultLogFile)) {
        fs.writeFileSync(this.defaultLogFile, '');
    }
  }

  // --- FUNGSI UNTUK MENULIS LOG (Opsional digunakan di Exception Filter) ---
  writeLog(message: string, type: 'INFO' | 'ERROR' = 'INFO') {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${type}] ${message}\n`;
      
      // Append (tambahkan) log ke baris baru
      fs.appendFileSync(this.defaultLogFile, logMessage);
  }

  // --- [UTAMA] FUNGSI UNTUK MEMBACA/MENGAMBIL LOG ---
  async getSystemLogs() {
    try {
      if (!fs.existsSync(this.defaultLogFile)) {
          throw new NotFoundException('File log tidak ditemukan.');
      }

      // Membaca isi file log
      const logContent = fs.readFileSync(this.defaultLogFile, 'utf8');

      // Membatasi ukuran log yang dikirim agar response tidak terlalu berat (opsional)
      // Misalnya ambil 1000 baris terakhir saja
      const logLines = logContent.split('\n').filter(line => line.trim() !== '');
      const last1000Lines = logLines.slice(-1000).join('\n');

      return {
          success: true,
          data: last1000Lines || 'Log masih kosong.'
      };
    } catch (error) {
      console.error('Error reading log file:', error);
      throw new InternalServerErrorException('Gagal membaca file log sistem.');
    }
  }
}