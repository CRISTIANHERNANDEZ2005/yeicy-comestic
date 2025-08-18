# Serializadores
from app.models.serializers import usuario_to_dict, admin_to_dict
from app.extensions import db, bcrypt
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.domains.review_models import Likes, Reseñas
from flask_login import UserMixin
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum

class NumeroTelefono:
    """Value object para validar y encapsular números de teléfono de 10 dígitos."""
    def __init__(self, numero: str):
        if not numero or len(numero) != 10 or not numero.isdigit():
            raise ValueError("El número debe tener 10 dígitos numéricos")
        self.value = numero
    def __str__(self):
        return self.value

class NumeroUsuario:
    """Value object para validar y encapsular el número de usuario."""
    def __init__(self, numero: str):
        if not numero or len(numero) != 10 or not numero.isdigit():
            raise ValueError("El número debe tener 10 dígitos numéricos")
        self.value = numero
    def __str__(self):
        return self.value

class Password:
    """Value object para validar y encapsular contraseñas."""
    def __init__(self, contraseña: str):
        if not contraseña or len(contraseña) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        self.value = contraseña
    def __str__(self):
        return self.value


class Usuarios(UserMixin, UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'usuarios'
    
    # Propiedades requeridas por Flask-Login
    @property
    def is_active(self):
        return self.estado == 'activo'
    
    @property
    def is_authenticated(self):
        return True
    
    @property
    def is_anonymous(self):
        return False
    
    def get_id(self):
        return str(self.id)

    def generar_jwt(self):
        import jwt
        from datetime import datetime, timedelta
        from flask import current_app
        payload = {
            'user_id': self.id,
            'numero': self.numero,
            'nombre': self.nombre,
            'apellido': self.apellido,
            'exp': datetime.utcnow() + timedelta(days=7)
        }
        secret = current_app.config.get('SECRET_KEY', 'super-secret')
        return jwt.encode(payload, secret, algorithm='HS256')

    @classmethod
    def verificar_jwt(cls, token):
        """Verifica un token JWT y devuelve el usuario si es válido"""
        from flask import current_app
        import jwt
        from jwt import ExpiredSignatureError, InvalidTokenError
        secret = current_app.config.get('SECRET_KEY', 'super-secret')
        try:
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            if not user_id:
                return None
            usuario = cls.query.get(user_id)
            return usuario
        except ExpiredSignatureError:
            return None
        except InvalidTokenError:
            return None

    # id y timestamps heredados de los mixins
    numero: Mapped[str] = mapped_column(db.String(10), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(db.String(50), nullable=False)
    apellido: Mapped[str] = mapped_column(db.String(50), nullable=False)
    contraseña: Mapped[str] = mapped_column(db.String(128), nullable=False)
    # estado ya está en el mixin
    likes: Mapped[List['Likes']] = relationship('Likes', back_populates='usuario', lazy=True)
    reseñas: Mapped[List['Reseñas']] = relationship('Reseñas', back_populates='usuario', lazy=True)

    # Restricciones
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero) = 10 AND numero ~ '^[0-9]+$'", name='check_numero'),
        CheckConstraint("LENGTH(contraseña) >= 6", name='check_contraseña'),
    )

    def __init__(self, numero, nombre, apellido, contraseña, estado='activo', id=None):
        self.numero = str(NumeroUsuario(numero))
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not apellido or not apellido.strip():
            raise ValueError("El apellido no puede estar vacío")
        self.nombre = nombre
        self.apellido = apellido
        self.contraseña = bcrypt.generate_password_hash(str(Password(contraseña))).decode('utf-8')
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.estado = estado
        if id:
            self.id = id


    def verificar_contraseña(self, contraseña):
        return bcrypt.check_password_hash(self.contraseña, contraseña)


class Admins(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'admins'

    # id y timestamps heredados de los mixins
    cedula: Mapped[str] = mapped_column(db.String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(db.String(50), nullable=False)
    apellido: Mapped[str] = mapped_column(db.String(50), nullable=False)
    numero_telefono: Mapped[str] = mapped_column(db.String(10), nullable=False, unique=True)
    contraseña: Mapped[str] = mapped_column(db.String(128), nullable=False)
    # estado ya está en el mixin

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero_telefono) = 10 AND numero_telefono ~ '^[0-9]+$'", name='check_numero_telefono'),
        CheckConstraint("LENGTH(contraseña) >= 6",
                        name='check_contraseña_admin'),
        db.Index('idx_admin_cedula', 'cedula'),
        db.Index('idx_admin_numero_telefono', 'numero_telefono'),
    )

    def __init__(self, cedula, nombre, apellido, numero_telefono, contraseña, estado='activo', id=None):
        if not cedula or not cedula.strip():
            raise ValueError("La cédula no puede estar vacía")
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not apellido or not apellido.strip():
            raise ValueError("El apellido no puede estar vacío")
        self.cedula = cedula
        self.nombre = nombre
        self.apellido = apellido
        self.numero_telefono = str(NumeroTelefono(numero_telefono))
        self.contraseña = bcrypt.generate_password_hash(str(Password(contraseña))).decode('utf-8')
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.estado = estado
        if id:
            self.id = id


    def verificar_contraseña(self, contraseña):
        return bcrypt.check_password_hash(self.contraseña, contraseña)
