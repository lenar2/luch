"""Self-contained regression tests for BF2026 R10.7 quote-only contract."""
import itertools
import json
from pathlib import Path
import unittest
from quote import QuoteRejected, quote, create_order

CONTRACT = json.loads((Path(__file__).parent / "r107_site_contract_snapshot.json").read_text())

class QuoteTests(unittest.TestCase):
    def test_all_265_approved_choices(self):
        source_choices = [("source", "1"), ("source", "2")]
        pool = [(k, None) for k in ("rejection", "devaluation", "self", "guilt", "rejection_program", "dnv", "union", "trainer")] + source_choices
        accepted = 0
        for size in range(2, 6):
            for choice in itertools.combinations(pool, size):
                items = [{"key": key, **({"variant": v} if v else {})} for key, v in choice]
                try:
                    result = quote(items, CONTRACT)
                except QuoteRejected:
                    continue
                accepted += 1
                self.assertFalse(result["checkout_enabled"])
                self.assertEqual(result["status"], "QUOTE_ONLY_SALES_HOLD")
                self.assertGreater(result["total_rub"], 0)
                self.assertEqual(result["total_rub"] % 10, 0)
        self.assertEqual(accepted, 265)

    def test_canonical_examples(self):
        self.assertEqual(quote([{"key":"rejection"}, {"key":"devaluation"}], CONTRACT)["total_rub"], 6000)
        self.assertEqual(quote([{"key":"rejection_program"}, {"key":"union"}], CONTRACT)["total_rub"], 11690)
        self.assertEqual(quote([{"key":"source", "variant":"2"}, {"key":"trainer"}], CONTRACT)["total_rub"], 34200)
        self.assertEqual(quote([{"key":"rejection"}, {"key":"devaluation"}, {"key":"dnv"}], CONTRACT)["total_rub"], 11790)

    def test_fail_closed(self):
        bad = [
            [{"key":"rejection"}],
            [{"key":"rejection"}, {"key":"rejection"}],
            [{"key":"rejection"}, {"key":"devaluation"}, {"key":"self"}],
            [{"key":"rejection_program"}, {"key":"guilt"}],
            [{"key":"source"}, {"key":"dnv"}],
            [{"key":"source", "variant":"3"}, {"key":"dnv"}],
            [{"key":"source", "variant":"1"}, {"key":"source", "variant":"2"}],
            [{"key":"rejection", "price": 1}, {"key":"union"}],
            [{"key":"stories_integration_lot_11"}, {"key":"dnv"}],
            [{"key":"unknown"}, {"key":"dnv"}],
        ]
        for items in bad:
            with self.subTest(items=items), self.assertRaises(QuoteRejected):
                quote(items, CONTRACT)
        with self.assertRaises(RuntimeError):
            create_order(user_id=123)

    def test_contract_drift_rejected(self):
        for field, value in [("id","other"),("checkout_enabled",True),("max_individual_audio_items",4),("default_access_days",0)]:
            copy = {**CONTRACT, field:value}
            with self.subTest(field=field), self.assertRaises(QuoteRejected):
                quote([{"key":"dnv"},{"key":"trainer"}], copy)

if __name__ == "__main__":
    unittest.main()
