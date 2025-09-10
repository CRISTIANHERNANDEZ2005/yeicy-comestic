from enum import Enum

class EstadoEnum(str, Enum):
    ACTIVO = 'activo'
    INACTIVO = 'inactivo'

class EstadoPedido(str, Enum):
    EN_PROCESO = 'en proceso'
    COMPLETADO = 'completado'
    CANCELADO = 'cancelado'
