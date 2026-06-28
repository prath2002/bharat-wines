from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
import uuid
from datetime import datetime
from app.models.product import ProductCategory, ProductStatus
from app.models.barcode import BarcodeFormat

class BarcodeBase(BaseModel):
    barcode_value: str
    barcode_format: BarcodeFormat = BarcodeFormat.EAN13

class BarcodeCreate(BarcodeBase):
    pass

class BarcodeResponse(BarcodeBase):
    id: uuid.UUID
    product_id: uuid.UUID
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    category: ProductCategory
    size_ml: int = Field(..., gt=0)
    mrp: float = Field(..., gt=0)
    scm_code: str = Field(..., max_length=50)
    additional_scm_codes: List[str] = Field(default_factory=list)
    purchase_price: float = Field(..., gt=0)
    case_size: Optional[int] = Field(None, gt=0)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    category: Optional[ProductCategory] = None
    size_ml: Optional[int] = Field(None, gt=0)
    additional_scm_codes: Optional[List[str]] = None
    purchase_price: Optional[float] = Field(None, gt=0)
    status: Optional[ProductStatus] = None
    case_size: Optional[int] = Field(None, gt=0)

class ProductResponse(ProductBase):
    id: uuid.UUID
    business_id: uuid.UUID
    status: ProductStatus
    created_at: datetime
    updated_at: datetime
    current_stock: Optional[int] = None
    barcodes: Optional[List[BarcodeResponse]] = None

    model_config = ConfigDict(from_attributes=True)

class ProductListResponse(BaseModel):
    data: List[ProductResponse]
    total: int
    has_more: bool
