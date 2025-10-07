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
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum, func
# --- Importaciones Locales de la Aplicación ---
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, Optional, List
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


# En review_models.py

class Reseñas(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """
    Representa una reseña (review) escrita por un usuario para un producto.
    """
    __tablename__ = 'reseñas'

    # Campos existentes
    usuario_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('usuarios.id'), nullable=False)
    producto_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('productos.id'), nullable=False)
    texto: Mapped[str] = mapped_column(db.String(1000), nullable=False)
    calificacion: Mapped[int] = mapped_column(db.Integer, nullable=False)
    titulo: Mapped[Optional[str]] = mapped_column(db.String(100), nullable=True)
    
    # Campos mejorados
    visitas: Mapped[int] = mapped_column(db.Integer, default=0, nullable=False, server_default='0')     # Contador de visitas
    votos_utiles_count: Mapped[int] = mapped_column(db.Integer, default=0, server_default='0')
    
    # Relaciones existentes
    usuario: Mapped['Usuarios'] = relationship('Usuarios', back_populates='reseñas')
    producto: Mapped['Productos'] = relationship('Productos', back_populates='reseñas')

    # Restricciones e índices existentes
    __table_args__ = (
        CheckConstraint("calificacion >= 1 AND calificacion <= 5", name='check_calificacion_rango'),
        UniqueConstraint('usuario_id', 'producto_id', name='unique_usuario_producto_reseña'),
        db.Index('idx_reseña_usuario_id', 'usuario_id'),
        db.Index('idx_reseña_producto_id', 'producto_id'),
        db.Index('idx_reseña_votos_utiles_count', 'votos_utiles_count'),
    )
    votos: Mapped[List["ReseñaVoto"]] = relationship(back_populates='reseña', cascade="all, delete-orphan")

    def __init__(self, usuario_id, producto_id, texto, calificacion, titulo=None, id=None):
        # Implementación existente
        if not usuario_id:
            raise ValueError("Debe indicar el usuario")
        if not producto_id:
            raise ValueError("Debe indicar el producto")
        self.usuario_id = usuario_id
        self.producto_id = producto_id
        self.texto = str(TextoResena(texto))
        self.calificacion = int(Calificacion(calificacion))
        self.titulo = titulo
        if id:
            self.id = id
        self.visitas = 0

    def incrementar_visitas(self):
        """Incrementa el contador de visitas de la reseña."""
        # MEJORA PROFESIONAL: Usar una expresión F para una actualización atómica.
        # Esto evita condiciones de carrera y es la forma idiomática de SQLAlchemy.
        db.session.query(Reseñas).filter_by(id=self.id).update({'visitas': Reseñas.visitas + 1})
        db.session.commit()

    def actualizar_votos_count(self):
        """Actualiza el contador de votos útiles y lo guarda en la BD."""
        #  Actualización atómica y eficiente del contador.
        # En lugar de cargar todos los votos en memoria con `len(self.votos)`,
        # se realiza una subconsulta que cuenta los votos directamente en la base de datos.
        # Esto es mucho más performante, especialmente si una reseña tiene muchos votos.
        votos_count_subquery = db.session.query(func.count(ReseñaVoto.id)).filter(ReseñaVoto.reseña_id == self.id).scalar_subquery()
        db.session.query(Reseñas).filter_by(id=self.id).update(
            {'votos_utiles_count': votos_count_subquery}, synchronize_session=False
        )
        db.session.commit()

class ReseñaVoto(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    """
    Representa un voto (like) que un usuario da a una reseña.
    """
    __tablename__ = 'reseña_votos'

    usuario_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('usuarios.id'), nullable=False)
    reseña_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('reseñas.id'), nullable=False)

    usuario: Mapped['Usuarios'] = relationship()
    reseña: Mapped['Reseñas'] = relationship(back_populates='votos')

    __table_args__ = (
        UniqueConstraint('usuario_id', 'reseña_id', name='uq_usuario_reseña_voto'),
        db.Index('idx_reseña_voto_usuario_id', 'usuario_id'),
        db.Index('idx_reseña_voto_reseña_id', 'reseña_id'),
    )

    def __init__(self, usuario_id, reseña_id):
        if not usuario_id or not reseña_id:
            raise ValueError("usuario_id y reseña_id son requeridos.")
        self.usuario_id = usuario_id
        self.reseña_id = reseña_id