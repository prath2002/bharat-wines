import os
from .ocr_interface import OCRInterface
from .extraction_interface import ExtractionInterface
from .matching_interface import MatchingInterface

def get_ocr_client() -> OCRInterface:
    provider = os.getenv("OCR_PROVIDER", "mock")
    
    if provider == "mock":
        from .ocr_mock import MockOCRClient
        return MockOCRClient()
    elif provider == "textract":
        from .ocr_textract import TextractOCRClient
        return TextractOCRClient()
    elif provider == "vision":
        from .ocr_vision import VisionPassThroughOCRClient
        return VisionPassThroughOCRClient()
    else:
        raise ValueError(f"Unknown OCR_PROVIDER: {provider}")

def get_extraction_client() -> ExtractionInterface:
    provider = os.getenv("LLM_PROVIDER", "mock")
    
    if provider == "mock":
        from .extraction_mock import MockExtractionClient
        return MockExtractionClient()
    elif provider == "openrouter":
        from .extraction_openrouter import OpenRouterExtractionClient
        return OpenRouterExtractionClient()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")

def get_bill_extraction_client():
    from .bill_extraction_interface import BillExtractionInterface  # noqa: F401
    provider = os.getenv("LLM_PROVIDER", "mock")

    if provider == "mock":
        from .bill_extraction_mock import MockBillExtractionClient
        return MockBillExtractionClient()
    elif provider == "openrouter":
        from .bill_extraction_openrouter import OpenRouterBillExtractionClient
        return OpenRouterBillExtractionClient()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")

def get_matching_client() -> MatchingInterface:
    # We currently only have one implementation for matching (fuzzy string matching)
    from .matching_fuzzy import FuzzyMatchingClient
    return FuzzyMatchingClient(threshold=80.0)
