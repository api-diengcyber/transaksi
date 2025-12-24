const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net'); // Tambahkan module net untuk cek port
const BaseMySQLManager = require('./base-manager');

class DarwinMySQLManager extends BaseMySQLManager {
    /**
     * Mengecek apakah port sudah digunakan
     * Return true jika port sudah terbuka (ada engine berjalan)
     */
    checkPort(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true); // Port dipakai
                } else {
                    resolve(false);
                }
            });
            server.once('listening', () => {
                server.close();
                resolve(false); // Port kosong
            });
            server.listen(port, '127.0.0.1');
        });
    }

    fixPermissions(targetPath) {
        if (!fs.existsSync(targetPath)) return;
        try {
            fs.chmodSync(targetPath, '755');
            if (fs.statSync(targetPath).isDirectory()) {
                fs.readdirSync(targetPath).forEach(child => this.fixPermissions(path.join(targetPath, child)));
            }
        } catch (err) {}
    }

    async start() {
        console.log('------------------------------------------------');
        console.log('Checking MariaDB Engine on port 8889...');

        // 1. Cek apakah engine sudah berjalan
        const isPortUsed = await this.checkPort(8889);
        if (isPortUsed) {
            console.log('✅ MariaDB Engine is already running on port 8889.');
            console.log('🚀 Skipping initialization and start process.');
            return null; // Keluar dari fungsi, tidak perlu start lagi
        }

        console.log('Starting MySQL Manager (Darwin/macOS)...');

        const binPath = path.join(this.mysqlBaseDir, 'bin');
        const mysqlBin = path.join(binPath, 'mariadbd');
        const installScript = path.join(this.mysqlBaseDir, 'scripts', 'mariadb-install-db');

        this.fixPermissions(this.mysqlBaseDir);

        if (!fs.existsSync(this.mysqlData)) {
            fs.mkdirSync(this.mysqlData, { recursive: true });
        }

        const systemDbPath = path.join(this.mysqlData, 'mysql');
        if (!fs.existsSync(systemDbPath)) {
            console.log('📦 Initializing system tables...');
            
            const customEnv = Object.assign({}, process.env, {
                PATH: `${binPath}:${process.env.PATH}`
            });

            const initRes = spawnSync(installScript, [
                '--no-defaults',
                `--datadir=${this.mysqlData}`,
                `--basedir=${this.mysqlBaseDir}`,
                `--user=${os.userInfo().username}`,
                '--auth-root-authentication-method=normal'
            ], { 
                cwd: this.mysqlBaseDir, 
                env: customEnv,
                encoding: 'utf-8' 
            });

            if (initRes.status !== 0) {
                console.error('❌ Inisialisasi Gagal:', initRes.stderr || initRes.stdout);
            } else {
                console.log('✅ Inisialisasi Berhasil.');
            }
        }

        this.prepareInitSql();

        this.dbProcess = spawn(mysqlBin, [
            '--no-defaults',
            '--port=8889',
            `--datadir=${this.mysqlData}`,
            '--bind-address=127.0.0.1',
            '--lower-case-table-names=2',
            `--init-file=${this.initSqlPath}`
        ], { 
            cwd: this.mysqlBaseDir,
            env: Object.assign({}, process.env, { PATH: `${binPath}:${process.env.PATH}` })
        });

        this.dbProcess.stdout.on('data', (data) => console.log(`[MySQL]: ${data.toString().trim()}`));
        this.dbProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('ERROR')) console.error(`🔴 [MySQL Error]: ${msg.trim()}`);
            else console.log(`🟡 [MySQL Note]: ${msg.trim()}`);
        });

        return this.dbProcess;
    }
}

module.exports = DarwinMySQLManager;