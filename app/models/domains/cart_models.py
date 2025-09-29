"""
Módulo de Modelos de Dominio para el Carrito de Compras.

Este archivo define la estructura de datos para los elementos del carrito de compras.
El modelo `CartItem` es central para gestionar los productos que un usuario,
ya sea autenticado o anónimo, ha añadido a su carrito.
"""
# --- Importaciones de Serializadores ---
from app.models.serializers import cart_item_to_dict
# --- Importaciones de Extensiones y Terceros ---
from app.extensions import db
# --- Importaciones de la Librería Estándar ---
from datetime import datetime
import uuid
# --- Importaciones Locales de la Aplicación ---
from app.models.mixins import TimestampMixin
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.domains.product_models import Productos
    from app.models.domains.user_models import Usuarios

class CartItem(db.Model, TimestampMixin):
    """
    Representa un artículo individual dentro de un carrito de compras.

    Este modelo está diseñado para ser flexible, permitiendo asociar un artículo de carrito
    tanto a un usuario autenticado (a través de `user_id`) como a un visitante anónimo
    (a través de `session_id`). Esto facilita la persistencia del carrito entre sesiones
    y la fusión de carritos cuando un usuario inicia sesión.

    Attributes:
        id (str): Identificador único para el artículo del carrito.
        user_id (Optional[str]): Clave foránea que vincula al usuario (`usuarios.id`). Nulo para visitantes.
        session_id (Optional[str]): Identificador de sesión para carritos de visitantes.
        product_id (Optional[str]): Clave foránea que vincula al producto (`productos.id`).
        quantity (int): Cantidad del producto en el carrito.
        product (Productos): Relación con el modelo `Productos`.
        user (Optional[Usuarios]): Relación con el modelo `Usuarios`.
    """
    __tablename__ = 'cart_items'

    id: Mapped[str] = mapped_column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()), unique=True, nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(db.String(36), db.ForeignKey('usuarios.id'), nullable=True)
    session_id: Mapped[Optional[str]] = mapped_column(db.String(36), nullable=True)
    product_id: Mapped[Optional[str]] = mapped_column(db.String(36), db.ForeignKey('productos.id'), nullable=True)
    quantity: Mapped[int] = mapped_column(db.Integer, default=1)

    # Relaciones
    product: Mapped['Productos'] = relationship('Productos', backref='cart_items')
    user: Mapped[Optional['Usuarios']] = relationship('Usuarios', backref='cart_items')

    __table_args__ = (
        db.Index('idx_user_product', 'user_id', 'product_id'),
        db.Index('idx_session_product', 'session_id', 'product_id'),
    )

    @property
    def subtotal(self):
        """
        Calcula el subtotal para este artículo del carrito.

        Returns:
            float: El precio del producto multiplicado por la cantidad.
        """
        return self.product.precio * self.quantity

    def to_dict(self):
        """
        Convierte la instancia del artículo del carrito a un diccionario serializable.

        Returns:
            dict: Una representación en diccionario del artículo del carrito.
        """
        return cart_item_to_dict(self)

    def __init__(self, user_id=None, session_id=None, product_id=None, quantity=1, id=None):
        """
        Inicializa una nueva instancia de CartItem.

        Args:
            user_id (Optional[str]): El ID del usuario si está autenticado.
            session_id (Optional[str]): El ID de la sesión para usuarios anónimos.
            product_id (Optional[str]): El ID del producto a añadir.
            quantity (int): La cantidad inicial del producto.
            id (Optional[str]): Un ID predefinido, si es necesario.
        """
        self.user_id = user_id
        self.session_id = session_id
        self.product_id = product_id
        self.quantity = quantity
        if id:
            self.id = id
