import os
import base64
import json
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load the API keys from .env
load_dotenv(".env")

async def verify_image(image_path: str):
    print(f"Verifying image: {image_path}")
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("Error: OPENROUTER_API_KEY is not set in .env")
        return

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )

    # Base64 encode the image
    with open(image_path, "rb") as image_file:
        base64_image = base64.b64encode(image_file.read()).decode('utf-8')

    # Load the extraction prompt
    prompt_path = os.path.join('backend', 'app', 'integrations', 'ai', 'prompts', 'tp_extraction.txt')
    with open(prompt_path, 'r') as f:
        system_prompt = f.read()

    print(f"\nSending image to {os.getenv('OPENROUTER_MODEL', 'openai/gpt-4o')} via OpenRouter...")
    try:
        response = await client.chat.completions.create(
            model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4o"),
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract the data from this Indian liquor Transport Permit image:"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            response_format={ "type": "json_object" },
            temperature=0.0
        )
        
        result_json_str = response.choices[0].message.content
        data = json.loads(result_json_str)
        print("\n✅ Verification Successful! Here is the extracted data:\n")
        print(json.dumps(data, indent=2))
        
    except Exception as e:
        print(f"\n❌ Failed to verify: {e}")

if __name__ == "__main__":
    import sys
    import glob
    
    # Get image path from arguments or default
    if len(sys.argv) > 1:
        IMAGE_PATH = sys.argv[1]
    else:
        # Find the most recently uploaded image
        upload_files = glob.glob("backend/uploads/*.jpeg")
        if not upload_files:
            print("No uploaded files found in backend/uploads/")
            exit()
        IMAGE_PATH = max(upload_files, key=os.path.getctime)
        
    asyncio.run(verify_image(IMAGE_PATH))
