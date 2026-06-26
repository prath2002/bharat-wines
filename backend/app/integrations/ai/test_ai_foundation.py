import asyncio
import os
import sys

# Add the backend directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from app.integrations.ai import get_ocr_client, get_extraction_client, get_matching_client
from app.integrations.ai.matching_interface import MatchResult

class MockProduct:
    def __init__(self, id, name):
        self.id = id
        self.name = name

async def run_tests():
    print("=== Testing AI Foundation ===\n")

    # 1. Test Provider Factory and Mock Extraction
    print("1. Testing Provider Setup & Mock Extraction...")
    os.environ["AI_PROVIDER"] = "mock"
    ocr_client = get_ocr_client()
    extraction_client = get_extraction_client()
    
    print(f"Loaded OCR Provider: {type(ocr_client).__name__}")
    print(f"Loaded Extraction Provider: {type(extraction_client).__name__}")
    
    # Simulate OCR extracting text
    ocr_result = await ocr_client.extract_text("fake_image_path.jpg")
    print(f"\nMock OCR Extracted Text snippet: \n{ocr_result.raw_text[:100]}...\n")
    
    # Simulate LLM extracting structured JSON
    extraction_result = await extraction_client.extract_structured(ocr_result.raw_text)
    print("Structured Data Extracted by LLM Mock:")
    print(f"- TP Number: {extraction_result.tp_number}")
    print(f"- Supplier: {extraction_result.supplier_name}")
    print(f"- Found {len(extraction_result.products)} products:")
    for p in extraction_result.products:
        print(f"  * {p.name} | {p.qty_cases} cases | MRP: {p.mrp}")
        
    print("\n-------------------------------------------------\n")

    # 2. Test Fuzzy Matching
    print("2. Testing RapidFuzz Matching Engine...")
    matching_client = get_matching_client()
    
    # Fake catalog from the database
    catalog = [
        MockProduct("uuid-1", "Royal Stag 750ml"),
        MockProduct("uuid-2", "Blenders Pride 375ml"),
        MockProduct("uuid-3", "Mc Dowell No1 750ml")
    ]
    
    extracted_names = [
        "Royal Stag Whisky 750ml",  # Typo/variation
        "Blender's Pride 375",      # Typo/variation
        "Jack Daniels 750ml",       # Not in catalog
        "Mc Dowells No. 1 750ml"    # Typo/variation
    ]
    
    match_results = matching_client.match_products(extracted_names, catalog)
    
    for res in match_results:
        status = "✅ MATCHED" if res.is_matched else "❌ NO MATCH (Manual review needed)"
        matched_name = next((p.name for p in catalog if p.id == res.matched_product_id), "None")
        print(f"Extracted: '{res.extracted_name}'")
        print(f"  -> Best Catalog Match: '{matched_name}'")
        print(f"  -> Confidence: {res.confidence * 100:.1f}% | {status}\n")

    print("\n-------------------------------------------------\n")

    # 3. Test Provider Swap Configuration
    print("3. Testing Provider Swap...")
    os.environ["AI_PROVIDER"] = "openrouter"
    try:
        live_extraction_client = get_extraction_client()
        print(f"Successfully swapped to live LLM provider: {type(live_extraction_client).__name__}")
        print("(Test passed! We won't actually call the live API to save credits.)")
    except Exception as e:
        print(f"Error testing provider swap: {e}")

    print("\n=== AI Foundation Tests Completed ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
