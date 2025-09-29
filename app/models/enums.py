"""
Módulo de Enumeraciones (Enums) de la Aplicación.

Este archivo centraliza todas las enumeraciones utilizadas en los modelos de la base de datos
y la lógica de negocio. Usar Enums en lugar de cadenas de texto simples previene errores,
mejora la legibilidad del código y asegura la consistencia de los datos a través del sistema.
"""
# --- Importaciones de la Librería Estándar ---
from enum import Enum

class EstadoEnum(str, Enum):
    """
    Enumeración para estados genéricos de activación.

    Se utiliza en modelos que pueden ser activados o desactivados, como productos,
    categorías, usuarios, etc.
    """
    ACTIVO = 'activo'
    INACTIVO = 'inactivo'

class EstadoPedido(str, Enum):
    """
    Enumeración para los estados principales del ciclo de vida de un pedido.

    Define las fases generales por las que puede pasar un pedido, desde su creación
    hasta su finalización o cancelación.
    """
    EN_PROCESO = 'en proceso'
    COMPLETADO = 'completado'
    CANCELADO = 'cancelado'

class EstadoSeguimiento(str, Enum):
    """
    Enumeración para los estados detallados del seguimiento logístico de un pedido.

    Representa los pasos específicos del proceso de envío y entrega, permitiendo
    un seguimiento granular tanto para el administrador como para el cliente.
    """
    RECIBIDO = 'recibido'
    EN_PREPARACION = 'en preparacion'
    EN_CAMINO = 'en camino'
    ENTREGADO = 'entregado'
    CANCELADO = 'cancelado'