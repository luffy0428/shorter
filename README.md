# 🗂️ File Type Sorter — Python Prototype

A fast, collision-safe file organization application built with **pure Python** (zero external dependencies) and a modern **HTML5 & CSS3** responsive dashboard interface.

---

## 🌟 Key Features

1. **Pure Python Engine (`file_organizer.py`)**
   - Built entirely on Python standard libraries (`pathlib`, `shutil`, `json`, `os`, `time`, `http.server`).
   - Zero third-party `pip` dependencies required—runs anywhere Python is installed.
   - **Collision-Safe Sorting**: Prevents overwriting files with the same name by automatically appending `(1)`, `(2)`, etc.
   - **Full Rollback / Undo**: Tracks organization events in a manifest file so you can safely revert sorted files back to their original locations with one click.
   - **Dry Run Simulation**: Allows previewing exact destinations before moving any files.

2. **Modern HTML5 & CSS3 Interface (`static/`)**
   - Dark mode responsive design with card layout, KPI summary indicators, and category color badges.
   - Interactive category distribution breakdown bar.
   - Real-time file search and category filter.
   - One-click **"Generate Sample Files"** to test sorting safely on mock files without altering real files.
   - Live activity log console.

3. **Dual Execution Modes**
   - **Web UI Mode**: Interactive visual web app running on local Python HTTP server.
   - **CLI Mode**: Direct terminal commands for automated workflows or headless machines.

---

## 📁 Project Architecture

```
108 python/
├── app.py                   # Python HTTP Server & JSON REST API backend
├── file_organizer.py        # Core file sorting, collision handling & undo engine
├── test_organizer.py        # Automated test suite (unit tests)
├── README.md                # Documentation and guide
├── sample_test_folder/      # Demo sandbox folder with sample mock files
└── static/
    ├── index.html           # Modern dashboard UI
    ├── style.css            # Dark mode aesthetic styling
    └── app.js               # Frontend controller & API communication
```

---

## 🚀 Quick Start Guide

### 1. Launch the Web Interface

Open PowerShell or Command Prompt in this folder and run:

```powershell
python app.py
```

- The server will automatically start at `http://localhost:8000` (or the next available port).
- Your default web browser will automatically open to the dashboard.

### 2. Using the Web Interface

1. **Test with Demo Folder**:
   - Click **"Use Demo Folder"** or **"Generate Sample Files"**.
   - Click **"Scan & Preview"** to inspect categorized files.
   - Click **"Dry Run Preview"** to simulate the sorting without moving anything.
   - Click **"Organize Now"** to sort the files into folders.
   - Click **"Undo Last Sort"** anytime to restore all files back to their original place!

2. **Organize Any Folder**:
   - Enter any folder path (e.g. `C:\Users\HP\Downloads` or click the **"Downloads"** shortcut).
   - Preview and organize safely.

---

## 💻 Optional Command Line Interface (CLI)

You can also run the organizer directly from the terminal without the web browser:

```powershell
# Display help and options
python file_organizer.py --help

# Create dummy sample files in a test directory
python file_organizer.py sample_test_folder --create-samples

# Scan a folder and view file breakdown
python file_organizer.py sample_test_folder --scan

# Dry run simulation (preview moves)
python file_organizer.py sample_test_folder --organize --dry-run

# Perform real organization
python file_organizer.py sample_test_folder --organize

# Undo and restore files to root
python file_organizer.py sample_test_folder --undo
```

---

## 🏷️ Default File Categories & Extensions

| Category | Supported File Extensions |
| :--- | :--- |
| **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.svg`, `.webp`, `.ico`, `.tiff`, `.raw` |
| **Documents** | `.pdf`, `.docx`, `.doc`, `.txt`, `.rtf`, `.odt`, `.xlsx`, `.xls`, `.csv`, `.pptx`, `.ppt`, `.md`, `.epub` |
| **Audio** | `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.wma`, `.opus` |
| **Video** | `.mp4`, `.mkv`, `.flv`, `.avi`, `.mov`, `.wmv`, `.webm`, `.m4v` |
| **Archives** | `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.bz2`, `.xz`, `.iso` |
| **Code & Data** | `.py`, `.js`, `.ts`, `.html`, `.css`, `.json`, `.xml`, `.yaml`, `.sql`, `.sh`, `.bat`, `.c`, `.cpp`, `.java`, `.rs` |
| **Executables** | `.exe`, `.msi`, `.apk`, `.bat`, `.cmd`, `.bin` |
| **Others** | Any unmatched extension or extensionless files |

---

## 🧪 Running the Unit Tests

Execute the automated test suite anytime using:

```powershell
python test_organizer.py
```
