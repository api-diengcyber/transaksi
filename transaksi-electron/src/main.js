const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let dbProcess;
let apiProcess;

// Konfigurasi Path
const isDev = !app.isPackaged;
const resourcesPath = isDev ? __dirname : process.resourcesPath;

// Path ke Binary MySQL Portable (Sesuaikan dengan nama folder portable mysql anda)
const mysqlBin = path.join(resourcesPath, 'bin', 'mysql', 'bin', 'mysqld.exe');
const mysqlData = path.join(resourcesPath, 'bin', 'mysql', 'data');

// Path ke API (NestJS)
const apiPath = path.join(resourcesPath, 'resources', 'api', 'main.js');

// Path ke Frontend (Nuxt)
const uiPath = path.join(resourcesPath, 'resources', 'app', 'index.html');

function startMySQL() {
  console.log('Starting MySQL...');
  // Pastikan folder data ada, jika portable
  if (!fs.existsSync(mysqlData)) {
    fs.mkdirSync(mysqlData);
    // Di sini mungkin perlu inisialisasi mysql jika data kosong (mysql_install_db)
  }

  // Menjalankan mysqld dengan port khusus agar tidak bentrok dengan instalasi lokal
  dbProcess = spawn(mysqlBin, [
    '--port=3307', 
    `--datadir=${mysqlData}`, 
    '--console'
  ]);

  dbProcess.stdout.on('data', (data) => console.log(`MySQL: ${data}`));
  dbProcess.stderr.on('data', (data) => console.error(`MySQL Error: ${data}`));
}

function startAPI() {
  console.log('Starting NestJS API...');
  
  // Set ENV untuk API agar connect ke MySQL Portable tadi
  const env = Object.create(process.env);
  env.DATABASE_PORT = '3307';
  env.DATABASE_HOST = 'localhost';
  env.DATABASE_USER = 'root'; // Default portable biasanya root tanpa password
  env.DATABASE_PASSWORD = ''; 
  env.PORT = '3000'; // Port API

  apiProcess = spawn('node', [apiPath], { env });

  apiProcess.stdout.on('data', (data) => console.log(`API: ${data}`));
  apiProcess.stderr.on('data', (data) => console.error(`API Error: ${data}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load file Nuxt yang sudah di-generate (SPA mode)
  mainWindow.loadFile(uiPath);
  
  // Atau jika mode dev, load localhost
  // mainWindow.loadURL('http://localhost:3000'); 
}

app.whenReady().then(() => {
  startMySQL();
  
  // Beri jeda sedikit agar MySQL siap sebelum API jalan
  setTimeout(() => {
    startAPI();
    // Beri jeda agar API siap sebelum UI muncul
    setTimeout(createWindow, 3000);
  }, 3000);
});

// Cleanup proses saat aplikasi ditutup
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (apiProcess) apiProcess.kill();
  if (dbProcess) dbProcess.kill();
  // Double kill untuk memastikan mysqld mati (Windows sering bandel)
  exec('taskkill /F /IM mysqld.exe');
  exec('taskkill /F /IM node.exe'); 
});