let editor = null;
let activeTab = null; // Currently selected file path (null means welcome screen)
let openTabs = [];    // List of active file paths
let fileCache = {};   // { path: current_content }
let originalCache = {}; // { path: last_saved_content } (for dirty/unsaved tracking)

// UI elements
const monacoContainer = document.getElementById('monaco-container');
const welcomeScreen = document.getElementById('welcome-screen');
const tabsBar = document.getElementById('tabs-bar');
const fileExplorer = document.getElementById('file-explorer');
const consoleOutput = document.getElementById('console-output');
const executionStats = document.getElementById('execution-stats');
const activeFileIndicator = document.getElementById('active-file-indicator');
const langStatus = document.getElementById('lang-status');

// Modal Elements
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalError = document.getElementById('modal-error');
const modalBtnConfirm = document.getElementById('modal-btn-confirm');
const modalBtnCancel = document.getElementById('modal-btn-cancel');

// Active modal context
let modalCallback = null;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    // Hide native container scrollbar and register custom theme if needed
    editor = monaco.editor.create(monacoContainer, {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'Fira Code', 'Courier New', monospace",
        tabSize: 4,
        minimap: { enabled: true },
        wordWrap: 'on',
        padding: { top: 12, bottom: 12 }
    });

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
        if (!activeTab) return;
        const currentVal = editor.getValue();
        fileCache[activeTab] = currentVal;
        updateTabDirtyState(activeTab);
    });

    // Initially hide editor container because Welcome screen is active
    monacoContainer.style.display = 'none';

    // Fetch workspace files initially
    refreshWorkspace();
});

// Fetch File Explorer tree from backend
async function refreshWorkspace() {
    try {
        const response = await fetch('/api/files');
        const data = await response.json();
        if (data.success) {
            renderFileTree(data.files);
        } else {
            showConsoleLine(`[Error loading workspace] ${data.error}`, 'error-line');
        }
    } catch (err) {
        showConsoleLine(`[Error loading workspace] ${err.message}`, 'error-line');
    }
}

// Recursively render files and folders
function renderFileTree(files, container = fileExplorer, depth = 0) {
    if (depth === 0) {
        container.innerHTML = '';
    }

    if (files.length === 0 && depth === 0) {
        container.innerHTML = '<div class="loading-spinner">Workspace is empty.</div>';
        return;
    }

    files.forEach(item => {
        const treeItem = document.createElement('div');
        treeItem.className = `tree-item tree-depth-${depth}`;
        if (activeTab === item.path) {
            treeItem.classList.add('active');
        }

        const isDir = item.type === 'directory';
        let iconClass = 'fa-regular fa-file generic-file-color';
        if (isDir) {
            iconClass = 'fa-solid fa-folder';
        } else if (item.name.endsWith('.js')) {
            iconClass = 'fa-brands fa-js-square js-color';
        } else if (item.name.endsWith('.cs')) {
            iconClass = 'fa-solid fa-hashtag cs-color';
        }

        // HTML for Tree Item
        treeItem.innerHTML = `
            <div class="tree-item-content" onclick="handleTreeItemClick('${item.path}', ${isDir})">
                <i class="tree-icon ${iconClass}"></i>
                <span class="tree-item-label" title="${item.name}">${item.name}</span>
            </div>
            <div class="tree-item-actions">
                <button class="tree-action-btn" onclick="event.stopPropagation(); triggerRename('${item.path}')" title="Rename"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="tree-action-btn" onclick="event.stopPropagation(); triggerDelete('${item.path}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        container.appendChild(treeItem);

        // If directory and has children, recursively render them
        if (isDir && item.children && item.children.length > 0) {
            renderFileTree(item.children, container, depth + 1);
        }
    });
}

// Tree click handler
async function handleTreeItemClick(filePath, isDirectory) {
    if (isDirectory) return; // For now directories don't collapse/expand visually, they list flat hierarchical
    await openFile(filePath);
}

// Open / Select File
async function openFile(filePath) {
    try {
        if (!fileCache[filePath]) {
            // Load from backend
            const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
            const data = await response.json();
            if (data.success) {
                fileCache[filePath] = data.content;
                originalCache[filePath] = data.content;
            } else {
                alert(`Error opening file: ${data.error}`);
                return;
            }
        }

        // Add to open tabs if not already present
        if (!openTabs.includes(filePath)) {
            openTabs.push(filePath);
        }

        activeTab = filePath;

        // Show Monaco Editor and hide welcome screen
        welcomeScreen.style.display = 'none';
        monacoContainer.style.display = 'block';

        // Set editor content
        const extension = filePath.split('.').pop().toLowerCase();
        let language = 'plaintext';
        if (extension === 'js') language = 'javascript';
        else if (extension === 'cs') language = 'csharp';

        const model = monaco.editor.createModel(fileCache[filePath], language);
        editor.setModel(model);

        // Update active indicators
        activeFileIndicator.textContent = filePath;
        langStatus.textContent = language.toUpperCase();

        renderTabs();
        updateActiveTreeItemSelection();
    } catch (err) {
        alert(`Failed to load file: ${err.message}`);
    }
}

// Update Active CSS class in the sidebar explorer tree
function updateActiveTreeItemSelection() {
    const items = document.querySelectorAll('.tree-item');
    items.forEach(item => {
        const label = item.querySelector('.tree-item-label');
        const contentDiv = item.querySelector('.tree-item-content');
        if (label && contentDiv) {
            // We can match based on the label/click logic
            // To make it simple, we re-render tree items which matches correctly
        }
    });
    // For simplicity, we just trigger refreshWorkspace/re-render when files tree changes or tab switches
}

// Render tabs bar
function renderTabs() {
    tabsBar.innerHTML = '';

    if (openTabs.length === 0) {
        showWelcomeScreen();
        return;
    }

    openTabs.forEach(tabPath => {
        const isDirty = fileCache[tabPath] !== originalCache[tabPath];
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tabPath === activeTab ? 'active' : ''} ${isDirty ? 'unsaved' : ''}`;

        const fileName = tabPath.split('/').pop();

        tabEl.innerHTML = `
            <span onclick="openFile('${tabPath}')" title="${tabPath}">${fileName}</span>
            <span class="tab-unsaved"></span>
            <span class="tab-close" onclick="closeTab(event, '${tabPath}')"><i class="fa-solid fa-xmark"></i></span>
        `;
        tabsBar.appendChild(tabEl);
    });
}

// Update dirty state of active tab
function updateTabDirtyState(filePath) {
    const isDirty = fileCache[filePath] !== originalCache[filePath];
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        const span = tab.querySelector('span');
        if (span && span.getAttribute('title') === filePath) {
            if (isDirty) {
                tab.classList.add('unsaved');
            } else {
                tab.classList.remove('unsaved');
            }
        }
    });
}

// Close tab
function closeTab(event, filePath) {
    event.stopPropagation();

    // Check for unsaved changes
    if (fileCache[filePath] !== originalCache[filePath]) {
        const confirmClose = confirm(`"${filePath}" has unsaved changes. Are you sure you want to close it?`);
        if (!confirmClose) return;
    }

    // Clean up caches for closed tab
    delete fileCache[filePath];
    delete originalCache[filePath];

    openTabs = openTabs.filter(t => t !== filePath);

    if (activeTab === filePath) {
        if (openTabs.length > 0) {
            openFile(openTabs[openTabs.length - 1]);
        } else {
            showWelcomeScreen();
        }
    } else {
        renderTabs();
    }
}

// Show Welcome screen
function showWelcomeScreen() {
    activeTab = null;
    welcomeScreen.style.display = 'flex';
    monacoContainer.style.display = 'none';
    activeFileIndicator.textContent = 'No File Open';
    langStatus.textContent = 'PLAIN TEXT';
    renderTabs();

    // Refresh sidebar to ensure consistency
    refreshWorkspace();
}

// Save Current File
async function saveCurrentFile() {
    if (!activeTab) return;
    const content = editor.getValue();

    try {
        const response = await fetch('/api/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: activeTab, content })
        });
        const data = await response.json();
        if (data.success) {
            originalCache[activeTab] = content;
            updateTabDirtyState(activeTab);
            showConsoleLine(`[Koder] Saved "${activeTab}" successfully.`, 'success-line');
        } else {
            showConsoleLine(`[Save Error] ${data.error}`, 'error-line');
        }
    } catch (err) {
        showConsoleLine(`[Save Error] ${err.message}`, 'error-line');
    }
}

// Run Current Code
async function runCurrentCode() {
    if (!activeTab) {
        showConsoleLine(`[Koder] Select or open a JS or C# file to execute.`, 'system-line');
        return;
    }

    // Save automatically before running
    if (fileCache[activeTab] !== originalCache[activeTab]) {
        await saveCurrentFile();
    }

    // Prepare console UI
    clearConsole();
    showConsoleLine(`[Koder] Launching runner for ${activeTab}...`, 'system-line');
    executionStats.textContent = 'Running...';

    try {
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: activeTab })
        });
        const data = await response.json();

        if (data.success) {
            executionStats.textContent = `Exit: ${data.exitCode} (${data.duration}ms)`;

            if (data.stdout) {
                showConsoleLine(data.stdout);
            }
            if (data.stderr) {
                showConsoleLine(data.stderr, 'error-line');
            }
            if (!data.stdout && !data.stderr) {
                showConsoleLine(`[Koder] Code executed successfully but returned no console output.`, 'system-line');
            }
        } else {
            executionStats.textContent = `Failed (${data.duration}ms)`;
            if (data.stdout) {
                showConsoleLine(data.stdout);
            }
            if (data.stderr) {
                showConsoleLine(data.stderr, 'error-line');
            } else {
                showConsoleLine(`[Koder Error] ${data.error || 'Unknown error occurred during code run.'}`, 'error-line');
            }
        }
    } catch (err) {
        executionStats.textContent = 'Error';
        showConsoleLine(`[Runner Error] ${err.message}`, 'error-line');
    }
}

// Format current file using Monaco formatting
function formatDocument() {
    if (!editor) return;
    editor.getAction('editor.action.formatDocument').run();
}

// Console helpers
function showConsoleLine(text, className = '') {
    const line = document.createElement('div');
    line.className = `console-line ${className}`;
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    consoleOutput.innerHTML = '';
}

// Modal dialog functions
function showModal(title, placeholder, defaultValue, onConfirm) {
    modalTitle.textContent = title;
    modalInput.placeholder = placeholder;
    modalInput.value = defaultValue || '';
    modalError.textContent = '';
    modalContainer.classList.remove('hidden');
    modalInput.focus();

    modalCallback = onConfirm;
}

function closeModal() {
    modalContainer.classList.add('hidden');
    modalCallback = null;
}

// Trigger handlers for sidebar explorer actions
function triggerNewFileCreation() {
    showModal('Create New File', 'relative/path/to/file.js', '', async (filename) => {
        if (!filename.trim()) {
            modalError.textContent = 'Filename cannot be empty.';
            return false;
        }
        try {
            const response = await fetch('/api/file/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filename.trim(), isFolder: false })
            });
            const data = await response.json();
            if (data.success) {
                await refreshWorkspace();
                await openFile(filename.trim());
                return true;
            } else {
                modalError.textContent = data.error;
                return false;
            }
        } catch (err) {
            modalError.textContent = err.message;
            return false;
        }
    });
}

function triggerNewFolderCreation() {
    showModal('Create New Folder', 'relative/path/to/folder', '', async (foldername) => {
        if (!foldername.trim()) {
            modalError.textContent = 'Folder name cannot be empty.';
            return false;
        }
        try {
            const response = await fetch('/api/file/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: foldername.trim(), isFolder: true })
            });
            const data = await response.json();
            if (data.success) {
                await refreshWorkspace();
                return true;
            } else {
                modalError.textContent = data.error;
                return false;
            }
        } catch (err) {
            modalError.textContent = err.message;
            return false;
        }
    });
}

function triggerRename(oldPath) {
    showModal(`Rename "${oldPath}"`, 'New relative path/name', oldPath, async (newPath) => {
        if (!newPath.trim() || newPath.trim() === oldPath) {
            modalError.textContent = 'Please specify a different valid name/path.';
            return false;
        }
        try {
            const response = await fetch('/api/file/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newPath: newPath.trim() })
            });
            const data = await response.json();
            if (data.success) {
                // If the renamed file is currently open, switch its cache path
                if (activeTab === oldPath) {
                    activeTab = newPath.trim();
                }
                if (fileCache[oldPath] !== undefined) {
                    fileCache[newPath.trim()] = fileCache[oldPath];
                    originalCache[newPath.trim()] = originalCache[oldPath];
                    delete fileCache[oldPath];
                    delete originalCache[oldPath];
                }
                openTabs = openTabs.map(t => t === oldPath ? newPath.trim() : t);

                await refreshWorkspace();
                if (activeTab === newPath.trim()) {
                    await openFile(newPath.trim());
                } else {
                    renderTabs();
                }
                return true;
            } else {
                modalError.textContent = data.error;
                return false;
            }
        } catch (err) {
            modalError.textContent = err.message;
            return false;
        }
    });
}

function triggerDelete(filePath) {
    const confirmDelete = confirm(`Are you sure you want to permanently delete "${filePath}"?`);
    if (!confirmDelete) return;

    fetch('/api/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            // Remove from open tabs if currently open
            openTabs = openTabs.filter(t => t !== filePath);
            delete fileCache[filePath];
            delete originalCache[filePath];

            if (activeTab === filePath) {
                if (openTabs.length > 0) {
                    openFile(openTabs[openTabs.length - 1]);
                } else {
                    showWelcomeScreen();
                }
            } else {
                refreshWorkspace();
                renderTabs();
            }
            showConsoleLine(`[Koder] Deleted "${filePath}" successfully.`, 'success-line');
        } else {
            alert(`Delete failed: ${data.error}`);
        }
    })
    .catch(err => alert(`Delete failed: ${err.message}`));
}

// Predefined actions from welcome screen
function openPredefinedFile(filename) {
    openFile(filename);
}

// Modal action triggers
modalBtnConfirm.addEventListener('click', async () => {
    if (modalCallback) {
        const success = await modalCallback(modalInput.value);
        if (success) {
            closeModal();
        }
    }
});

modalBtnCancel.addEventListener('click', closeModal);

modalInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        modalBtnConfirm.click();
    } else if (e.key === 'Escape') {
        closeModal();
    }
});

// Setup Toolbar Buttons
document.getElementById('btn-save').addEventListener('click', saveCurrentFile);
document.getElementById('btn-run').addEventListener('click', runCurrentCode);
document.getElementById('btn-new-file').addEventListener('click', triggerNewFileCreation);
document.getElementById('btn-new-folder').addEventListener('click', triggerNewFolderCreation);
document.getElementById('btn-format').addEventListener('click', formatDocument);

// Sidebar header actions
document.getElementById('sidebar-new-file-btn').addEventListener('click', triggerNewFileCreation);
document.getElementById('sidebar-new-folder-btn').addEventListener('click', triggerNewFolderCreation);
document.getElementById('sidebar-refresh-btn').addEventListener('click', refreshWorkspace);

// Console utilities
document.getElementById('btn-clear-console').addEventListener('click', clearConsole);

const consolePanel = document.getElementById('console-panel');
const toggleConsoleBtn = document.getElementById('btn-toggle-console');
toggleConsoleBtn.addEventListener('click', () => {
    if (consolePanel.classList.contains('expanded')) {
        consolePanel.classList.remove('expanded');
        consolePanel.classList.add('collapsed');
        toggleConsoleBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    } else if (consolePanel.classList.contains('collapsed')) {
        consolePanel.classList.remove('collapsed');
        toggleConsoleBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    } else {
        // From normal to expanded
        consolePanel.classList.add('expanded');
        toggleConsoleBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    }
});

// Keyboard Shortcut Bindings (Save/Run)
window.addEventListener('keydown', (e) => {
    // Ctrl + S (Save)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
    }
    // Ctrl + Enter (Run)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCurrentCode();
    }
});
