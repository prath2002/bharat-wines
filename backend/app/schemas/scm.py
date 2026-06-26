from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.models.product import ProductCategory

class SCMRecord(BaseModel):
    scm_code: str
    product_name: str
    category: ProductCategory
    size_ml: int
    opening: int
    purchases: int
    sales: int
    returns: int
    damage: int
    closing: int
    
    class Config:
        from_attributes = True

class SCMReportResponse(BaseModel):
    start_date: date
    end_date: date
    records: List[SCMRecord]
