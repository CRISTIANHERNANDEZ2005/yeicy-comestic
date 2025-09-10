from app.extensions import db
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Enum as SAEnum
from typing import TYPE_CHECKING, List
from app.models.mixins import UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoPedido

if TYPE_CHECKING:
    from app.models.domains.user_models import Usuarios
    from app.models.domains.product_models import Productos

class Pedido(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'pedidos'

    usuario_id: Mapped[str] = mapped_column(ForeignKey('usuarios.id'), nullable=False)
    total: Mapped[float] = mapped_column(db.Float, nullable=False)
    estado_pedido: Mapped[str] = mapped_column(SAEnum(EstadoPedido, name='estado_pedido_enum'), nullable=False, default=EstadoPedido.EN_PROCESO.value)

    usuario: Mapped["Usuarios"] = relationship(back_populates='pedidos')
    productos: Mapped[List["PedidoProducto"]] = relationship(back_populates='pedido', cascade="all, delete-orphan")

    def __init__(self, usuario_id, total, estado_pedido=EstadoPedido.EN_PROCESO, estado='activo'):
        self.usuario_id = usuario_id
        self.total = total
        self.estado_pedido = estado_pedido
        self.estado = estado

class PedidoProducto(db.Model):
    __tablename__ = 'pedido_productos'

    pedido_id: Mapped[str] = mapped_column(ForeignKey('pedidos.id'), primary_key=True)
    producto_id: Mapped[str] = mapped_column(ForeignKey('productos.id'), primary_key=True)
    cantidad: Mapped[int] = mapped_column(db.Integer, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(db.Float, nullable=False)

    pedido: Mapped["Pedido"] = relationship(back_populates='productos')
    producto: Mapped["Productos"] = relationship(back_populates='pedidos')

    def __init__(self, pedido_id, producto_id, cantidad, precio_unitario):
        self.pedido_id = pedido_id
        self.producto_id = producto_id
        self.cantidad = cantidad
        self.precio_unitario = precio_unitario
