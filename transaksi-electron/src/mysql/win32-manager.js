const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const BaseMySQLManager = require('./base-manager');

class Win32MySQLManager extends BaseMySQLManager {
    start() {
        const mysqlBin = path.join(this.mysqlBaseDir, 'bin', 'mysqld.exe');
        const installBin = path.join(this.mysqlBaseDir, 'bin', 'mysql_install_db.exe');

        if (!fs.existsSync(this.mysqlData)) fs.mkdirSync(this.mysqlData, { recursive: true });

        if (!fs.existsSync(path.join(this.mysqlData, 'mysql'))) {
            spawnSync(installBin, [`--datadir=${this.mysqlData}`], { cwd: this.mysqlBaseDir });
        }

        this.prepareInitSql();

        this.dbProcess = spawn(mysqlBin, [
            '--port=8889',
            `--datadir=${this.mysqlData}`,
            '--bind-address=127.0.0.1',
            `--init-file=${this.initSqlPath}`,
            '--console'
        ], { cwd: this.mysqlBaseDir });

        return this.dbProcess;
    }
}
module.exports = Win32MySQLManager;