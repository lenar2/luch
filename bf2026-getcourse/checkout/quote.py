"""BF2026 R10.7 quote-only validator. NO payment, GetCourse writes or live routing."""
from __future__ import annotations

class QuoteRejected(ValueError):
    """The requested cart is not an owner-approved BF2026 set."""

AUDIO_KEYS = frozenset(("rejection", "devaluation", "self", "guilt"))
REQUIRED_ID = "BF2026_LOT10_CUSTOM_SET_R107"


def quote(selection: list[dict], contract: dict) -> dict:
    """Recompute the approved total server-side; never trust browser totals."""
    if not isinstance(contract, dict) or contract.get("id") != REQUIRED_ID:
        raise QuoteRejected("UNSUPPORTED_CONTRACT")
    if contract.get("currency") != "RUB" or contract.get("checkout_enabled") is not False:
        raise QuoteRejected("NOT_A_QUOTE_ONLY_CONTRACT")
    if contract.get("minimum_items") != 2 or contract.get("maximum_items") != 5:
        raise QuoteRejected("UNEXPECTED_CARDINALITY")
    if contract.get("max_individual_audio_items") != 2 or contract.get("default_access_days") != 365:
        raise QuoteRejected("UNEXPECTED_RIGHTS_POLICY")
    if not isinstance(selection, list) or not 2 <= len(selection) <= 5:
        raise QuoteRejected("INVALID_ITEM_COUNT")
    product_map = {p["key"]: p for p in contract["products"]}
    if len(product_map) != len(contract["products"]):
        raise QuoteRejected("DUPLICATE_CONTRACT_KEY")
    selected = set()
    normalized = []
    subtotal = 0
    for item in selection:
        if not isinstance(item, dict) or not isinstance(item.get("key"), str):
            raise QuoteRejected("INVALID_ITEM")
        if set(item) - {"key", "variant"}:
            raise QuoteRejected("CLIENT_PRICE_OR_METADATA_NOT_ALLOWED")
        key = item["key"]
        if key in selected:
            raise QuoteRejected("DUPLICATE_ITEM")
        if key not in product_map or key in contract["excluded_from_bundle"]:
            raise QuoteRejected("UNKNOWN_OR_EXCLUDED_ITEM")
        product = product_map[key]
        if key == "source":
            variant = item.get("variant")
            if variant not in ("1", "2"):
                raise QuoteRejected("SOURCE_VARIANT_REQUIRED")
            options = {o["key"]: o for o in product["variants"]}
            unit_price = options[variant]["base_price_rub"]
            normalized.append(f"source:{variant}")
        else:
            if "variant" in item:
                raise QuoteRejected("UNEXPECTED_VARIANT")
            unit_price = product["base_price_rub"]
            normalized.append(key)
        if not isinstance(unit_price, int) or unit_price <= 0:
            raise QuoteRejected("INVALID_CANONICAL_PRICE")
        selected.add(key)
        subtotal += unit_price
    audio_count = len(selected & AUDIO_KEYS)
    if audio_count > 2:
        raise QuoteRejected("THIRD_INDIVIDUAL_AUDIO_FORBIDDEN")
    if "rejection_program" in selected and audio_count:
        raise QuoteRejected("PROGRAM_ALREADY_INCLUDES_ALL_AUDIO")
    discount = contract["tiers_percent"].get(str(len(selection)))
    if discount not in (10, 15, 25, 35):
        raise QuoteRejected("INVALID_DISCOUNT_TIER")
    if contract.get("rounding") != "nearest_10_rub_final_total":
        raise QuoteRejected("UNEXPECTED_ROUNDING")
    # Integer half-up to 10 RUB, applied ONCE to the final discounted sum.
    final_rub = ((subtotal * (100 - discount) + 500) // 1000) * 10
    return {
        "contract_id": REQUIRED_ID,
        "items": sorted(normalized),
        "subtotal_rub": subtotal,
        "discount_percent": discount,
        "total_rub": final_rub,
        "currency": "RUB",
        "access_days_after_confirmed_payment": 365,
        "checkout_enabled": False,
        "status": "QUOTE_ONLY_SALES_HOLD",
    }


def create_order(*args, **kwargs):
    """Deliberately fail closed. No production checkout adapter exists."""
    raise RuntimeError("SALES_HOLD_CHECKOUT_NOT_AUTHORIZED")
