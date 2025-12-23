#!/bin/bash

# Hentikan script jika terjadi error
set -e

# Pindah ke direktori tempat script berada
cd "$(dirname "$0")"

# ================= KONFIGURASI =================
DIR_API="./transaksi-api"
DIR_WEB="./transaksi"
DIR_ELECTRON="./transaksi-electron"

# Output tujuan di dalam folder Electron
DEST_API="$DIR_ELECTRON/resources/api"
DEST_WEB="$DIR_ELECTRON/resources/app"

echo "🚀 MEMULAI PROSES DEPLOYMENT KE .EXE"
echo "======================================="

# ---------------------------------------------
# TAHAP 1: BERSIH-BERSIH
# ---------------------------------------------
echo "🧹 [1/5] Membersihkan folder resources lama..."
rm -rf "$DEST_API"
rm -rf "$DEST_WEB"
# Hapus build lama di electron jika ada
rm -rf "$DIR_ELECTRON/dist_exe"

mkdir -p "$DEST_API"
mkdir -p "$DEST_WEB"

# ---------------------------------------------
# TAHAP 2: BUILD API (NestJS)
# ---------------------------------------------
echo "🔧 [2/5] Build API (NestJS)..."
if [ -d "$DIR_API" ]; then
    cd "$DIR_API"
    
    # Install & Build
    pnpm install --silent
    pnpm run build
    
    echo "   🚚 Copying API files..."
    cp -r dist/* "../$DEST_API/"
    cp package.json "../$DEST_API/"
    if [ -f pnpm-lock.yaml ]; then cp pnpm-lock.yaml "../$DEST_API/"; fi
    if [ -f .env ]; then cp .env "../$DEST_API/"; fi

    # Install Prod Dependencies di folder tujuan
    cd "../$DEST_API"
    echo "   📉 Installing production deps for API..."
    # Gunakan mode hoisted agar kompatibel dengan electron
    pnpm install --prod --silent --config.node-linker=hoisted
    
    cd ../../../
else
    echo "❌ Folder API tidak ditemukan!"
    exit 1
fi

# ---------------------------------------------
# TAHAP 3: BUILD WEB (Nuxt)
# ---------------------------------------------
echo "🌐 [3/5] Build Web (Nuxt)..."
if [ -d "$DIR_WEB" ]; then
    cd "$DIR_WEB"
    
    pnpm install --silent
    pnpm generate
    
    echo "   🚚 Copying Web files..."
    # Cek folder output Nuxt
    if [ -d ".output/public" ]; then
        cp -r .output/public/* "../$DEST_WEB/"
    elif [ -d "dist" ]; then
        cp -r dist/* "../$DEST_WEB/"
    else
        echo "❌ Output Nuxt tidak ditemukan!"
        exit 1
    fi
    
    cd ..
else
    echo "❌ Folder Web tidak ditemukan!"
    exit 1
fi

# ---------------------------------------------
# TAHAP 4: PERSIAPAN ELECTRON
# ---------------------------------------------
echo "💻 [4/5] Menyiapkan Electron Wrapper..."
if [ -d "$DIR_ELECTRON" ]; then
    cd "$DIR_ELECTRON"
    
    # Cek apakah folder MySQL Portable sudah ada (opsional warning)
    if [ ! -d "bin/mysql" ]; then
        echo "⚠️  PERINGATAN: Folder 'bin/mysql' belum ada di transaksi-electron."
        echo "   Database MySQL Portable tidak akan ikut ter-build."
    fi

    echo "   📦 Installing Electron dependencies..."
    # Kita pakai npm install di sini untuk wrapper electron
    # agar electron-builder tidak bingung dengan symlink pnpm
    npm install --silent
else
    echo "❌ Folder Electron tidak ditemukan!"
    exit 1
fi

# ---------------------------------------------
# TAHAP 5: PACKAGING (Bikin EXE)
# ---------------------------------------------
echo "📦 [5/5] Membungkus menjadi .EXE ..."
# Menjalankan perintah build yang ada di package.json electron
npm run build

echo ""
echo "======================================="
echo "✅ SUKSES! APLIKASI TELAH JADI."
echo "📂 Lokasi File EXE: $DIR_ELECTRON/dist_exe"
echo "======================================="