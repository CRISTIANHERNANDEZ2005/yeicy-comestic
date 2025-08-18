from sqlalchemy import CheckConstraint, Enum as SAEnum
from app.models.enums import EstadoEnum
from app.extensions import db
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid

class EstadoActivoInactivoMixin:
    estado: Mapped[str] = mapped_column(SAEnum(EstadoEnum, name='estado_enum'), nullable=False, default=EstadoEnum.ACTIVO.value)

    @classmethod
    def __declare_last__(cls):
        tablename = getattr(cls, "__tablename__", None)
        if not tablename:
            return
        if not hasattr(cls, '__table_args__') or cls.__table_args__ is None:
            cls.__table_args__ = ()
        constraint = CheckConstraint("estado IN ('activo', 'inactivo')", name=f'check_estado_{tablename}')
        if constraint not in cls.__table_args__:
            cls.__table_args__ += (constraint,)

class TimestampMixin(object):
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UUIDPrimaryKeyMixin(object):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()), unique=True, nullable=False)
