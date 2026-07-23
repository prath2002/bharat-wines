import re
from typing import List, Any, Optional, Dict
import rapidfuzz
from rapidfuzz import process, fuzz

from app.integrations.ai.matching_interface import MatchingInterface, MatchResult


def _parse_size_ml(size_str: Optional[str]) -> Optional[int]:
    if not size_str:
        return None
    match = re.search(r"\d+", size_str)
    return int(match.group()) if match else None


class FuzzyMatchingClient(MatchingInterface):
    def __init__(self, threshold: float = 80.0):
        # rapidfuzz uses 0-100 scoring
        self.threshold = threshold

    def match_products(
        self,
        extracted_names: List[str],
        catalog: List[Any],
        extracted_sizes: Optional[List[Optional[str]]] = None
    ) -> List[MatchResult]:
        results = []
        # Many catalogs sell the same brand across multiple sizes (90ml/180ml/750ml...)
        # under the exact same product name, so we must keep every product per name
        # instead of collapsing them into a single id.
        catalog_by_name: Dict[str, List[Any]] = {}
        for p in catalog:
            catalog_by_name.setdefault(p.name, []).append(p)
        catalog_names = list(catalog_by_name.keys())

        for i, extracted in enumerate(extracted_names):
            extracted_size = extracted_sizes[i] if extracted_sizes and i < len(extracted_sizes) else None

            if not catalog_names:
                # No catalog items
                results.append(MatchResult(extracted, None, 0.0, False))
                continue

            # Find the best match
            match = process.extractOne(
                extracted,
                catalog_names,
                scorer=fuzz.token_sort_ratio
            )

            if match:
                best_match_name, score, _ = match
                # Scale rapidfuzz 0-100 to 0.0-1.0
                confidence = score / 100.0
                is_matched = score >= self.threshold

                matched_id = None
                if is_matched:
                    candidates = catalog_by_name[best_match_name]
                    if len(candidates) == 1:
                        matched_id = candidates[0].id
                    else:
                        target_size = _parse_size_ml(extracted_size)
                        size_match = next(
                            (c for c in candidates if target_size is not None and c.size_ml == target_size),
                            None
                        )
                        matched_id = (size_match or candidates[0]).id

                results.append(MatchResult(
                    extracted_name=extracted,
                    matched_product_id=matched_id,
                    confidence=confidence,
                    is_matched=is_matched
                ))
            else:
                results.append(MatchResult(extracted, None, 0.0, False))

        return results
