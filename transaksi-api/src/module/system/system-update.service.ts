// src/module/system/system-update.service.ts
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class SystemUpdateService {
  private readonly repoUrl = 'https://api.github.com/repos/api-diengcyber/transaksi/releases/latest';

  async checkLatestVersion() {
    try {
      const response = await axios.get(this.repoUrl);
      const zipAsset = response.data.assets.find(asset => asset.name.endsWith('.zip'));
      return {
        version: response.data.tag_name, 
        description: response.data.body,
        zipUrl: zipAsset ? zipAsset.browser_download_url : null,
        published_at: response.data.published_at,
      };
    } catch (error) {
      throw new InternalServerErrorException('Gagal mengambil data rilis GitHub');
    }
  }

  private updatePackageVersion(filePath: string, newVersion: string) {
    if (fs.existsSync(filePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        pkg.version = newVersion.replace(/^v/, ''); 
        fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2), 'utf8');
      } catch (e) {
        console.error(`Gagal menulis ke ${filePath}:`, e);
      }
    }
  }

  async executeUpdate(zipUrl: string, version: string) {
    if (!zipUrl) throw new BadRequestException('URL ZIP tidak ditemukan');

    // Folder sementara di dalam folder API aktif
    const tempDir = path.join(process.cwd(), 'temp_update');
    const zipPath = path.join(tempDir, 'update.zip');

    try {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      // 1. Download File ZIP
      const writer = fs.createWriteStream(zipPath);
      const response = await axios({ url: zipUrl, method: 'GET', responseType: 'stream' });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
      });

      // 2. Ekstrak ZIP
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);

      /**
       * 3. Logika Path Electron (Folder Resources)
       * Asumsi: Struktur di server/lokal adalah:
       * .../resources/api  <-- Tempat NestJS berjalan
       * .../resources/app  <-- Tempat Frontend Electron
       */
      const resourcesPath = path.join(process.cwd(), '..'); 
      const apiPath = path.join(resourcesPath, 'api');
      const appPath = path.join(resourcesPath, 'app');

      // 4. Update Versi package.json di folder temp sebelum dicopy
      this.updatePackageVersion(path.join(tempDir, 'api', 'package.json'), version);
      this.updatePackageVersion(path.join(tempDir, 'app', 'package.json'), version);

      // 5. Proses Pindahan (Menimpa file lama)
      // Menggunakan perintah shell agar lebih cepat menangani banyak file/folder
      const isWindows = process.platform === "win32";

      // Update API
      const extractedApi = path.join(tempDir, 'api');
      if (fs.existsSync(extractedApi)) {
        if (isWindows) {
            await execPromise(`xcopy "${extractedApi}" "${apiPath}" /E /I /Y`);
        } else {
            await execPromise(`cp -R ${extractedApi}/* ${apiPath}/`);
        }
      }

      // Update APP (Frontend)
      const extractedApp = path.join(tempDir, 'app');
      if (fs.existsSync(extractedApp)) {
        if (isWindows) {
            await execPromise(`xcopy "${extractedApp}" "${appPath}" /E /I /Y`);
        } else {
            await execPromise(`cp -R ${extractedApp}/* ${appPath}/`);
        }
      }

      // 6. Cleanup folder temp
      fs.rmSync(tempDir, { recursive: true, force: true });

      // 7. Post-Update (Hanya untuk environment development/self-managed server)
      // Jika di aplikasi Electron production yang sudah dipackage (.exe/.app), 
      // perintah ini mungkin tidak diperlukan atau berbeda.
      const buildCommand = `cd ${apiPath} && pnpm install && pnpm build && pm2 restart all`;
      
      // Jalankan tanpa menunggu (detached) agar API bisa kirim response sukses dulu
      exec(buildCommand);

      return { 
        success: true, 
        message: `Berhasil memperbarui ke versi ${version}. Aplikasi sedang melakukan sinkronisasi ulang.` 
      };

    } catch (error) {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      console.error("Update Error:", error);
      throw new InternalServerErrorException(`Proses update gagal: ${error}`);
    }
  }
}