from app.extensions import db
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Enum as SAEnum
from typing import TYPE_CHECKING, List
from app.models.mixins import UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoPedido, EstadoSeguimiento # Cambiado a EstadoSeguimiento

if TYPE_CHECKING:
    from app.models.domains.user_models import Usuarios
    from app.models.domains.product_models import Productos

class Pedido(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'pedidos'
 
    usuario_id: Mapped[str] = mapped_column(ForeignKey('usuarios.id'), nullable=False)
    total: Mapped[float] = mapped_column(db.Float, nullable=False)
    estado_pedido: Mapped[EstadoPedido] = mapped_column(
        SAEnum(EstadoPedido, name='estado_pedido_enum', native_enum=True),
        nullable=False, default=EstadoPedido.EN_PROCESO
    )
    seguimiento_estado: Mapped[EstadoSeguimiento] = mapped_column(
        SAEnum(EstadoSeguimiento, name='seguimiento_estado_enum', native_enum=True),
        nullable=False, default=EstadoSeguimiento.RECIBIDO
    )
    seguimiento_historial = db.Column(db.JSON, nullable=True)
    notas_seguimiento: Mapped[str] = mapped_column(db.Text, nullable=True)

    usuario: Mapped["Usuarios"] = relationship(back_populates='pedidos')
    productos: Mapped[List["PedidoProducto"]] = relationship(back_populates='pedido', cascade="all, delete-orphan")

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
