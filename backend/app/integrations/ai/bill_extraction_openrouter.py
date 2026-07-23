import base64
import contextlib
import json
import os
from datetime import datetime

from openai import AsyncOpenAI

from app.integrations.ai.bill_extraction_interface import (
    BillChargeItem,
    BillExtractionInterface,
    BillExtractionResult,
)


def _to_float(value, default=None):
    if value is None:
        return default
    try:
        if isinstance(value, str):
            value = value.replace(",", "").replace("₹", "").strip()
        return float(value)
    except (ValueError, TypeError):
        return default

class OpenRouterBillExtractionClient(BillExtractionInterface):
    def __init__(self):
        # OpenRouter uses the OpenAI client library
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )

        prompt_path = os.path.join(os.path.dirname(__file__), 'prompts', 'bill_extraction.txt')
        with open(prompt_path) as f:
            self.system_prompt = f.read()

    async def extract_structured(self, raw_text: str) -> BillExtractionResult:
        model_name = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o")

        # Vision pass-through: raw_text is an image path, not OCR text
        is_vision = raw_text.startswith("/uploads/") or any(raw_text.endswith(ext) for ext in [".jpeg", ".jpg", ".png", ".webp"])

        messages = [{"role": "system", "content": self.system_prompt}]

        if is_vision:
            local_path = raw_text.lstrip("/")
            if not os.path.exists(local_path):
                if os.path.exists(f"backend/{local_path}"):
                    local_path = f"backend/{local_path}"
                elif os.path.exists(f"/app/{local_path}"):
                    local_path = f"/app/{local_path}"

            with open(local_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')

            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract the financial totals from this Indian liquor purchase bill image:"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            })
        else:
            messages.append({"role": "user", "content": f"Extract the financial totals from this Indian liquor purchase bill:\n\n{raw_text}"})

        response = await self.client.chat.completions.create(
            model=model_name,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.0
        )

        result_json_str = response.choices[0].message.content
        if not result_json_str:
            raise ValueError("LLM returned an empty response")

        data = json.loads(result_json_str)

        bill_date = None
        if data.get("bill_date"):
            with contextlib.suppress(ValueError):
                bill_date = datetime.strptime(data["bill_date"], "%Y-%m-%d").date()

        charges = []
        for c in data.get("charges") or []:
            amount = _to_float(c.get("amount"), default=0.0)
            label = str(c.get("label") or "Charge")
            if amount:
                charges.append(BillChargeItem(label=label, amount=amount))

        return BillExtractionResult(
            bill_number=data.get("bill_number"),
            vendor_name=data.get("vendor_name") or "Unknown",
            bill_date=bill_date,
            subtotal=_to_float(data.get("subtotal")),
            discount_amount=_to_float(data.get("discount_amount"), default=0.0) or 0.0,
            charges=charges,
            total_amount=_to_float(data.get("total_amount")),
        )
