import boto3
import urllib.request
from botocore.exceptions import ClientError
from app.integrations.ai.ocr_interface import OCRInterface, OCRResult

class TextractOCRClient(OCRInterface):
    def __init__(self, region_name="us-east-1"):
        # Boto3 will automatically look for AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in env
        self.textract = boto3.client('textract', region_name=region_name)

    async def extract_text(self, file_path_or_url: str) -> OCRResult:
        try:
            if file_path_or_url.startswith("http://") or file_path_or_url.startswith("https://"):
                # Download the image from URL
                with urllib.request.urlopen(file_path_or_url) as response:
                    image_bytes = response.read()
            else:
                # Read local file
                with open(file_path_or_url, 'rb') as f:
                    image_bytes = f.read()

            # Call Textract
            response = self.textract.detect_document_text(
                Document={'Bytes': image_bytes}
            )

            # Extract raw text from blocks
            raw_text = ""
            for item in response.get("Blocks", []):
                if item["BlockType"] == "LINE":
                    raw_text += item.get("Text", "") + "\n"

            return OCRResult(
                raw_text=raw_text.strip(),
                confidence=1.0, # Textract doesn't give an overall document confidence easily
                provider_metadata={"provider": "AWS_Textract", "DocumentMetadata": response.get("DocumentMetadata")}
            )

        except ClientError as e:
            # Handle throttle or other boto3 errors here
            print(f"Textract ClientError: {e}")
            raise e
        except Exception as e:
            print(f"Failed to process OCR via Textract: {e}")
            raise e
