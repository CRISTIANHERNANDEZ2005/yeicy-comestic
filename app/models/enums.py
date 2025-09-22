from enum import Enum

class EstadoEnum(str, Enum):
    ACTIVO = 'activo'
    INACTIVO = 'inactivo'

class EstadoPedido(str, Enum):
    EN_PROCESO = 'en proceso'
    COMPLETADO = 'completado'
    CANCELADO = 'cancelado'

class EstadoSeguimiento(str, Enum):
    RECIBIDO = 'recibido'
    EN_PREPARACION = 'en preparacion'
    EN_CAMINO = 'en camino'
    ENTREGADO = 'entregado'
    CANCELADO = 'cancelado'