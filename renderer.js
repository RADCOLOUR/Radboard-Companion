const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

let currentFolderPath = null
let packChords = []
let selectedChordIndex = -1
let searchQuery = ''

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
        tab.classList.add('active')
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')
    })
})

loadProjectsPanel()
loadChordPackPanel()

function loadProjectsPanel() {
    const panel = document.getElementById('tab-projects')
    panel.innerHTML = `
        <div style="display:flex;flex-direction:column;width:260px;border-right:1px solid var(--outline);flex-shrink:0;">
            <div style="padding:12px;border-bottom:1px solid var(--outline);display:flex;gap:8px;align-items:center;">
                <span style="font-size:11px;font-weight:700;color:var(--positive);flex:1;">Projects</span>
                <button class="btn btn-ghost" id="btnOpenFolder" style="padding:6px 10px;">Open Folder</button>
            </div>
            <div style="padding:8px;border-bottom:1px solid var(--outline);display:flex;gap:8px;">
                <button class="btn btn-positive" id="btnNewProject" style="flex:1;">+ New Project</button>
            </div>
            <div style="padding:8px;border-bottom:1px solid var(--outline);">
                <input id="projectSearch" type="text" placeholder="Search projects..." style="width:100%;"/>
            </div>
            <div id="projectList" style="flex:1;overflow-y:auto;padding:8px;"></div>
        </div>
        <div id="projectDetail" style="flex:1;overflow-y:auto;padding:16px;"></div>
    `

    document.getElementById('btnOpenFolder').addEventListener('click', openProjectFolder)
    document.getElementById('btnNewProject').addEventListener('click', createNewProject)
    document.getElementById('projectSearch').addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase()
        renderProjectList()
    })
    showProjectEmptyState()
}

function openProjectFolder() {
    ipcRenderer.invoke('open-folder-dialog').then(result => {
        if (result && result.length > 0) {
            currentFolderPath = result[0]
            scanProjectFolder(currentFolderPath)
        }
    })
}

function createNewProject() {
    if (!currentFolderPath) {
        showPickFolderFirst()
        return
    }

    const overlay = document.createElement('div')
    overlay.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;
    `

    overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;border:1px solid var(--outline);padding:24px;width:400px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--positive);margin-bottom:16px;">New Project</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Project Name</label>
                    <input id="newProjectName" type="text" placeholder="e.g. Summer Track" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Key</label>
                    <input id="newProjectKey" type="text" placeholder="e.g. C, F#, Bb" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Scale</label>
                    <input id="newProjectScale" type="text" placeholder="e.g. Major, Minor" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">BPM</label>
                    <input id="newProjectBpm" type="text" placeholder="e.g. 120" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Description</label>
                    <textarea id="newProjectDesc" rows="2" placeholder="Short description" style="width:100%;margin-top:4px;resize:vertical;"></textarea>
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
                <button class="btn btn-ghost" id="btnCancelNew">Cancel</button>
                <button class="btn btn-positive" id="btnConfirmNew">Create</button>
            </div>
        </div>
    `

    document.body.appendChild(overlay)
    document.getElementById('newProjectName').focus()

    document.getElementById('btnCancelNew').addEventListener('click', () => overlay.remove())

    document.getElementById('btnConfirmNew').addEventListener('click', () => {
        const name = document.getElementById('newProjectName').value.trim()

        if (!name) {
            document.getElementById('newProjectName').style.borderColor = 'var(--error)'
            return
        }

        const projPath = path.join(currentFolderPath, name)

        if (fs.existsSync(projPath)) {
            document.getElementById('newProjectName').style.borderColor = 'var(--error)'
            document.getElementById('newProjectName').placeholder = 'A project with this name already exists'
            return
        }

        const today = new Date().toISOString().split('T')[0]

        const info = [
            `name=${name}`,
            `created=${today}`,
            `bpm=${document.getElementById('newProjectBpm').value.trim()}`,
            `key=${document.getElementById('newProjectKey').value.trim()}`,
            `scale=${document.getElementById('newProjectScale').value.trim()}`,
            `description=${document.getElementById('newProjectDesc').value.trim()}`,
            `time_spent=0`
        ].join('\n')

        fs.mkdirSync(projPath, { recursive: true })
        fs.writeFileSync(path.join(projPath, 'info.txt'), info)
        fs.writeFileSync(path.join(projPath, 'notes.txt'), '')
        fs.writeFileSync(path.join(projPath, 'progression.txt'), '[]')

        overlay.remove()
        scanProjectFolder(currentFolderPath)
        loadProjectDetail(projPath, name)
    })
}

function showPickFolderFirst() {
    const detail = document.getElementById('projectDetail')
    detail.innerHTML = `
        <div class="empty-state" style="height:100%;">
            <div class="empty-state-title">No folder open</div>
            <div class="empty-state-subtitle">Click "Open Folder" first to choose where your projects are saved, then click "+ New Project" to create one.</div>
        </div>
    `
}

let allProjects = []

function scanProjectFolder(folderPath) {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true })
        allProjects = entries.filter(e => e.isDirectory()).map(e => e.name)
        renderProjectList()

        if (allProjects.length > 0) {
            const first = allProjects[0]
            loadProjectDetail(path.join(folderPath, first), first)
        }
    } catch (e) {
        document.getElementById('projectList').innerHTML = `<div class="empty-state"><span class="empty-state-subtitle">Could not read folder</span></div>`
    }
}

function renderProjectList() {
    const list = document.getElementById('projectList')
    if (!list) return
    list.innerHTML = ''

    const filtered = allProjects.filter(p => p.toLowerCase().includes(searchQuery))

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="empty-state-subtitle">${searchQuery ? 'No projects match your search' : 'No projects found in this folder'}</span></div>`
        return
    }

    filtered.forEach(projName => {
        const projPath = path.join(currentFolderPath, projName)
        const btn = document.createElement('div')
        btn.style.cssText = `
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--on-background);
            transition: background 0.15s;
        `
        btn.textContent = projName
        btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface-variant)')
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent')
        btn.addEventListener('click', () => loadProjectDetail(projPath, projName))
        list.appendChild(btn)
    })
}

function loadProjectDetail(projPath, projName) {
    const detail = document.getElementById('projectDetail')

    const infoPath = path.join(projPath, 'info.txt')
    const notesPath = path.join(projPath, 'notes.txt')
    const progressionPath = path.join(projPath, 'progression.txt')

    const info = {}
    if (fs.existsSync(infoPath)) {
        fs.readFileSync(infoPath, 'utf8').split('\n').forEach(line => {
            const idx = line.indexOf('=')
            if (idx >= 0) {
                info[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
            }
        })
    }

    const notes = fs.existsSync(notesPath)
        ? fs.readFileSync(notesPath, 'utf8')
        : ''

    let progressionText = ''
    if (fs.existsSync(progressionPath)) {
        try {
            const raw = fs.readFileSync(progressionPath, 'utf8')
            const sections = JSON.parse(raw)
            progressionText = sections.map(s =>
                `${s.name}: ${s.chords.length > 0 ? s.chords.join(' → ') : 'No chords'}`
            ).join('\n')
        } catch (e) {
            progressionText = 'Could not read progression'
        }
    }

    const timeSpent = info.time_spent ? formatTime(parseInt(info.time_spent)) : '00:00:00'

    detail.innerHTML = `
        <div style="max-width:800px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <h2 style="font-size:20px;font-weight:700;color:var(--positive);flex:1;">${projName}</h2>
                <button class="btn btn-danger" id="btnDeleteProject">Delete</button>
                <button class="btn btn-positive" id="btnEditInfo">Edit Info</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div class="card">
                    <div class="card-header green">Details</div>
                    <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:var(--on-surface-variant);font-size:11px;">Created</span>
                            <span style="font-size:11px;">${info.created || 'Unknown'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:var(--on-surface-variant);font-size:11px;">Key</span>
                            <span style="font-size:11px;color:var(--tertiary);">${info.key || 'Not set'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:var(--on-surface-variant);font-size:11px;">Scale</span>
                            <span style="font-size:11px;color:var(--tertiary);">${info.scale || 'Not set'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:var(--on-surface-variant);font-size:11px;">BPM</span>
                            <span style="font-size:11px;color:var(--secondary);">${info.bpm || 'Not set'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:var(--on-surface-variant);font-size:11px;">Time Spent</span>
                            <span style="font-size:11px;color:var(--positive);">${timeSpent}</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header pink">Description</div>
                    <div class="card-body">
                        <p style="font-size:11px;line-height:1.6;color:${info.description ? 'var(--on-background)' : 'var(--on-surface-variant)'};">
                            ${info.description || 'No description'}
                        </p>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-bottom:12px;">
                <div class="card-header pink">Chord Progression</div>
                <div class="card-body">
                    ${progressionText
                        ? `<pre style="font-size:11px;line-height:1.8;color:var(--on-background);white-space:pre-wrap;">${progressionText}</pre>`
                        : `<span style="font-size:11px;color:var(--on-surface-variant);">No progression data</span>`
                    }
                </div>
            </div>

            <div class="card">
                <div class="card-header blue" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>Notes</span>
                    <button class="btn btn-ghost" id="btnSaveNotes" style="padding:4px 10px;font-size:10px;display:none;">Save</button>
                </div>
                <div class="card-body" style="padding:0;">
                    <textarea id="notesEditor" style="
                        width:100%;
                        min-height:160px;
                        background:transparent;
                        border:none;
                        color:var(--on-background);
                        font-size:12px;
                        line-height:1.6;
                        padding:16px;
                        resize:vertical;
                        font-family:inherit;
                        outline:none;
                    ">${notes}</textarea>
                </div>
            </div>
        </div>
    `

    const notesEditor = document.getElementById('notesEditor')
    const btnSaveNotes = document.getElementById('btnSaveNotes')

    notesEditor.addEventListener('input', () => {
        btnSaveNotes.style.display = 'block'
    })

    btnSaveNotes.addEventListener('click', () => {
        fs.writeFileSync(notesPath, notesEditor.value)
        btnSaveNotes.style.display = 'none'
    })

    document.getElementById('btnEditInfo').addEventListener('click', () => {
        showEditInfoDialog(projPath, projName, info, () => loadProjectDetail(projPath, projName))
    })

    document.getElementById('btnDeleteProject').addEventListener('click', () => {
        showDeleteProjectDialog(projPath, projName)
    })
}

function showDeleteProjectDialog(projPath, projName) {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;
    `

    overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;border:1px solid var(--outline);padding:24px;width:380px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--error);margin-bottom:12px;">Delete Project</h3>
            <p style="font-size:12px;color:var(--on-surface-variant);line-height:1.6;margin-bottom:20px;">
                Delete <strong style="color:var(--on-background);">${projName}</strong>? This cannot be undone. All notes, progressions and project info will be permanently deleted.
            </p>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button class="btn btn-ghost" id="btnCancelDelete">Cancel</button>
                <button class="btn btn-danger" id="btnConfirmDelete">Delete</button>
            </div>
        </div>
    `

    document.body.appendChild(overlay)

    document.getElementById('btnCancelDelete').addEventListener('click', () => overlay.remove())

    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        fs.rmSync(projPath, { recursive: true, force: true })
        allProjects = allProjects.filter(p => p !== projName)
        overlay.remove()
        renderProjectList()
        showProjectEmptyState()
    })
}

function showEditInfoDialog(projPath, projName, info, onSave) {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;
        z-index:1000;
    `

    overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;border:1px solid var(--outline);padding:24px;width:400px;">
            <h3 style="font-size:14px;font-weight:700;color:var(--positive);margin-bottom:16px;">Edit Project Info</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Key</label>
                    <input id="editKey" type="text" value="${info.key || ''}" placeholder="e.g. C, F#, Bb" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Scale</label>
                    <input id="editScale" type="text" value="${info.scale || ''}" placeholder="e.g. Major, Minor" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">BPM</label>
                    <input id="editBpm" type="text" value="${info.bpm || ''}" placeholder="e.g. 120" style="width:100%;margin-top:4px;"/>
                </div>
                <div>
                    <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Description</label>
                    <textarea id="editDesc" rows="3" placeholder="Short description of the project" style="width:100%;margin-top:4px;resize:vertical;">${info.description || ''}</textarea>
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
                <button class="btn btn-ghost" id="btnCancelEdit">Cancel</button>
                <button class="btn btn-positive" id="btnSaveEdit">Save</button>
            </div>
        </div>
    `

    document.body.appendChild(overlay)

    document.getElementById('btnCancelEdit').addEventListener('click', () => overlay.remove())

    document.getElementById('btnSaveEdit').addEventListener('click', () => {
        const updated = {
            ...info,
            key: document.getElementById('editKey').value.trim(),
            scale: document.getElementById('editScale').value.trim(),
            bpm: document.getElementById('editBpm').value.trim(),
            description: document.getElementById('editDesc').value.trim()
        }

        const lines = [
            `name=${updated.name || projName}`,
            `created=${updated.created || ''}`,
            `bpm=${updated.bpm}`,
            `key=${updated.key}`,
            `scale=${updated.scale}`,
            `description=${updated.description}`,
            `time_spent=${updated.time_spent || '0'}`
        ].join('\n')

        fs.writeFileSync(path.join(projPath, 'info.txt'), lines)
        overlay.remove()
        onSave()
    })
}

function showProjectEmptyState() {
    const detail = document.getElementById('projectDetail')
    if (!detail) return
    detail.innerHTML = `
        <div class="empty-state" style="height:100%;">
            <div class="empty-state-title">No project selected</div>
            <div class="empty-state-subtitle">Open a Radboard projects folder to get started</div>
        </div>
    `
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function parseTabNotation(tabString) {
    if (!tabString || tabString.trim() === '') return null

    const parts = tabString.trim().split(/\s+/)
    const tab = parts[0]
    let startFret = 1
    let barreFret = -1
    let barreFrom = -1
    let barreTo = -1

    parts.forEach(part => {
        if (part.startsWith('@')) {
            startFret = parseInt(part.substring(1)) || 1
        } else if (part.includes('@')) {
            const atIdx = part.indexOf('@')
            startFret = parseInt(part.substring(atIdx + 1)) || 1
        }
        if (part.startsWith('barre:')) {
            const range = part.substring(6).split('-')
            barreFrom = parseInt(range[0])
            barreTo = parseInt(range[1])
            barreFret = startFret
        }
    })

    const tabStr = tab.includes('@') ? tab.substring(0, tab.indexOf('@')) : tab

    return {
        strings: tabStr.split('').map(c => {
            if (c === 'x') return -1
            if (c === '0') return 0
            return parseInt(c) || 0
        }),
        startFret,
        barreFret,
        barreFrom,
        barreTo
    }
}

function drawFretboard(canvas, tabString) {
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#1A1A1A'
    ctx.fillRect(0, 0, W, H)

    const parsed = parseTabNotation(tabString)
    const numStrings = 6
    const numFrets = 5

    const paddingTop = 32
    const paddingBottom = 20
    const paddingLeft = 28
    const paddingRight = 20

    const fretboardW = W - paddingLeft - paddingRight
    const fretboardH = H - paddingTop - paddingBottom

    const stringSpacing = fretboardW / (numStrings - 1)
    const fretSpacing = fretboardH / numFrets

    const startFret = parsed ? parsed.startFret : 1

    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 1

    for (let f = 0; f <= numFrets; f++) {
        const y = paddingTop + f * fretSpacing
        ctx.beginPath()
        ctx.moveTo(paddingLeft, y)
        ctx.lineTo(W - paddingRight, y)
        ctx.stroke()
    }

    for (let s = 0; s < numStrings; s++) {
        const x = paddingLeft + s * stringSpacing
        ctx.beginPath()
        ctx.moveTo(x, paddingTop)
        ctx.lineTo(x, paddingTop + fretboardH)
        ctx.stroke()
    }

    ctx.fillStyle = '#7DD6FF'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(paddingLeft, paddingTop)
    ctx.lineTo(W - paddingRight, paddingTop)
    ctx.stroke()

    if (startFret > 1) {
        ctx.fillStyle = '#8A8A8A'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(`${startFret}fr`, 2, paddingTop + fretSpacing * 0.6)
    }

    if (!parsed) return

    if (parsed.barreFret >= 0 && parsed.barreFrom >= 0 && parsed.barreTo >= 0) {
        const barreY = paddingTop + fretSpacing * 0.5
        const barreX1 = paddingLeft + parsed.barreFrom * stringSpacing
        const barreX2 = paddingLeft + parsed.barreTo * stringSpacing
        const barreRadius = fretSpacing * 0.28

        ctx.fillStyle = '#7DD6FF'
        ctx.beginPath()
        ctx.roundRect(barreX1 - barreRadius, barreY - barreRadius, barreX2 - barreX1 + barreRadius * 2, barreRadius * 2, barreRadius)
        ctx.fill()
    }

    const dotRadius = fretSpacing * 0.28

    parsed.strings.forEach((fret, i) => {
        const x = paddingLeft + i * stringSpacing

        if (fret === -1) {
            ctx.strokeStyle = '#FF5449'
            ctx.lineWidth = 1.5
            const r = 5
            const y = paddingTop - 14
            ctx.beginPath()
            ctx.moveTo(x - r, y - r)
            ctx.lineTo(x + r, y + r)
            ctx.moveTo(x + r, y - r)
            ctx.lineTo(x - r, y + r)
            ctx.stroke()
            return
        }

        if (fret === 0) {
            ctx.strokeStyle = '#7DD6FF'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(x, paddingTop - 14, 5, 0, Math.PI * 2)
            ctx.stroke()
            return
        }

        const y = paddingTop + (fret - 0.5) * fretSpacing

        const isOnBarre = parsed.barreFrom >= 0 && i >= parsed.barreFrom && i <= parsed.barreTo && fret === 1
        if (isOnBarre) return

        ctx.fillStyle = '#FFB3D9'
        ctx.beginPath()
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#000000'
        ctx.font = `bold ${Math.floor(dotRadius * 0.9)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(fret.toString(), x, y)
    })
}

function loadChordPackPanel() {
    const panel = document.getElementById('tab-chordpack')
    panel.innerHTML = `
        <div style="display:flex;flex-direction:column;width:280px;border-right:1px solid var(--outline);flex-shrink:0;">
            <div style="padding:12px;border-bottom:1px solid var(--outline);">
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <button class="btn btn-tertiary" id="btnNewPack" style="flex:1;">New Pack</button>
                    <button class="btn btn-ghost" id="btnOpenPack" style="flex:1;">Open .radpack</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <input id="packAuthor" type="text" placeholder="Author" style="width:100%;"/>
                    <input id="packDescription" type="text" placeholder="Pack description" style="width:100%;"/>
                </div>
            </div>
            <div style="padding:8px;border-bottom:1px solid var(--outline);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Chords</span>
                <button class="btn btn-ghost" id="btnAddChord" style="padding:4px 10px;font-size:10px;">+ Add</button>
            </div>
            <div id="chordList" style="flex:1;overflow-y:auto;padding:8px;"></div>
            <div style="padding:12px;border-top:1px solid var(--outline);">
                <button class="btn btn-positive" id="btnExportPack" style="width:100%;">Export .radpack</button>
            </div>
        </div>
        <div id="chordEditor" style="flex:1;overflow-y:auto;padding:16px;"></div>
    `

    document.getElementById('btnNewPack').addEventListener('click', newPack)
    document.getElementById('btnOpenPack').addEventListener('click', openPack)
    document.getElementById('btnAddChord').addEventListener('click', addChord)
    document.getElementById('btnExportPack').addEventListener('click', exportPack)

    showChordEditorEmptyState()
}

function newPack() {
    packChords = []
    selectedChordIndex = -1
    document.getElementById('packAuthor').value = ''
    document.getElementById('packDescription').value = ''
    renderChordList()
    showChordEditorEmptyState()
}

function openPack() {
    ipcRenderer.invoke('open-file-dialog', [{ name: 'Radpack Files', extensions: ['radpack'] }]).then(result => {
        if (result && result.length > 0) {
            parseRadpack(fs.readFileSync(result[0], 'utf8'))
        }
    })
}

function parseRadpack(content) {
    packChords = []
    const lines = content.split('\n')
    let currentChord = null
    let author = ''
    let description = ''

    lines.forEach(line => {
        line = line.trim()
        if (line.startsWith('author:')) {
            author = line.substring(7).trim()
        } else if (line.startsWith('description:') && !currentChord) {
            description = line.substring(12).trim()
        } else if (line.startsWith('[')) {
            if (currentChord) packChords.push(currentChord)
            const closeIdx = line.indexOf(']')
            const name = line.substring(1, closeIdx)
            const rest = line.substring(closeIdx + 1).trim()
            const pipeIdx = rest.indexOf('|')
            const desc = pipeIdx >= 0 ? rest.substring(0, pipeIdx).trim() : rest.trim()
            const meta = pipeIdx >= 0 ? rest.substring(pipeIdx + 1).trim() : ''
            const rootMatch = meta.match(/root:(\S+)/)
            const typeMatch = meta.match(/type:(\S+)/)
            currentChord = {
                name,
                description: desc,
                root: rootMatch ? rootMatch[1] : '',
                type: typeMatch ? typeMatch[1] : '',
                guitarPositions: [],
                bassPositions: []
            }
        } else if (line.startsWith('guitar:') && currentChord) {
            currentChord.guitarPositions.push(line.substring(7).trim())
        } else if (line.startsWith('bass:') && currentChord) {
            currentChord.bassPositions.push(line.substring(5).trim())
        }
    })

    if (currentChord) packChords.push(currentChord)

    document.getElementById('packAuthor').value = author
    document.getElementById('packDescription').value = description

    renderChordList()
    if (packChords.length > 0) {
        selectedChordIndex = 0
        renderChordEditor(0)
    }
}

function addChord() {
    packChords.push({
        name: 'New Chord',
        description: '',
        root: '',
        type: '',
        guitarPositions: [''],
        bassPositions: ['']
    })
    selectedChordIndex = packChords.length - 1
    renderChordList()
    renderChordEditor(selectedChordIndex)
}

function renderChordList() {
    const list = document.getElementById('chordList')
    list.innerHTML = ''

    if (packChords.length === 0) {
        list.innerHTML = `<div class="empty-state"><span class="empty-state-subtitle">No chords yet</span></div>`
        return
    }

    packChords.forEach((chord, index) => {
        const item = document.createElement('div')
        item.style.cssText = `
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: ${index === selectedChordIndex ? 'var(--surface-variant)' : 'transparent'};
            transition: background 0.15s;
        `

        const name = document.createElement('span')
        name.style.cssText = `font-size:12px;color:${index === selectedChordIndex ? 'var(--tertiary)' : 'var(--on-background)'};`
        name.textContent = chord.name

        const btnDelete = document.createElement('button')
        btnDelete.style.cssText = `background:transparent;border:none;color:var(--error);cursor:pointer;font-size:12px;padding:0 4px;`
        btnDelete.textContent = '✕'
        btnDelete.addEventListener('click', e => {
            e.stopPropagation()
            packChords.splice(index, 1)
            if (selectedChordIndex >= packChords.length) selectedChordIndex = packChords.length - 1
            renderChordList()
            if (selectedChordIndex >= 0) renderChordEditor(selectedChordIndex)
            else showChordEditorEmptyState()
        })

        item.appendChild(name)
        item.appendChild(btnDelete)
        item.addEventListener('mouseenter', () => {
            if (index !== selectedChordIndex) item.style.background = 'var(--surface-variant)'
        })
        item.addEventListener('mouseleave', () => {
            if (index !== selectedChordIndex) item.style.background = 'transparent'
        })
        item.addEventListener('click', () => {
            selectedChordIndex = index
            renderChordList()
            renderChordEditor(index)
        })

        list.appendChild(item)
    })
}

function renderChordEditor(index) {
    const chord = packChords[index]
    const editor = document.getElementById('chordEditor')

    editor.innerHTML = `
        <div style="display:flex;gap:16px;max-width:900px;">

            <div style="flex:1;min-width:0;">
                <h3 style="font-size:14px;font-weight:700;color:var(--tertiary);margin-bottom:16px;">Edit Chord</h3>

                <div class="card" style="margin-bottom:12px;">
                    <div class="card-header blue">Info</div>
                    <div class="card-body" style="display:flex;flex-direction:column;gap:10px;">
                        <div>
                            <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Name</label>
                            <input id="chordName" type="text" value="${chord.name}" style="width:100%;margin-top:4px;"/>
                        </div>
                        <div>
                            <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Description</label>
                            <input id="chordDesc" type="text" value="${chord.description}" style="width:100%;margin-top:4px;"/>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            <div>
                                <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Root</label>
                                <input id="chordRoot" type="text" value="${chord.root}" placeholder="e.g. C, F#" style="width:100%;margin-top:4px;"/>
                            </div>
                            <div>
                                <label style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.1em;">Type</label>
                                <input id="chordType" type="text" value="${chord.type}" placeholder="e.g. Major, Minor" style="width:100%;margin-top:4px;"/>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card" style="margin-bottom:12px;">
                    <div class="card-header blue">Guitar Positions</div>
                    <div class="card-body" style="display:flex;flex-direction:column;gap:8px;" id="guitarPositions">
                        ${chord.guitarPositions.map((pos, i) => `
                            <div style="display:flex;gap:8px;align-items:center;">
                                <input class="guitar-pos" type="text" value="${pos}" placeholder="e.g. x32010 or 133211@1 barre:0-5" style="flex:1;font-family:monospace;" data-pos-index="${i}"/>
                                <button class="btn btn-ghost" onclick="removePosition('guitar', ${i})" style="padding:6px 10px;">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <div style="padding:8px 16px;">
                        <button class="btn btn-ghost" onclick="addPosition('guitar')" style="font-size:11px;">+ Add Position</button>
                    </div>
                </div>

                <div class="card" style="margin-bottom:16px;">
                    <div class="card-header blue">Bass Positions</div>
                    <div class="card-body" style="display:flex;flex-direction:column;gap:8px;" id="bassPositions">
                        ${chord.bassPositions.map((pos, i) => `
                            <div style="display:flex;gap:8px;align-items:center;">
                                <input class="bass-pos" type="text" value="${pos}" placeholder="e.g. x321 or 1332@1 barre:0-3" style="flex:1;font-family:monospace;"/>
                                <button class="btn btn-ghost" onclick="removePosition('bass', ${i})" style="padding:6px 10px;">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <div style="padding:8px 16px;">
                        <button class="btn btn-ghost" onclick="addPosition('bass')" style="font-size:11px;">+ Add Position</button>
                    </div>
                </div>

                <button class="btn btn-tertiary" id="btnSaveChord" style="width:100%;">Save Chord</button>
            </div>

            <div style="width:220px;flex-shrink:0;">
                <h3 style="font-size:14px;font-weight:700;color:var(--tertiary);margin-bottom:16px;">Preview</h3>
                <div class="card" style="margin-bottom:8px;">
                    <div class="card-header blue">Guitar</div>
                    <div class="card-body" style="padding:8px;">
                        <canvas id="fretboardCanvas" width="200" height="220" style="width:100%;display:block;border-radius:8px;"></canvas>
                    </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;" id="previewPositionBtns"></div>
            </div>

        </div>
    `

    document.getElementById('btnSaveChord').addEventListener('click', () => saveChord(index))

    const canvas = document.getElementById('fretboardCanvas')

    const guitarInputs = document.querySelectorAll('.guitar-pos')

    let activePreviewIndex = 0

    function updatePreviewButtons() {
        const btns = document.getElementById('previewPositionBtns')
        if (!btns) return
        btns.innerHTML = ''
        const positions = Array.from(document.querySelectorAll('.guitar-pos')).map(i => i.value.trim())
        positions.forEach((pos, i) => {
            if (!pos) return
            const btn = document.createElement('button')
            btn.className = 'btn'
            btn.style.cssText = `padding:4px 10px;font-size:10px;background:${i === activePreviewIndex ? 'var(--tertiary)' : 'var(--surface-variant)'};color:${i === activePreviewIndex ? '#000' : 'var(--on-background)'};`
            btn.textContent = i === 0 ? 'Open' : `Pos ${i + 1}`
            btn.addEventListener('click', () => {
                activePreviewIndex = i
                updatePreviewButtons()
                const allInputs = Array.from(document.querySelectorAll('.guitar-pos'))
                if (allInputs[i]) drawFretboard(canvas, allInputs[i].value)
            })
            btns.appendChild(btn)
        })
    }

    guitarInputs.forEach((input, i) => {
        input.addEventListener('input', () => {
            activePreviewIndex = i
            updatePreviewButtons()
            drawFretboard(canvas, input.value)
        })
        input.addEventListener('focus', () => {
            activePreviewIndex = i
            updatePreviewButtons()
            drawFretboard(canvas, input.value)
        })
    })

    if (chord.guitarPositions.length > 0 && chord.guitarPositions[0]) {
        drawFretboard(canvas, chord.guitarPositions[0])
    } else {
        drawFretboard(canvas, '')
    }

    updatePreviewButtons()
}

function saveChord(index) {
    packChords[index] = {
        name: document.getElementById('chordName').value.trim(),
        description: document.getElementById('chordDesc').value.trim(),
        root: document.getElementById('chordRoot').value.trim(),
        type: document.getElementById('chordType').value.trim(),
        guitarPositions: Array.from(document.querySelectorAll('.guitar-pos')).map(i => i.value.trim()),
        bassPositions: Array.from(document.querySelectorAll('.bass-pos')).map(i => i.value.trim())
    }
    renderChordList()
    renderChordEditor(index)
}

function addPosition(type) {
    saveChord(selectedChordIndex)
    packChords[selectedChordIndex][type === 'guitar' ? 'guitarPositions' : 'bassPositions'].push('')
    renderChordEditor(selectedChordIndex)
}

function removePosition(type, posIndex) {
    saveChord(selectedChordIndex)
    const key = type === 'guitar' ? 'guitarPositions' : 'bassPositions'
    packChords[selectedChordIndex][key].splice(posIndex, 1)
    renderChordEditor(selectedChordIndex)
}

function exportPack() {
    if (packChords.length === 0) {
        alert('Add at least one chord before exporting.')
        return
    }

    const author = document.getElementById('packAuthor').value.trim()
    const description = document.getElementById('packDescription').value.trim()

    const roots = [...new Set(packChords.map(c => c.root).filter(r => r))].join(', ')
    const types = [...new Set(packChords.map(c => c.type).filter(t => t))].join(', ')

    let output = ''
    if (author) output += `author: ${author}\n`
    if (description) output += `description: ${description}\n`
    output += '\n'
    if (roots) output += `roots: ${roots}\n`
    if (types) output += `types: ${types}\n`
    output += '\n'

    packChords.forEach(chord => {
        const meta = chord.root || chord.type
            ? ` | root:${chord.root} type:${chord.type}`
            : ''
        output += `[${chord.name}] ${chord.description}${meta}\n`
        chord.guitarPositions.forEach(pos => {
            if (pos) output += `guitar: ${pos}\n`
        })
        chord.bassPositions.forEach(pos => {
            if (pos) output += `bass: ${pos}\n`
        })
        output += '\n'
    })

    ipcRenderer.invoke('save-file-dialog', output).then(saved => {
        if (saved) alert('Pack exported successfully.')
    })
}

function showChordEditorEmptyState() {
    const editor = document.getElementById('chordEditor')
    editor.innerHTML = `
        <div class="empty-state" style="height:100%;">
            <div class="empty-state-title">No chord selected</div>
            <div class="empty-state-subtitle">Add a chord or open an existing .radpack file to get started</div>
        </div>
    `
}