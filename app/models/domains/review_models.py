"""
Módulo de Modelos de Dominio para Interacciones de Usuario.

Este archivo define las estructuras de datos para las interacciones de los usuarios
con los productos, como `Likes` (favoritos) y `Reseñas` (calificaciones y comentarios).
Incluye `Value Objects` para garantizar la integridad de los datos de las reseñas,
como el texto y la calificación.
"""
# --- Importaciones de Serializadores ---
from app.models.serializers import like_to_dict, resena_to_dict
# --- Importaciones de Extensiones y Terceros ---
from app.extensions import db
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum
# --- Importaciones Locales de la Aplicación ---
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, Optional
if TYPE_CHECKING:
    from app.models.domains.user_models import Usuarios
    from app.models.domains.product_models import Productos

class TextoResena:
    """
    Value Object para encapsular y validar el texto de una reseña.

    Asegura que el texto no esté vacío y elimina espacios en blanco al inicio y al final.
    """
    def __init__(self, texto: str):
        """
        Inicializa el Value Object.

        Args:
            texto (str): El contenido de la reseña.

        Raises:
            ValueError: Si el texto está vacío o solo contiene espacios.
        """
        if not texto or not texto.strip():
            raise ValueError("El texto de la reseña no puede estar vacío")
        self.value = texto.strip()
    def __str__(self):
        return self.value

class Calificacion:
    """
    Value Object para encapsular y validar la calificación de una reseña.

    Asegura que la calificación sea un número entero entre 1 y 5.
    """
    def __init__(self, calificacion: int):
        """
        Inicializa el Value Object.

        Args:
            calificacion (int): La puntuación dada en la reseña.

        Raises:
            ValueError: Si la calificación no está en el rango de 1 a 5.
        """
        if not (1 <= calificacion <= 5):
            raise ValueError("La calificación debe estar entre 1 y 5")
        self.value = calificacion
    def __int__(self):
        return self.value

class Likes(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    """
    Representa un 'me gusta' (like) que un usuario da a un producto.

    Este modelo crea una relación única entre un usuario y un producto para registrar
    la acción de marcar como favorito. Utiliza una eliminación lógica (soft delete)
    a través del `EstadoActivoInactivoMixin`.

    Attributes:
        usuario_id (str): Clave foránea que vincula al usuario que dio el 'like'.
        producto_id (str): Clave foránea que vincula al producto que recibió el 'like'.
        usuario (Usuarios): Relación con el modelo `Usuarios`.
        producto (Productos): Relación con el modelo `Productos`.
    """
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
        """
        Inicializa una nueva instancia de Like.

        Args:
            usuario_id (str): El ID del usuario.
            producto_id (str): El ID del producto.
            estado (str): El estado inicial ('activo' o 'inactivo').
            id (Optional[str]): Un ID predefinido, si es necesario.

        Raises:
            ValueError: Si `usuario_id`, `producto_id` o `estado` son inválidos.
        """
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
    """
    Representa una reseña (review) escrita por un usuario para un producto.

    Este modelo almacena el contenido textual, la calificación y el título de una reseña.
    Establece una restricción única para que un usuario solo pueda escribir una reseña
    por producto.

    Attributes:
        usuario_id (str): Clave foránea que vincula al usuario que escribió la reseña.
        producto_id (str): Clave foránea que vincula al producto reseñado.
        texto (str): El contenido principal de la reseña.
        calificacion (int): La puntuación numérica (1-5) de la reseña.
        titulo (Optional[str]): Un título opcional para la reseña.
        usuario (Usuarios): Relación con el modelo `Usuarios`.
        producto (Productos): Relación con el modelo `Productos`.
    """
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
        """
        Inicializa una nueva instancia de Reseña.

        Args:
            usuario_id (str): El ID del usuario.
            producto_id (str): El ID del producto.
            texto (str): El contenido de la reseña.
            calificacion (int): La calificación (1-5).
            titulo (Optional[str]): El título de la reseña.
            id (Optional[str]): Un ID predefinido, si es necesario.

        Raises:
            ValueError: Si `usuario_id`, `producto_id`, `texto` o `calificacion` son inválidos.
        """
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
