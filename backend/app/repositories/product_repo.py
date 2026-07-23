from typing import Optional, Sequence
import uuid
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from app.repositories.base import BaseRepository
from app.models.product import Product, ProductStatus

class ProductRepository(BaseRepository[Product]):
    def __init__(self, db_session, business_id: uuid.UUID):
        super().__init__(Product, db_session, business_id)

    async def get_by_id(self, id: uuid.UUID) -> Optional[Product]:
        stmt = select(self.model).options(selectinload(self.model.barcodes)).where(
            self.model.id == id,
            self.model.business_id == self.business_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> Sequence[Product]:
        stmt = select(self.model).options(selectinload(self.model.barcodes)).where(
            self.model.business_id == self.business_id,
            self.model.status != ProductStatus.INACTIVE
        ).order_by(self.model.name).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def count_all(self, search: Optional[str] = None) -> int:
        stmt = select(func.count()).select_from(self.model).where(
            self.model.business_id == self.business_id,
            self.model.status != ProductStatus.INACTIVE
        )
        if search:
            stmt = stmt.where(self.model.name.ilike(f"%{search}%"))
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def create(self, obj_in: dict) -> Product:
        obj = await super().create(obj_in)
        # Refetch with selectinload to prevent MissingGreenlet during serialization
        return await self.get_by_id(obj.id)

    async def update(self, db_obj: Product, obj_in: dict) -> Product:
        obj = await super().update(db_obj, obj_in)
        # Eagerly load relationship if not loaded
        if "barcodes" not in db_obj.__dict__:
            return await self.get_by_id(db_obj.id)
        return obj


    async def get_by_scm_code(self, scm_code: str) -> Optional[Product]:
        stmt = select(self.model).options(selectinload(self.model.barcodes)).where(
            self.model.business_id == self.business_id,
            or_(
                self.model.scm_code == scm_code,
                self.model.additional_scm_codes.any(scm_code)
            ),
            self.model.status != ProductStatus.INACTIVE
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def search_by_name(self, query: str, skip: int = 0, limit: int = 20) -> Sequence[Product]:
        stmt = select(self.model).options(selectinload(self.model.barcodes)).where(
            self.model.business_id == self.business_id,
            self.model.name.ilike(f"%{query}%"),
            self.model.status != ProductStatus.INACTIVE
        ).order_by(self.model.name).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def deactivate(self, product_id: uuid.UUID) -> Optional[Product]:
        product = await self.get_by_id(product_id)
        if product:
            product.status = ProductStatus.INACTIVE
            self.db.add(product)
            await self.db.flush()
        return product
