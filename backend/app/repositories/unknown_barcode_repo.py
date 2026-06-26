import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from app.models.unknown_barcode import UnknownBarcode, UnknownBarcodeStatus
from app.repositories.base import BaseRepository

class UnknownBarcodeRepository(BaseRepository[UnknownBarcode]):
    def __init__(self, db: AsyncSession, business_id: uuid.UUID):
        super().__init__(UnknownBarcode, db, business_id)
        
    async def get_pending(self, skip: int = 0, limit: int = 100) -> List[UnknownBarcode]:
        stmt = select(UnknownBarcode).where(
            UnknownBarcode.business_id == self.business_id,
            UnknownBarcode.status == UnknownBarcodeStatus.PENDING
        ).order_by(desc(UnknownBarcode.scanned_at)).offset(skip).limit(limit)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_value(self, barcode_value: str) -> Optional[UnknownBarcode]:
        stmt = select(UnknownBarcode).where(
            UnknownBarcode.business_id == self.business_id,
            UnknownBarcode.barcode_value == barcode_value
        ).order_by(desc(UnknownBarcode.scanned_at))
        
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def log_unknown(self, barcode_value: str, user_id: uuid.UUID) -> UnknownBarcode:
        # Check if already pending so we don't spam
        existing = await self.get_by_value(barcode_value)
        if existing and existing.status == UnknownBarcodeStatus.PENDING:
            # Update scanned_at to now
            from datetime import datetime, timezone
            existing.scanned_at = datetime.now(timezone.utc)
            existing.scanned_by = user_id
            await self.db.commit()
            return existing
            
        record = UnknownBarcode(
            business_id=self.business_id,
            barcode_value=barcode_value,
            scanned_by=user_id,
            status=UnknownBarcodeStatus.PENDING
        )
        self.db.add(record)
        # We don't commit here usually to let the caller handle transactions, but in this case the caller is a GET request
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def mark_mapped(self, id: uuid.UUID, product_id: uuid.UUID) -> Optional[UnknownBarcode]:
        record = await self.get_by_id(id)
        if record:
            record.status = UnknownBarcodeStatus.MAPPED
            record.mapped_product_id = product_id
            await self.db.flush()
        return record

    async def mark_ignored(self, id: uuid.UUID) -> Optional[UnknownBarcode]:
        record = await self.get_by_id(id)
        if record:
            record.status = UnknownBarcodeStatus.IGNORED
            await self.db.flush()
        return record
