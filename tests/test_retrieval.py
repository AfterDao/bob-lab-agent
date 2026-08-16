import unittest

from app import answer_question, retrieve, tokenize


class RetrievalTests(unittest.TestCase):
    def test_tokenize_chinese_bigrams(self):
        tokens = tokenize("伺服器帳號")
        self.assertIn("伺服", tokens)
        self.assertIn("帳號", tokens)

    def test_retrieve_git_guide(self):
        results = retrieve("Git 分支要怎麼使用？")
        self.assertTrue(results)
        self.assertIn("03-git.md", [result.source for result in results])

    def test_unknown_query_returns_empty(self):
        self.assertEqual(retrieve("火星栽培馬鈴薯"), [])

    def test_greeting_does_not_require_documents(self):
        result = answer_question("你好！", "unused")
        self.assertIn("實驗室的開發助手", result["answer"])
        self.assertEqual(result["sources"], [])


if __name__ == "__main__":
    unittest.main()
