import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app import (
    answer_question,
    knowledge_status,
    retrieve,
    search,
    save_document,
    tokenize,
    validate_document_name,
)


class RetrievalTests(unittest.TestCase):
    def test_tokenize_chinese_bigrams(self):
        tokens = tokenize("伺服器帳號")
        self.assertIn("伺服", tokens)
        self.assertIn("帳號", tokens)

    def test_retrieve_git_guide(self):
        results = retrieve("Git 分支要怎麼使用？")
        self.assertTrue(results)
        self.assertIn("03-git.md", [result.source for result in results])

    def test_search_expands_branch_alias(self):
        results = search("branch 怎麼建立？")
        self.assertTrue(results)
        self.assertEqual(results[0].chunk.source, "03-git.md")
        self.assertGreater(results[0].score, 0)

    def test_unknown_query_returns_empty(self):
        self.assertEqual(retrieve("火星栽培馬鈴薯"), [])

    def test_greeting_does_not_require_documents(self):
        result = answer_question("你好！", "unused")
        self.assertIn("Bob Lab Agent", result["answer"])
        self.assertEqual(result["sources"], [])

    def test_knowledge_status(self):
        status = knowledge_status()
        self.assertGreaterEqual(status["documents"], 4)
        self.assertGreater(status["sections"], status["documents"])

    def test_document_name_adds_markdown_extension(self):
        self.assertEqual(validate_document_name("05-debugging"), "05-debugging.md")

    def test_document_name_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            validate_document_name("../secret.md")

    def test_save_document_creates_and_versions_markdown(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            knowledge = root / "knowledge"
            data = root / "data"
            knowledge.mkdir()
            with patch("app.KNOWLEDGE_DIR", knowledge), patch("app.DATA_DIR", data):
                created = save_document("guide", "# Guide\n\nFirst version")
                updated = save_document("guide.md", "# Guide\n\nSecond version", "guide.md")
            self.assertTrue(created["created"])
            self.assertFalse(updated["created"])
            self.assertIn("Second version", (knowledge / "guide.md").read_text(encoding="utf-8"))
            self.assertEqual(len(list((data / "versions").glob("*.md"))), 1)


if __name__ == "__main__":
    unittest.main()
