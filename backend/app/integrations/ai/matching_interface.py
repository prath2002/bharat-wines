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
    def match_products(self, extracted_names: List[str], catalog: List[Any]) -> List[MatchResult]:
        """
        Match a list of extracted product names against the local product catalog.
        """
        pass
