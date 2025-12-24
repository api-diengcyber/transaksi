const DarwinManager = require('./darwin-manager');
const Win32Manager = require('./win32-manager');

function getMySQLManager(rootPath, userDataPath) {
    const platform = process.platform;
    if (platform === 'darwin') {
        return new DarwinManager(rootPath, userDataPath, 'darwin');
    } else if (platform === 'win32') {
        return new Win32Manager(rootPath, userDataPath, 'win32');
    } else {
        // Fallback untuk Linux jika Anda nanti menambahkannya
        throw new Error('Platform not supported yet');
    }
}

module.exports = getMySQLManager;