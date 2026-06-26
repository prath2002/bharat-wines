from typing import Optional, Sequence
import uuid
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from app.repositories.base import BaseRepository
from app.models.barcode import Barcode
from app.models.product import Product

class BarcodeRepository(BaseRepository[Barcode]):
    def __init__(self, db_session, business_id: uuid.UUID):
        super().__init__(Barcode, db_session, business_id)

    async def lookup(self, barcode_value: str) -> Optional[Product]:
        stmt = select(Product).options(selectinload(Product.barcodes)).join(Barcode).where(
            Barcode.business_id == self.business_id,
            Barcode.barcode_value == barcode_value,
            Barcode.is_active == True
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_product(self, product_id: uuid.UUID) -> Sequence[Barcode]:
        stmt = select(self.model).where(
            self.model.business_id == self.business_id,
            self.model.product_id == product_id,
            self.model.is_active == True
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def deactivate(self, barcode_id: uuid.UUID) -> Optional[Barcode]:
        barcode = await self.get_by_id(barcode_id)
        if barcode:
            barcode.is_active = False
            self.db.add(barcode)
            await self.db.flush()
        return barcode
