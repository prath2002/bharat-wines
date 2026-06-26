import uuid
from typing import TypeVar, Generic, Type, Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.base import TenantModel

ModelType = TypeVar("ModelType", bound=TenantModel)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db_session: AsyncSession, business_id: uuid.UUID):
        self.model = model
        self.db = db_session
        self.business_id = business_id

    async def get_by_id(self, id: uuid.UUID) -> Optional[ModelType]:
        stmt = select(self.model).where(
            self.model.id == id,
            self.model.business_id == self.business_id
        )
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.where(self.model.is_deleted == False)
        
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> Sequence[ModelType]:
        stmt = select(self.model).where(
            self.model.business_id == self.business_id
        )
        if hasattr(self.model, "is_deleted"):
            stmt = stmt.where(self.model.is_deleted == False)
            
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create(self, obj_in: dict) -> ModelType:
        obj_in["business_id"] = self.business_id
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def update(self, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def soft_delete(self, db_obj: ModelType) -> ModelType:
        if hasattr(db_obj, "is_deleted"):
            db_obj.is_deleted = True
            import datetime
            db_obj.deleted_at = datetime.datetime.now(datetime.timezone.utc)
            self.db.add(db_obj)
            await self.db.flush()
        return db_obj
