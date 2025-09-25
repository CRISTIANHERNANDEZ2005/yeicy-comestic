"""
Módulo de Mixins para Modelos de SQLAlchemy.

Este archivo proporciona clases `Mixin` reutilizables que añaden funcionalidades comunes
a los modelos de la base de datos. El uso de mixins ayuda a mantener el código DRY (Don't Repeat Yourself),
promoviendo la consistencia y facilitando el mantenimiento.
"""
# --- Importaciones de Extensiones y Terceros ---
from sqlalchemy import CheckConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
# --- Importaciones de la Librería Estándar ---
from datetime import datetime
import uuid
# --- Importaciones Locales de la Aplicación ---
from app.models.enums import EstadoEnum
from app.extensions import db

class EstadoActivoInactivoMixin:
    """
    Mixin que añade una columna `estado` a un modelo.

    Esta columna utiliza `EstadoEnum` para restringir sus valores a 'activo' o 'inactivo',
    con 'activo' como valor por defecto. Es ideal para modelos que requieren
    una funcionalidad de activación/desactivación (soft delete).
    """
    estado: Mapped[EstadoEnum] = mapped_column(SAEnum(EstadoEnum, name='estado_enum', native_enum=True), nullable=False, default=EstadoEnum.ACTIVO)

class TimestampMixin(object):
    """
    Mixin que añade columnas de timestamp automáticas.

    - `created_at`: Se establece en la fecha y hora de creación del registro.
    - `updated_at`: Se actualiza automáticamente cada vez que el registro es modificado.
    """
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UUIDPrimaryKeyMixin(object):
    """
    Mixin que establece una clave primaria basada en UUID.

    Reemplaza la clave primaria entera por defecto con un `UUID v4` de tipo string.
    Esto es beneficioso para la seguridad (evita la enumeración de recursos) y para
    sistemas distribuidos.
    """
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()), unique=True, nullable=False)
