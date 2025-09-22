from sqlalchemy import CheckConstraint, Enum as SAEnum
from app.models.enums import EstadoEnum
from app.extensions import db
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid

class EstadoActivoInactivoMixin:
    estado: Mapped[EstadoEnum] = mapped_column(SAEnum(EstadoEnum, name='estado_enum', native_enum=True), nullable=False, default=EstadoEnum.ACTIVO)

class TimestampMixin(object):
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UUIDPrimaryKeyMixin(object):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()), unique=True, nullable=False)
