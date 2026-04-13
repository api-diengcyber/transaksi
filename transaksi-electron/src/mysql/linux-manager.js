const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { app } = require('electron'); 
const BaseMySQLManager = require('./base-manager');

class LinuxMySQLManager extends BaseMySQLManager {
    constructor() {
        super();
        this.mysqlBaseDir = this.getDbBasePath();
        // Simpan data di userData (~/.config/NamaAplikasi/mariadb_data)
        this.mysqlData = path.join(app.getPath('userData'), 'mariadb_data');
    }

    getDbBasePath() {
        if (app.isPackaged) {
            // Linux AppImage unpacks to a temporary directory mounted on run
            return path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'mysql', 'linux');
        } else {
            return path.join(__dirname, '..', '..', 'bin', 'mysql', 'linux');
        }
    }

    checkPort(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') resolve(true); 
                else resolve(false);
            });
            server.once('listening', () => {
                server.close();
                resolve(false); 
            });
            server.listen(port, '127.0.0.1');
        });
    }

    // Mengembalikan izin +x (executable) yang sering hilang saat di-bundle
    fixPermissions(targetPath) {
        if (!fs.existsSync(targetPath)) return;
        try {
            fs.chmodSync(targetPath, '755');
            if (fs.statSync(targetPath).isDirectory()) {
                fs.readdirSync(targetPath).forEach(child => this.fixPermissions(path.join(targetPath, child)));
            }
        } catch (err) { }
    }

    async start() {
        console.log('------------------------------------------------');
        console.log('Starting MySQL Manager (Linux)...');

        const isPortUsed = await this.checkPort(8867);
        if (isPortUsed) {
            console.log('✅ MariaDB Engine is already running on port 8867.');
            return null; 
        }

        const binPath = path.join(this.mysqlBaseDir, 'bin');
        
        // Deteksi binary (mariadbd atau mysqld)
        let mysqlBin = path.join(binPath, 'mariadbd');
        if (!fs.existsSync(mysqlBin)) mysqlBin = path.join(binPath, 'mysqld');
        
        // Deteksi script install
        let installScript = path.join(this.mysqlBaseDir, 'scripts', 'mariadb-install-db');
        if (!fs.existsSync(installScript)) installScript = path.join(binPath, 'mariadb-install-db');
        if (!fs.existsSync(installScript)) installScript = path.join(this.mysqlBaseDir, 'scripts', 'mysql_install_db');
        if (!fs.existsSync(installScript)) installScript = path.join(binPath, 'mysql_install_db');

        // Fix Permissions untuk Linux
        this.fixPermissions(binPath);
        const scriptsPath = path.join(this.mysqlBaseDir, 'scripts');
        if (fs.existsSync(scriptsPath)) this.fixPermissions(scriptsPath);

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
            }
        }

        this.prepareInitSql();

        this.dbProcess = spawn(mysqlBin, [
            '--no-defaults',
            '--port=8867',
            `--datadir=${this.mysqlData}`,
            `--basedir=${this.mysqlBaseDir}`,
            '--bind-address=127.0.0.1',
            '--lower-case-table-names=1', // =1 Memaksa lowercase di OS yang case-sensitive seperti Linux ext4
            `--init-file=${this.initSqlPath}`
        ], { 
            cwd: this.mysqlBaseDir,
            env: Object.assign({}, process.env, { PATH: `${binPath}:${process.env.PATH}` })
        });

        this.dbProcess.stdout.on('data', (data) => console.log(`[MySQL]: ${data.toString().trim()}`));
        this.dbProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('ERROR') || msg.includes('[ERROR]')) console.error(`🔴 [MySQL Error]: ${msg.trim()}`);
            else console.log(`🟡 [MySQL Note]: ${msg.trim()}`);
        });

        this.dbProcess.on('error', (err) => console.error('❌ Gagal menjalankan MariaDB:', err));

        return this.dbProcess;
    }
}

module.exports = LinuxMySQLManager;