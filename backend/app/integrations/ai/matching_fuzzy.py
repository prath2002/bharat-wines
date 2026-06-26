from typing import List, Any
import rapidfuzz
from rapidfuzz import process, fuzz

from app.integrations.ai.matching_interface import MatchingInterface, MatchResult

class FuzzyMatchingClient(MatchingInterface):
    def __init__(self, threshold: float = 80.0):
        # rapidfuzz uses 0-100 scoring
        self.threshold = threshold

    def match_products(self, extracted_names: List[str], catalog: List[Any]) -> List[MatchResult]:
        results = []
        # Create a dict mapping normalized catalog names to product IDs for quick lookup
        # Assuming catalog is a list of SQLAlchemy Product objects with .id and .name
        catalog_map = {p.name: p.id for p in catalog}
        catalog_names = list(catalog_map.keys())

        for extracted in extracted_names:
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
                matched_id = catalog_map[best_match_name] if is_matched else None
                
                results.append(MatchResult(
                    extracted_name=extracted,
                    matched_product_id=matched_id,
                    confidence=confidence,
                    is_matched=is_matched
                ))
            else:
                results.append(MatchResult(extracted, None, 0.0, False))
                
        return results
