const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// Import Pintu Utama MySQL Manager
const getMySQLManager = require('./mysql'); 

let mainWindow;
let apiProcess;
let mysql;

// 1. Deteksi Mode & Root Path
const isDev = !app.isPackaged;
const rootPath = isDev 
  ? path.resolve(__dirname, '..') 
  : process.resourcesPath;

// 2. Inisialisasi MySQL Manager (Otomatis deteksi Darwin/Win32)
// getMySQLManager akan memberikan instance yang tepat sesuai OS
mysql = getMySQLManager(rootPath, app.getPath('userData'));

/**
 * Menjalankan NestJS API menggunakan Binary Electron
 */
function startAPI() {
    console.log('------------------------------------------------');
    console.log('Starting NestJS API...');
    
    const apiPath = path.join(rootPath, 'resources', 'api', 'main.js');
    const apiDir = path.dirname(apiPath);
    
    // Konfigurasi Environment agar API konek ke MySQL port 8889
    const env = Object.assign({}, process.env, {
        DATABASE_PORT: '8889',
        DATABASE_HOST: '127.0.0.1', // Paksa IPv4
        DATABASE_USER: 'root',
        DATABASE_PASSWORD: 'root',
        PORT: '3000',
        NO_COLOR: 'true'
    });

    let options = { env, cwd: apiDir, stdio: 'pipe' };
    
    // Jika di Production, gunakan Electron sebagai Runner Node
    let command = isDev ? 'node' : process.execPath;
    if (!isDev) options.env.ELECTRON_RUN_AS_NODE = '1';

    console.log('Spawning API with command:', command);
    apiProcess = spawn(command, [apiPath], options);

    apiProcess.stdout.on('data', (data) => console.log(`[API] ${data}`));
    apiProcess.stderr.on('data', (data) => console.error(`[API Err] ${data}`));

    apiProcess.on('exit', (code) => {
        console.log(`[API] Process exited with code ${code}`);
    });
}

/**
 * Membuat Window Utama Aplikasi
 */
function createWindow() {
    console.log('------------------------------------------------');
    console.log('Creating Window...');
    
    mainWindow = new BrowserWindow({
        width: 1280, 
        height: 800,
        title: "Transaksi",
        // frame: false, 
        // titleBarStyle: 'hidden', 
        // titleBarOverlay: process.platform === 'win32' ? {
        //     color: '#2f3241',
        //     symbolColor: '#74b1be',
        //     height: 30
        // } : false,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false,
            partition: "persist:main_partition"
        }
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (details.responseHeaders['set-cookie']) {
            const cookies = details.responseHeaders['set-cookie'].map(cookie => {
                return cookie.replace(/SameSite=[^;]+/g, 'SameSite=None') + '; Secure';
            });
            details.responseHeaders['set-cookie'] = cookies;
        }
        callback({ cancel: false, responseHeaders: details.responseHeaders });
    });

    const uiPath = path.join(rootPath, 'resources', 'app', 'index.html');
    
    if (fs.existsSync(uiPath)) {
        mainWindow.loadFile(uiPath);
    } else {
        console.error('❌ UI Not Found at:', uiPath);
        mainWindow.loadURL(`data:text/html,<h1>Error: UI Not Found</h1><p>${uiPath}</p>`);
    }
}

// --- ALUR JALANNYA APLIKASI ---

app.whenReady().then(async () => {
    console.log('Application Ready. Initializing services...');
    
    // 1. Jalankan MySQL (Urusan inisialisasi dsb sudah ditangani di dalam class manager)
    try {
        await mysql.start();
    } catch (err) {
        console.error('❌ Gagal menyalakan MySQL:', err.message);
    }

    // 2. Jeda agar DB siap, lalu jalankan API
    setTimeout(() => {
        startAPI();
        setTimeout(createWindow, 2000);
    }, 4000);
});

/**
 * Pembersihan saat aplikasi ditutup
 */
app.on('will-quit', () => {
    console.log('Shutting down services...');
    
    if (apiProcess) apiProcess.kill();
    
    // Matikan MySQL lewat managernya
    if (mysql) mysql.stop(); 

    // Force kill jika ada proses yang nyangkut (opsional)
    if (process.platform === 'win32') {
        exec('taskkill /F /IM mysqld.exe');
    } else {
        exec('pkill mysqld');
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});