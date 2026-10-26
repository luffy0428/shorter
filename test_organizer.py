"""
Automated Unit Tests for File Organizer Prototype
Tests scanning, categorization, dry-run, organization, and undo mechanisms.
"""

import unittest
import tempfile
import shutil
from pathlib import Path
import file_organizer


class TestFileOrganizer(unittest.TestCase):
    def setUp(self):
        # Create a isolated temporary directory for testing
        self.test_dir = tempfile.mkdtemp(prefix="test_organizer_")
        self.target_path = Path(self.test_dir)

    def tearDown(self):
        # Clean up temporary test directory
        if self.target_path.exists():
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_dummy_creation_and_scan(self):
        result = file_organizer.create_dummy_sample_files(str(self.target_path))
        self.assertTrue(result["success"])
        self.assertGreater(result["created_count"], 10)

        # Scan the directory
        scan = file_organizer.scan_directory(str(self.target_path))
        self.assertEqual(scan["total_files"], result["created_count"])
        self.assertIn("Documents", scan["categories"])
        self.assertIn("Images", scan["categories"])
        self.assertIn("Audio", scan["categories"])
        self.assertIn("Video", scan["categories"])
        self.assertGreater(scan["categories"]["Documents"]["count"], 0)
        self.assertGreater(scan["categories"]["Images"]["count"], 0)

    def test_dry_run(self):
        file_organizer.create_dummy_sample_files(str(self.target_path))
        dry_run_res = file_organizer.organize_directory(str(self.target_path), dry_run=True)
        self.assertTrue(dry_run_res["success"])
        self.assertTrue(dry_run_res["dry_run"])

        # In dry run, files must NOT have been moved
        scan_after = file_organizer.scan_directory(str(self.target_path))
        self.assertEqual(scan_after["total_files"], dry_run_res["total_organized"])

    def test_organization_and_undo(self):
        # 1. Create samples
        file_organizer.create_dummy_sample_files(str(self.target_path))
        initial_scan = file_organizer.scan_directory(str(self.target_path))
        initial_count = initial_scan["total_files"]

        # 2. Run actual organization
        organize_res = file_organizer.organize_directory(str(self.target_path), dry_run=False)
        self.assertTrue(organize_res["success"])
        self.assertEqual(organize_res["total_organized"], initial_count)

        # Loose files in root directory should now be 0 (all moved to subdirectories)
        post_organize_scan = file_organizer.scan_directory(str(self.target_path))
        self.assertEqual(post_organize_scan["total_files"], 0)

        # Check subdirectories exist
        doc_dir = self.target_path / "Documents"
        img_dir = self.target_path / "Images"
        self.assertTrue(doc_dir.exists() and doc_dir.is_dir())
        self.assertTrue(img_dir.exists() and img_dir.is_dir())

        # 3. Test Undo
        undo_res = file_organizer.undo_last_organization(str(self.target_path))
        self.assertTrue(undo_res["success"])
        self.assertEqual(undo_res["restored_count"], initial_count)

        # Scan again - loose files should be back in root
        post_undo_scan = file_organizer.scan_directory(str(self.target_path))
        self.assertEqual(post_undo_scan["total_files"], initial_count)

        # Check that empty category folders were cleaned up
        self.assertFalse(doc_dir.exists())
        self.assertFalse(img_dir.exists())

    def test_collision_safe_naming(self):
        # Create folder and collision file
        subfolder = self.target_path / "Documents"
        subfolder.mkdir(parents=True, exist_ok=True)
        existing_file = subfolder / "notes.txt"
        existing_file.write_text("Old file content", encoding="utf-8")

        # Create new file with same name in root
        new_file = self.target_path / "notes.txt"
        new_file.write_text("New file content", encoding="utf-8")

        # Organize
        file_organizer.organize_directory(str(self.target_path), dry_run=False)

        # Both files should exist in subfolder, one renamed to notes (1).txt
        self.assertTrue(existing_file.exists())
        collision_file = subfolder / "notes (1).txt"
        self.assertTrue(collision_file.exists())
        self.assertEqual(collision_file.read_text(encoding="utf-8"), "New file content")


if __name__ == "__main__":
    unittest.main()
