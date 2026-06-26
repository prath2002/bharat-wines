from app.integrations.ai.ocr_interface import OCRInterface, OCRResult

class VisionPassThroughOCRClient(OCRInterface):
    async def extract_text(self, file_path_or_url: str) -> OCRResult:
        # Pass the file path straight through to the LLM
        return OCRResult(
            raw_text=file_path_or_url,
            confidence=1.0,
            provider_metadata={"provider": "VisionPassThrough"}
        )
