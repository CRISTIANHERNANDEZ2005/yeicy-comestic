# Serializadores
from app.models.serializers import like_to_dict, resena_to_dict
from app.extensions import db
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, Optional
if TYPE_CHECKING:
    from app.models.domains.user_models import Usuarios
    from app.models.domains.product_models import Productos

class TextoResena:
    """Value object para validar el texto de la reseña."""
    def __init__(self, texto: str):
        if not texto or not texto.strip():
            raise ValueError("El texto de la reseña no puede estar vacío")
        self.value = texto.strip()
    def __str__(self):
        return self.value

class Calificacion:
    """Value object para validar la calificación de la reseña."""
    def __init__(self, calificacion: int):
        if not (1 <= calificacion <= 5):
            raise ValueError("La calificación debe estar entre 1 y 5")
        self.value = calificacion
    def __int__(self):
        return self.value

class Likes(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'likes'

    # id y timestamps heredados de los mixins
    usuario_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('usuarios.id'), nullable=False)
    producto_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('productos.id'), nullable=False)
    # estado ya está en el mixin
    usuario: Mapped['Usuarios'] = relationship('Usuarios', back_populates='likes')
    producto: Mapped['Productos'] = relationship('Productos', back_populates='likes')

    # Restricciones e índices
    __table_args__ = (
        UniqueConstraint('usuario_id', 'producto_id',
                         name='unique_usuario_producto_like'),
        db.Index('idx_like_usuario_id', 'usuario_id'),
        db.Index('idx_like_producto_id', 'producto_id'),
    )

    def __init__(self, usuario_id, producto_id, estado='activo', id=None):
        if not usuario_id:
            raise ValueError("Debe indicar el usuario")
        if not producto_id:
            raise ValueError("Debe indicar el producto")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.usuario_id = usuario_id
        self.producto_id = producto_id
        self.estado = estado
        if id:
            self.id = id



class Reseñas(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = 'reseñas'

    # id y timestamps heredados de los mixins
    usuario_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('usuarios.id'), nullable=False)
    producto_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('productos.id'), nullable=False)
    texto: Mapped[str] = mapped_column(db.String(1000), nullable=False)
    calificacion: Mapped[int] = mapped_column(db.Integer, nullable=False)
    titulo: Mapped[Optional[str]] = mapped_column(db.String(100), nullable=True) # Added this line
    # estado ya está en el mixin
    usuario: Mapped['Usuarios'] = relationship('Usuarios', back_populates='reseñas')
    producto: Mapped['Productos'] = relationship('Productos', back_populates='reseñas')

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("calificacion >= 1 AND calificacion <= 5",
                        name='check_calificacion_rango'),
        UniqueConstraint('usuario_id', 'producto_id',
                         name='unique_usuario_producto_reseña'),
        db.Index('idx_reseña_usuario_id', 'usuario_id'),
        db.Index('idx_reseña_producto_id', 'producto_id'),
    )

    def __init__(self, usuario_id, producto_id, texto, calificacion, titulo=None, id=None): # Modified signature
        if not usuario_id:
            raise ValueError("Debe indicar el usuario")
        if not producto_id:
            raise ValueError("Debe indicar el producto")
        self.usuario_id = usuario_id
        self.producto_id = producto_id
        self.texto = str(TextoResena(texto))
        self.calificacion = int(Calificacion(calificacion))
        self.titulo = titulo # Added this line
        if id:
            self.id = id

