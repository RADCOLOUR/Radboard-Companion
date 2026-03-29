const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')

function getAdbPath() {
    const base = app.isPackaged
        ? path.join(process.resourcesPath, 'adb')
        : path.join(__dirname, 'resources', 'adb')

    if (process.platform === 'win32') return path.join(base, 'win', 'adb.exe')
    if (process.platform === 'darwin') return path.join(base, 'mac', 'adb')
    return path.join(base, 'linux', 'adb')
}

function adb(command) {
    const adbPath = getAdbPath()
    return new Promise((resolve) => {
        exec(`"${adbPath}" ${command}`, (err, stdout, stderr) => {
            resolve({ err, stdout: stdout || '', stderr: stderr || '' })
        })
    })
}

function adbSerial(serial, command) {
    const adbPath = getAdbPath()
    return new Promise((resolve) => {
        exec(`"${adbPath}" -s "${serial}" ${command}`, (err, stdout, stderr) => {
            resolve({ err, stdout: stdout || '', stderr: stderr || '' })
        })
    })
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 700,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#000000',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.filePaths
})

ipcMain.handle('open-file-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return result.filePaths
})

ipcMain.handle('save-file-dialog', async (event, content) => {
    const result = await dialog.showSaveDialog({
        filters: [{ name: 'Radpack Files', extensions: ['radpack'] }],
        defaultPath: 'chords.radpack'
    })
    if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content)
        return true
    }
    return false
})

ipcMain.handle('adb-check-device', async () => {
    const { err, stdout } = await adb('devices')
    if (err) return false
    const lines = stdout.trim().split('\n').slice(1).filter(l => l.trim() && l.includes('\tdevice'))
    return lines.length > 0
})

ipcMain.handle('adb-list-projects', async () => {
    const { err, stdout } = await adb('shell ls /sdcard/Documents/Radcolour/projects')
    if (err) return []
    return stdout.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0)
})

ipcMain.handle('adb-read-file', async (event, devicePath) => {
    const { err, stdout } = await adb(`shell cat "${devicePath}"`)
    if (err) return null
    return stdout
})

ipcMain.handle('adb-write-file', async (event, devicePath, content) => {
    const tmp = path.join(app.getPath('temp'), 'radboard_tmp_' + Date.now() + '.txt')
    fs.writeFileSync(tmp, content)
    const { err } = await adb(`push "${tmp}" "${devicePath}"`)
    fs.unlinkSync(tmp)
    return !err
})

ipcMain.handle('adb-pull-file', async (event, devicePath, localPath) => {
    const { err } = await adb(`pull "${devicePath}" "${localPath}"`)
    return !err
})

ipcMain.handle('adb-push-file', async (event, localPath, devicePath) => {
    const { err } = await adb(`push "${localPath}" "${devicePath}"`)
    return !err
})

ipcMain.handle('show-save-choice-dialog', async () => {
    const result = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Save to Device', 'Save to Local Folder', 'Cancel'],
        defaultId: 0,
        title: 'Save Project',
        message: 'Where would you like to save changes?'
    })
    return result.response
})

ipcMain.handle('adb-list-devices', async () => {
    const { err, stdout } = await adb('devices -l')
    if (err) return []

    const lines = stdout.trim().split('\n').slice(1).filter(l => l.trim())
    const devices = []

    for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        const serial = parts[0]
        const status = parts[1]

        if (!serial || !status) continue

        const device = { serial, status, model: 'Unknown', androidVersion: 'Unknown' }

        if (status === 'device') {
            const modelRes = await adbSerial(serial, 'shell getprop ro.product.model')
            if (!modelRes.err && modelRes.stdout.trim()) {
                device.model = modelRes.stdout.trim()
            }

            const versionRes = await adbSerial(serial, 'shell getprop ro.build.version.release')
            if (!versionRes.err && versionRes.stdout.trim()) {
                device.androidVersion = versionRes.stdout.trim()
            }
        }

        devices.push(device)
    }

    return devices
})