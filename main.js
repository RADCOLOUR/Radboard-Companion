const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

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
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    })
    return result.filePaths
})

ipcMain.handle('open-file-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: filters
    })
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