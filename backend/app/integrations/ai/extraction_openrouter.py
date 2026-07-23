import os
import json
from datetime import datetime
from openai import AsyncOpenAI
from app.integrations.ai.extraction_interface import ExtractionInterface, TPExtractionResult, TPProductItem

class OpenRouterExtractionClient(ExtractionInterface):
    def __init__(self):
        # OpenRouter uses the OpenAI client library
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        
        # Load the system prompt
        prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'tp_extraction.txt')
        with open(prompt_path, 'r') as f:
            self.system_prompt = f.read()

    async def extract_structured(self, raw_text: str) -> TPExtractionResult:
        model_name = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")
        
        try:
            # Check if this is a vision pass-through (starts with /uploads/ or ends in image extension)
            is_vision = raw_text.startswith("/uploads/") or any(raw_text.endswith(ext) for ext in [".jpeg", ".jpg", ".png", ".webp"])
            
            messages = [{"role": "system", "content": self.system_prompt}]
            
            if is_vision:
                # Find the local path to the image
                local_path = raw_text.lstrip("/")
                if not os.path.exists(local_path):
                    if os.path.exists(f"backend/{local_path}"):
                        local_path = f"backend/{local_path}"
                    elif os.path.exists(f"/app/{local_path}"):
                        local_path = f"/app/{local_path}"
                        
                import base64
                with open(local_path, "rb") as image_file:
                    base64_image = base64.b64encode(image_file.read()).decode('utf-8')
                    
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract the data from this Indian liquor Transport Permit image:"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                })
            else:
                messages.append({"role": "user", "content": f"Extract the data from this Indian liquor Transport Permit:\n\n{raw_text}"})

            response = await self.client.chat.completions.create(
                model=model_name,
                messages=messages,
                response_format={ "type": "json_object" },
                temperature=0.0 # Keep it deterministic
            )
            
            result_json_str = response.choices[0].message.content
            if not result_json_str:
                raise ValueError("OpenAI returned an empty response")
                
            data = json.loads(result_json_str)
            
            # Parse date safely
            tp_date = None
            if data.get("tp_date"):
                try:
                    tp_date = datetime.strptime(data["tp_date"], "%Y-%m-%d").date()
                except ValueError:
                    pass
            
            products = []
            for p in data.get("products", []):
                products.append(TPProductItem(
                    name=p.get("name", "Unknown"),
                    scm_code=p.get("scm_code"),
                    size=p.get("size"),
                    qty_bottles=p.get("qty_bottles", 0),
                    mrp=float(p.get("mrp", 0.0)),
                    batch_number=p.get("batch_number")
                ))
                
            return TPExtractionResult(
                tp_number=data.get("tp_number", "Unknown"),
                supplier_name=data.get("supplier_name", "Unknown"),
                tp_date=tp_date,
                products=products
            )
            
        except Exception as e:
            print(f"Failed to extract structured data via OpenAI: {e}")
            raise e
