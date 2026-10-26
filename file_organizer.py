"""
File Organizer Core Logic
Handles file scanning, categorization, collision-safe sorting, and undo operations.
Pure Python standard library implementation.
"""

import os
import shutil
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

# Default category mappings
DEFAULT_CATEGORIES: Dict[str, List[str]] = {
    "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".raw"],
    "Documents": [".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt", ".xlsx", ".xls", ".csv", ".pptx", ".ppt", ".md", ".epub"],
    "Audio": [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".opus"],
    "Video": [".mp4", ".mkv", ".flv", ".avi", ".mov", ".wmv", ".webm", ".m4v"],
    "Archives": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso"],
    "Code & Data": [".py", ".js", ".ts", ".html", ".css", ".json", ".xml", ".yaml", ".yml", ".sql", ".sh", ".bat", ".c", ".cpp", ".h", ".java", ".rs"],
    "Executables": [".exe", ".msi", ".apk", ".bat", ".cmd", ".bin"],
}

HISTORY_FILENAME = ".organizer_history.json"
IGNORED_FILES = {HISTORY_FILENAME, "app.py", "file_organizer.py", "desktop.ini", "Thumbs.db"}


def format_file_size(size_bytes: int) -> str:
    """Format bytes into human-readable string (KB, MB, GB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def get_category_for_extension(ext: str, custom_categories: Optional[Dict[str, List[str]]] = None) -> str:
    """Determine the category for a given file extension."""
    ext = ext.lower()
    categories = custom_categories if custom_categories is not None else DEFAULT_CATEGORIES
    for category, extensions in categories.items():
        if ext in [e.lower() for e in extensions]:
            return category
    return "Others"


def scan_directory(dir_path: str, custom_categories: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
    """
    Scan the target directory and classify files without moving them.
    Returns metadata, category counts, file list, and size totals.
    """
    target = Path(dir_path).resolve()
    if not target.exists():
        raise FileNotFoundError(f"Directory not found: {dir_path}")
    if not target.is_dir():
        raise NotADirectoryError(f"Path is not a directory: {dir_path}")

    files_list = []
    category_summary: Dict[str, Dict[str, Any]] = {}
    total_size = 0

    # Initialize known categories in summary
    categories = custom_categories if custom_categories is not None else DEFAULT_CATEGORIES
    for cat in list(categories.keys()) + ["Others"]:
        category_summary[cat] = {"count": 0, "size_bytes": 0, "size_formatted": "0 B"}

    for entry in target.iterdir():
        # Only process regular files directly in the root of target directory
        if entry.is_file():
            if entry.name in IGNORED_FILES or entry.name.startswith("."):
                continue

            ext = entry.suffix.lower()
            category = get_category_for_extension(ext, custom_categories)
            try:
                stat = entry.stat()
                file_size = stat.st_size
                mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))
            except OSError:
                file_size = 0
                mtime = "Unknown"

            total_size += file_size
            files_list.append({
                "name": entry.name,
                "path": str(entry),
                "extension": ext or "(none)",
                "category": category,
                "size_bytes": file_size,
                "size_formatted": format_file_size(file_size),
                "modified": mtime,
            })

            category_summary[category]["count"] += 1
            category_summary[category]["size_bytes"] += file_size

    # Update formatted sizes for summary
    for cat in category_summary:
        category_summary[cat]["size_formatted"] = format_file_size(category_summary[cat]["size_bytes"])

    # Check if undo is available
    history_file = target / HISTORY_FILENAME
    has_undo = history_file.exists()

    return {
        "directory": str(target),
        "total_files": len(files_list),
        "total_size_bytes": total_size,
        "total_size_formatted": format_file_size(total_size),
        "categories": category_summary,
        "files": files_list,
        "can_undo": has_undo
    }


def get_unique_destination(destination_folder: Path, filename: str) -> Path:
    """Generate a collision-free destination path with (1), (2) numbering if name exists."""
    target_path = destination_folder / filename
    if not target_path.exists():
        return target_path

    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 1
    while True:
        new_name = f"{stem} ({counter}){suffix}"
        target_path = destination_folder / new_name
        if not target_path.exists():
            return target_path
        counter += 1


def organize_directory(
    dir_path: str,
    custom_categories: Optional[Dict[str, List[str]]] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Sort files into categorized folders.
    Records history for safe undo operations.
    """
    target = Path(dir_path).resolve()
    if not target.exists() or not target.is_dir():
        raise FileNotFoundError(f"Valid directory path required: {dir_path}")

    scan_result = scan_directory(str(target), custom_categories)
    files_to_move = scan_result["files"]

    moved_records = []
    created_directories = set()

    for item in files_to_move:
        src_path = Path(item["path"])
        category = item["category"]
        category_dir = target / category

        if not dry_run:
            if not category_dir.exists():
                category_dir.mkdir(parents=True, exist_ok=True)
                created_directories.add(str(category_dir))

            dest_path = get_unique_destination(category_dir, src_path.name)
            shutil.move(str(src_path), str(dest_path))
            moved_records.append({
                "original_name": src_path.name,
                "original_path": str(src_path),
                "moved_path": str(dest_path),
                "category": category,
                "size_formatted": item["size_formatted"]
            })
        else:
            dest_preview = category_dir / src_path.name
            moved_records.append({
                "original_name": src_path.name,
                "original_path": str(src_path),
                "moved_path": str(dest_preview),
                "category": category,
                "size_formatted": item["size_formatted"]
            })

    # Save history for undo if not dry run and files were moved
    if not dry_run and moved_records:
        history_path = target / HISTORY_FILENAME
        history_data = {
            "timestamp": time.time(),
            "formatted_time": time.strftime('%Y-%m-%d %H:%M:%S'),
            "target_dir": str(target),
            "moved_files": moved_records,
            "created_directories": list(created_directories)
        }
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(history_data, f, indent=2)

    return {
        "success": True,
        "dry_run": dry_run,
        "total_organized": len(moved_records),
        "target_directory": str(target),
        "moved_files": moved_records,
        "can_undo": not dry_run and len(moved_records) > 0
    }


def undo_last_organization(dir_path: str) -> Dict[str, Any]:
    """
    Reverts the last organization action using the stored history file.
    Moves files back to the parent folder and removes empty category folders.
    """
    target = Path(dir_path).resolve()
    history_path = target / HISTORY_FILENAME

    if not history_path.exists():
        return {
            "success": False,
            "message": "No undo history found in this directory.",
            "restored_count": 0
        }

    try:
        with open(history_path, "r", encoding="utf-8") as f:
            history_data = json.load(f)
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to read history file: {e}",
            "restored_count": 0
        }

    moved_files = history_data.get("moved_files", [])
    restored_files = []
    errors = []

    for item in moved_files:
        current_loc = Path(item["moved_path"])
        orig_loc = Path(item["original_path"])

        if current_loc.exists():
            # If the original location is somehow already taken, find a safe alternative
            target_dest = get_unique_destination(orig_loc.parent, orig_loc.name)
            try:
                shutil.move(str(current_loc), str(target_dest))
                restored_files.append({
                    "name": item["original_name"],
                    "restored_to": str(target_dest)
                })
            except Exception as ex:
                errors.append(f"Could not restore {current_loc.name}: {ex}")

    # Remove empty category directories that were created
    for dir_str in history_data.get("created_directories", []):
        d = Path(dir_str)
        try:
            if d.exists() and d.is_dir() and not any(d.iterdir()):
                d.rmdir()
        except OSError:
            pass

    # Remove history file once restored
    try:
        history_path.unlink()
    except OSError:
        pass

    return {
        "success": True,
        "message": f"Successfully restored {len(restored_files)} file(s).",
        "restored_count": len(restored_files),
        "restored_files": restored_files,
        "errors": errors
    }


def create_dummy_sample_files(target_dir: str) -> Dict[str, Any]:
    """
    Generate sample mock files across multiple extensions for instant prototype demonstration.
    """
    target = Path(target_dir).resolve()
    target.mkdir(parents=True, exist_ok=True)

    samples = [
        ("report_financial_2026.pdf", "Documents", "Sample Financial Report 2026 Content\nBalance Sheet & Summary."),
        ("meeting_notes.docx", "Documents", "Meeting notes from project alignment call."),
        ("project_tasks.txt", "Documents", "1. Setup Python backend\n2. Design HTML/CSS UI\n3. Test file sorting."),
        ("sales_data.xlsx", "Documents", "Quarterly sales figures and metrics."),
        ("vacation_photo.jpg", "Images", "JPEG_DUMMY_IMAGE_BINARY_DATA"),
        ("company_logo.png", "Images", "PNG_DUMMY_IMAGE_BINARY_DATA"),
        ("app_banner.webp", "Images", "WEBP_DUMMY_IMAGE_BINARY_DATA"),
        ("vector_icon.svg", "Images", "<svg><circle cx='50' cy='50' r='40' fill='cyan'/></svg>"),
        ("podcast_episode_1.mp3", "Audio", "MP3_DUMMY_AUDIO_DATA"),
        ("soundtrack_theme.wav", "Audio", "WAV_DUMMY_AUDIO_DATA"),
        ("demo_tutorial.mp4", "Video", "MP4_DUMMY_VIDEO_DATA"),
        ("screen_recording.mkv", "Video", "MKV_DUMMY_VIDEO_DATA"),
        ("dataset_backup.zip", "Archives", "ZIP_DUMMY_ARCHIVE_DATA"),
        ("source_archive.tar.gz", "Archives", "TAR_GZ_DUMMY_DATA"),
        ("data_pipeline.py", "Code & Data", "import os\nprint('Data pipeline running...')"),
        ("frontend_script.js", "Code & Data", "console.log('Prototype loaded successfully');"),
        ("configuration.json", "Code & Data", '{"version": "1.0", "name": "FileSortPrototype"}'),
        ("installer_setup.exe", "Executables", "DUMMY_EXE_DATA"),
        ("readme_instructions.md", "Documents", "# Project Readme\nInstructions for sorting prototype.")
    ]

    created = []
    for filename, category, content in samples:
        filepath = target / filename
        if not filepath.exists():
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            created.append({"name": filename, "category": category})

    return {
        "success": True,
        "sample_dir": str(target),
        "created_count": len(created),
        "files": created
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Python File Type Sorter CLI")
    parser.add_argument("directory", nargs="?", default=".", help="Directory to scan or organize (default: current directory)")
    parser.add_argument("--scan", action="store_true", help="Scan and display files and categories without moving")
    parser.add_argument("--organize", action="store_true", help="Organize files into category folders")
    parser.add_argument("--dry-run", action="store_true", help="Preview moves without touching files")
    parser.add_argument("--undo", action="store_true", help="Undo last organization in the directory")
    parser.add_argument("--create-samples", action="store_true", help="Create dummy test files for demonstration")

    args = parser.parse_args()

    if args.create_samples:
        res = create_dummy_sample_files(args.directory)
        print(f"Created {res['created_count']} sample files in '{res['sample_dir']}'")

    elif args.undo:
        res = undo_last_organization(args.directory)
        print(res["message"])

    elif args.organize:
        res = organize_directory(args.directory, dry_run=args.dry_run)
        mode = "DRY RUN PREVIEW" if args.dry_run else "ORGANIZED"
        print(f"[{mode}] Total files processed: {res['total_organized']}")
        for f in res["moved_files"]:
            print(f"  {f['original_name']} -> {f['category']}/")

    else:
        # Default action is scan
        res = scan_directory(args.directory)
        print(f"\nDirectory: {res['directory']}")
        print(f"Total Files: {res['total_files']} ({res['total_size_formatted']})")
        print("\nCategory Breakdown:")
        for cat, data in res["categories"].items():
            if data["count"] > 0:
                print(f"  - {cat:<14}: {data['count']} files ({data['size_formatted']})")
        print(f"\nUndo Available: {'Yes' if res['can_undo'] else 'No'}\n")
