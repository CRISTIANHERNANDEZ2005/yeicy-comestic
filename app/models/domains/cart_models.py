# Serializadores
from app.models.serializers import cart_session_to_dict, cart_item_to_dict
from app.extensions import db
from datetime import datetime
import uuid
from app.models.mixins import TimestampMixin
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.domains.product_models import Productos
    from app.models.domains.user_models import Usuarios

class CartSession(TimestampMixin,db.Model):
    """Modelo para usuarios no autenticados"""
    __tablename__ = 'cart_sessions'

    id: Mapped[str] = mapped_column(db.String(36), primary_key=True)  # UUID de sesión
    expires_at: Mapped[Optional[datetime]] = mapped_column(db.DateTime)
    items: Mapped[Optional[str]] = mapped_column(db.Text)  # JSON de items

    def __repr__(self):
        return f'<CartSession {self.id}>'


class CartItem(db.Model):
    """Modelo para usuarios autenticados"""
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
        return self.product.precio * self.quantity

    def __init__(self, user_id=None, session_id=None, product_id=None, quantity=1, id=None):
        self.user_id = user_id
        self.session_id = session_id
        self.product_id = product_id
        self.quantity = quantity
        if id:
            self.id = id

