# Koder IDE 🚀

```text
██╗  ██╗ ██████╗ ██████╗ ███████╗██████╗
██║  ██║██╔═══██╗██╔══██╗██╔════╝██╔══██╗
███████║██║   ██║██║  ██║█████╗  ██████╔╝
██╔══██║██║   ██║██║  ██║██╔══╝  ██╔══██╗
██║  ██║╚██████╔╝██████╔╝███████╗██║  ██║
╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝ [BETA v1.0.0]
```

**Koder** is a modern, professional, web-based cloud Integrated Development Environment (IDE) designed specifically for **JavaScript** and **C# (CSharp)** development. With a sleek dark-themed interface inspired by modern editors like Visual Studio Code and Dracula theme, Koder enables developers to write, format, manage, and execute code directly inside their browser with sub-second execution times.

---

## ✨ Features

- **📂 Professional Workspace Explorer**
  - Fully recursive sidebar file tree displaying all folders and files in your workspace.
  - Full CRUD operations: Create new files, create new folders, rename files/directories, and delete them in real-time.
  - Automatic exclusion of build artifacts (`bin`, `obj`), lockfiles, and dependencies (`node_modules`) for clean workspace management.

- **💻 High-Performance Editor (Monaco)**
  - Fully integrated with the power of the **Monaco Editor** (the engine behind VS Code) via CDN.
  - Full syntax highlighting, error squiggles, and code completion (IntelliSense) for both JavaScript and C#.
  - **Multi-Tab Layout** supporting opening several files simultaneously with active state indication.
  - Unsaved modifications indicator (glowing dot) tracking modified tab states.
  - Interactive "Format Document" action using Monaco's high-fidelity formatting engine.

- **⚡ Direct Code Runners**
  - Seamless execution of JavaScript (`.js` files via Node.js) and C# (`.cs` files via .NET SDK and MSBuild) directly from the IDE.
  - Integrated bottom terminal panel displaying live outputs, stderr, and execution stats (Exit code, latency in milliseconds).
  - Process execution timeouts (15 seconds) to prevent infinite loops from hanging resources.

- **⌨️ Developer Shortcuts**
  - Save: `Ctrl + S` or `Cmd + S`
  - Run: `Ctrl + Enter` or `Cmd + Enter`
  - Format Code: `Alt + Shift + F`
  - Search: `Ctrl + F`

- **🔒 Workspace Protection & Security**
  - Path traversal guard verification in the backend ensuring all file operations remain safe and securely isolated inside the `workspace/` folder.

---

## 🏗️ Architecture

```
 Koder Web IDE
 ├── Front-end: Single-Page Web Application (HTML5, CSS3, ES6 JavaScript)
 │    ├── Monaco Editor: Interactive code editing, syntax highlight & formatting
 │    └── FontAwesome & Inter/Fira Code: High-end developer UI & typography
 └── Back-end: Express Node.js Server
      ├── File System REST API: Secure CRUD on files and directories
      └── Runner API: Process Spawning (Node.js & Dotnet runner processes)
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [.NET SDK](https://dotnet.microsoft.com/) (v8 or higher, for C# run support)

### Installation & Run

1. Clone or download the repository.
2. Install the server dependencies:
   ```bash
   npm install
   ```
3. Start the Koder server:
   ```bash
   npm start
   ```
4. Open your web browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 🛠️ Workspace Directory Structure

By default, the server acts on the `workspace/` subdirectory. Here is what is bundled with the default installation:
- `workspace/index.js` — The default JavaScript entrypoint.
- `workspace/program.cs` — The default C# program entrypoint.
- `workspace/KoderWorkspace.csproj` — The underlying project structure used to compile and run C# programs.

---

## 📝 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

---

Created with ❤️ by **Perseu** (2026)
