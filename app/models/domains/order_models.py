"""
Módulo de Modelos de Dominio para Pedidos.

Este archivo define las estructuras de datos que representan los pedidos de los clientes.
Incluye el modelo `Pedido`, que almacena la información general de la orden, y
`PedidoProducto`, que actúa como una tabla de asociación para registrar los
productos específicos, cantidades y precios de cada pedido.
"""
# --- Importaciones de Extensiones y Terceros ---
from app.extensions import db
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Enum as SAEnum
# --- Importaciones Locales de la Aplicación ---
from typing import TYPE_CHECKING, List
from app.models.mixins import UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoPedido, EstadoSeguimiento # Cambiado a EstadoSeguimiento

if TYPE_CHECKING:
    from app.models.domains.user_models import Usuarios
    from app.models.domains.product_models import Productos

class Pedido(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    """
    Representa un pedido realizado por un usuario en el sistema.

    Este modelo almacena la información principal de un pedido, incluyendo el cliente,
    el total, el estado general del pedido (ej. 'en proceso', 'completado') y el estado
    detallado del seguimiento logístico (ej. 'recibido', 'en camino').

    Attributes:
        usuario_id (str): Clave foránea que vincula al usuario que realizó el pedido.
        total (float): El monto total del pedido.
        estado_pedido (EstadoPedido): El estado general del pedido (EN_PROCESO, COMPLETADO, CANCELADO).
        seguimiento_estado (EstadoSeguimiento): El estado actual en el proceso de seguimiento logístico.
        seguimiento_historial (JSON): Un registro histórico de los cambios en el estado de seguimiento.
        notas_seguimiento (str): Notas adicionales relacionadas con el seguimiento del pedido.
        usuario (Usuarios): Relación con el modelo `Usuarios`.
        productos (List[PedidoProducto]): Relación con los productos incluidos en este pedido.
    """
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
    """
    Tabla de asociación entre Pedido y Producto.

    Almacena los detalles de cada producto dentro de un pedido, como la cantidad
    y el precio unitario al momento de la compra. Esto es crucial para mantener
    la integridad histórica de los pedidos, incluso si los precios de los productos cambian.

    Attributes:
        pedido_id (str): Clave foránea que vincula al pedido.
        producto_id (str): Clave foránea que vincula al producto.
        cantidad (int): La cantidad de este producto en el pedido.
        precio_unitario (float): El precio del producto al momento de realizar el pedido.
        pedido (Pedido): Relación inversa con el modelo `Pedido`.
        producto (Productos): Relación inversa con el modelo `Productos`.
    """
    __tablename__ = 'pedido_productos'

    pedido_id: Mapped[str] = mapped_column(ForeignKey('pedidos.id'), primary_key=True)
    producto_id: Mapped[str] = mapped_column(ForeignKey('productos.id'), primary_key=True)
    cantidad: Mapped[int] = mapped_column(db.Integer, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(db.Float, nullable=False)

    pedido: Mapped["Pedido"] = relationship(back_populates='productos')
    producto: Mapped["Productos"] = relationship(back_populates='pedidos')

    def __init__(self, pedido_id, producto_id, cantidad, precio_unitario):
        """
        Inicializa una nueva instancia de la asociación Pedido-Producto.

        Args:
            pedido_id (str): El ID del pedido.
            producto_id (str): El ID del producto.
            cantidad (int): La cantidad del producto.
            precio_unitario (float): El precio unitario del producto en el momento de la compra.
        """
        self.pedido_id = pedido_id
        self.producto_id = producto_id
        self.cantidad = cantidad
        self.precio_unitario = precio_unitario
