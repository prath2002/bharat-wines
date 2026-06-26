from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class OCRResult:
    def __init__(self, raw_text: str, confidence: float, provider_metadata: Optional[Dict[str, Any]] = None):
        self.raw_text = raw_text
        self.confidence = confidence
        self.provider_metadata = provider_metadata or {}

class OCRInterface(ABC):
    @abstractmethod
    async def extract_text(self, file_path_or_url: str) -> OCRResult:
        """
        Extract raw text from an image or PDF.
        """
        pass
