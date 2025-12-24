const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class BaseMySQLManager {
    constructor(rootPath, userDataPath, platformFolder) {
        this.platform = process.platform;
        this.mysqlBaseDir = path.join(rootPath, 'bin', 'mysql', platformFolder);
        // this.mysqlData = path.join(userDataPath, 'mysql_data');
        this.mysqlData = path.join(os.homedir(), '.transaksi_app_db');
        this.initSqlPath = path.join(userDataPath, 'init_pass.sql');
        this.dbProcess = null;
    }

    prepareInitSql() {
        const sqlContent = [
            "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root';",
            "CREATE DATABASE IF NOT EXISTS transaksi;",
            "FLUSH PRIVILEGES;"
        ].join('\n');
        fs.writeFileSync(this.initSqlPath, sqlContent);
    }

    stop() {
        if (this.dbProcess) {
            this.dbProcess.kill();
            this.dbProcess = null;
        }
    }
}
module.exports = BaseMySQLManager;