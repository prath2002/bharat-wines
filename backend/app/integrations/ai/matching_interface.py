from abc import ABC, abstractmethod
from typing import List, Optional, Any
import uuid

class MatchResult:
    def __init__(self, extracted_name: str, matched_product_id: Optional[uuid.UUID], confidence: float, is_matched: bool):
        self.extracted_name = extracted_name
        self.matched_product_id = matched_product_id
        self.confidence = confidence
        self.is_matched = is_matched  # True if confidence >= threshold

class MatchingInterface(ABC):
    @abstractmethod
    def match_products(
        self,
        extracted_names: List[str],
        catalog: List[Any],
        extracted_sizes: Optional[List[Optional[str]]] = None
    ) -> List[MatchResult]:
        """
        Match a list of extracted product names against the local product catalog.

        extracted_sizes, if provided, is a parallel list used to disambiguate
        catalog products that share the same name but differ by size_ml (e.g.
        the same brand sold in 90ml/180ml/750ml bottles).
        """
        pass
