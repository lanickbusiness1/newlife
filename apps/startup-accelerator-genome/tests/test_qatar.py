from pathlib import Path
from html.parser import HTMLParser
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if "id" in d: self.ids.append(d["id"])

class QatarGenomeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s=HTML.read_text(encoding="utf-8")

    def test_program_data_is_centralized(self):
        self.assertIn("const PROGRAM_DATA", self.s)
        self.assertIn("2026-09-15", self.s)
        self.assertIn("1100000", self.s)
        self.assertIn("5500000", self.s)

    def test_primary_sources_present(self):
        self.assertIn("https://startupqatar.qa/en/investment-program", self.s)
        self.assertIn("qdb.qa", self.s)

    def test_no_unsupported_claims(self):
        low=self.s.lower()
        self.assertNotIn("3.3m", low)
        self.assertNotIn("3.3 million", low)
        self.assertNotIn("fully paid housing", low)
        self.assertIn("subsidized housing", low)

    def test_six_evidence_gates(self):
        for token in ["legalCapTable","runnableMvp","ipOwnership","clientPilotEvidence","actualFinancials","qatarLocalization"]:
            self.assertIn(token, self.s)

    def test_multilingual_rtl(self):
        self.assertIn("['fr','en','ar']", self.s)
        self.assertIn("document.documentElement.dir", self.s)

    def test_unique_dom_ids(self):
        p=Parser(); p.feed(self.s)
        self.assertEqual(len(p.ids),len(set(p.ids)))

if __name__ == "__main__": unittest.main()
