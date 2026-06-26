from typing import Optional, Sequence
import uuid
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.repositories.base import BaseRepository
from app.models.tp_receipt import TPReceipt, TPStatus

class TPRepository(BaseRepository[TPReceipt]):
    def __init__(self, db_session, business_id: uuid.UUID):
        super().__init__(TPReceipt, db_session, business_id)

    async def get_by_id_with_lines(self, id: uuid.UUID) -> Optional[TPReceipt]:
        stmt = select(self.model).options(
            selectinload(self.model.lines)
        ).where(
            self.model.business_id == self.business_id,
            self.model.id == id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def check_duplicate_tp_number(self, tp_number: str) -> bool:
        stmt = select(self.model.id).where(
            self.model.business_id == self.business_id,
            self.model.tp_number == tp_number
        )
        result = await self.db.execute(stmt)
        return result.first() is not None

    async def update_status(self, id: uuid.UUID, status: TPStatus) -> Optional[TPReceipt]:
        receipt = await self.get_by_id(id)
        if receipt:
            receipt.status = status
            self.db.add(receipt)
            await self.db.flush()
        return receipt

    async def get_drafts(self) -> Sequence[TPReceipt]:
        stmt = select(self.model).where(
            self.model.business_id == self.business_id,
            self.model.status == TPStatus.DRAFT
        ).order_by(desc(self.model.created_at))
        result = await self.db.execute(stmt)
        return result.scalars().all()
