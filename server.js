const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Root of workspace
const WORKSPACE_DIR = path.resolve(__dirname, 'workspace');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path validation to prevent path traversal vulnerability
function securePath(relativeFilePath) {
    if (!relativeFilePath) {
        throw new Error('Path is required');
    }
    const resolvedPath = path.resolve(WORKSPACE_DIR, relativeFilePath);
    if (!resolvedPath.startsWith(WORKSPACE_DIR)) {
        throw new Error('Access denied: Path is outside workspace');
    }
    return resolvedPath;
}

// Ignore list for workspace files
function shouldIgnore(fileName) {
    const ignored = ['bin', 'obj', '.git', 'node_modules', '.DS_Store'];
    return ignored.includes(fileName);
}

// Recursively list files and folders
function getFileTree(dirPath) {
    const items = fs.readdirSync(dirPath);
    const tree = [];

    for (const item of items) {
        if (shouldIgnore(item)) continue;

        const fullPath = path.join(dirPath, item);
        const relPath = path.relative(WORKSPACE_DIR, fullPath);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            tree.push({
                name: item,
                path: relPath,
                type: 'directory',
                children: getFileTree(fullPath)
            });
        } else {
            tree.push({
                name: item,
                path: relPath,
                type: 'file'
            });
        }
    }

    // Sort: directories first, then files alphabetically
    return tree.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

// --- API ROUTES ---

// 1. Get file tree
app.get('/api/files', (req, res) => {
    try {
        const tree = getFileTree(WORKSPACE_DIR);
        res.json({ success: true, files: tree });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Read file content
app.get('/api/file', (req, res) => {
    try {
        const filePath = securePath(req.query.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        if (fs.statSync(filePath).isDirectory()) {
            return res.status(400).json({ success: false, error: 'Path is a directory' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Write / Save file content
app.post('/api/file', (req, res) => {
    try {
        const filePath = securePath(req.body.path);
        const content = req.body.content || '';

        // Ensure parent directory exists
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Create new file or folder
app.post('/api/file/create', (req, res) => {
    try {
        const { path: relPath, isFolder } = req.body;
        const filePath = securePath(relPath);

        if (fs.existsSync(filePath)) {
            return res.status(400).json({ success: false, error: 'File or folder already exists' });
        }

        if (isFolder) {
            fs.mkdirSync(filePath, { recursive: true });
            res.json({ success: true, message: 'Folder created successfully' });
        } else {
            // Ensure parent directory exists
            const parentDir = path.dirname(filePath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(filePath, '', 'utf8');
            res.json({ success: true, message: 'File created successfully' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Delete file or folder
app.delete('/api/file', (req, res) => {
    try {
        const filePath = securePath(req.body.path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File or folder not found' });
        }

        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Rename file or folder
app.post('/api/file/rename', (req, res) => {
    try {
        const oldPath = securePath(req.body.oldPath);
        const newPath = securePath(req.body.newPath);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ success: false, error: 'Original file or folder not found' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ success: false, error: 'Target name already exists' });
        }

        // Ensure parent directory of target path exists
        const parentDir = path.dirname(newPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.renameSync(oldPath, newPath);
        res.json({ success: true, message: 'Renamed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Run code
app.post('/api/run', (req, res) => {
    try {
        const relativePath = req.body.path;
        const filePath = securePath(relativePath);
        const ext = path.extname(filePath).toLowerCase();

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found to run' });
        }

        let cmd = '';
        let args = [];
        let cwd = WORKSPACE_DIR;

        if (ext === '.js') {
            cmd = 'node';
            args = [filePath];
        } else if (ext === '.cs') {
            // For C#, compile and run the project using dotnet run
            // Since dotnet run works at the project level, it runs program.cs.
            // If they create multiple C# files or run any .cs, dotnet run compiles all files in the directory.
            cmd = 'dotnet';
            args = ['run', '--project', 'KoderWorkspace.csproj'];
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported file type. Please run a .js or .cs file.' });
        }

        const startTime = Date.now();
        const runner = spawn(cmd, args, { cwd });

        let stdout = '';
        let stderr = '';
        let killedDueToTimeout = false;

        // Force kill after 15 seconds to prevent hung processes
        const timeoutId = setTimeout(() => {
            killedDueToTimeout = true;
            runner.kill('SIGKILL');
        }, 15000);

        runner.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        runner.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        runner.on('close', (code) => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            if (killedDueToTimeout) {
                res.json({
                    success: false,
                    stdout,
                    stderr: stderr + '\n[Koder] Process execution timed out after 15 seconds.',
                    exitCode: -1,
                    duration
                });
            } else {
                res.json({
                    success: true,
                    stdout,
                    stderr,
                    exitCode: code,
                    duration
                });
            }
        });

        runner.on('error', (err) => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            res.json({
                success: false,
                stdout,
                stderr: stderr + `\n[Koder] Error spawning runner: ${err.message}`,
                exitCode: -1,
                duration
            });
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Koder IDE Backend Server is running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(` Workspace: ${WORKSPACE_DIR}`);
    console.log(`=========================================`);
});
