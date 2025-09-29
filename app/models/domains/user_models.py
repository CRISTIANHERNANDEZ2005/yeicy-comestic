"""
Módulo de Modelos de Dominio para Usuarios y Administradores.


Este archivo define las estructuras de datos para los diferentes tipos de usuarios
del sistema. Incluye el modelo `Usuarios` para los clientes de la tienda y el
modelo `Admins` para los administradores del panel. Gestiona la autenticación,
perfiles, seguridad de contraseñas y la generación de tokens JWT. También contiene
`Value Objects` para la validación de datos como números de teléfono y contraseñas.
"""
# --- Importaciones de Serializadores ---
from app.models.serializers import usuario_to_dict, admin_to_dict
# --- Importaciones de la Librería Estándar --- 
from datetime import datetime, timedelta, timezone
# --- Importaciones de Extensiones y Terceros ---
from app.extensions import db, bcrypt
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from flask_login import UserMixin
# --- Importaciones Locales de la Aplicación ---
from typing import List, TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.domains.review_models import Likes, Reseñas
    from app.models.domains.order_models import Pedido
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum

class NumeroTelefono:
    """
    Value Object para encapsular y validar números de teléfono.

    Asegura que el número de teléfono tenga exactamente 10 dígitos numéricos.
    """
    def __init__(self, numero: str):
        """
        Inicializa el Value Object.

        Args:
            numero (str): El número de teléfono a validar.

        Raises:
            ValueError: Si el número no tiene 10 dígitos o no es numérico.
        """
        if not numero or len(numero) != 10 or not numero.isdigit():
            raise ValueError("El número debe tener 10 dígitos numéricos")
        self.value = numero
    def __str__(self):
        return self.value

class NumeroUsuario:
    """
    Value Object para encapsular y validar el número de usuario (teléfono).

    Asegura que el número de usuario (que funciona como identificador) tenga
    exactamente 10 dígitos numéricos.
    """
    def __init__(self, numero: str):
        """
        Inicializa el Value Object.

        Args:
            numero (str): El número de usuario a validar.

        Raises:
            ValueError: Si el número no tiene 10 dígitos o no es numérico.
        """
        if not numero or len(numero) != 10 or not numero.isdigit():
            raise ValueError("El número debe tener 10 dígitos numéricos")
        self.value = numero
    def __str__(self):
        return self.value

class Password:
    """
    Value Object para encapsular y validar la fortaleza de una contraseña.

    Asegura que la contraseña cumpla con los requisitos de seguridad modernos:
    - Mínimo 8 caracteres.
    - Al menos una letra mayúscula.
    - Al menos una letra minúscula.
    - Al menos un número.
    """
    def __init__(self, contraseña: str):
        """
        Inicializa el Value Object.

        Args:
            contraseña (str): La contraseña a validar.

        Raises:
            ValueError: Si la contraseña no cumple con los criterios de fortaleza.
        """
        import re
        pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$"
        if not contraseña or not re.match(pattern, contraseña):
            raise ValueError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.")
        self.value = contraseña
    def __str__(self):
        return self.value


class Usuarios(UserMixin, UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    """
    Representa a un usuario cliente registrado en el sistema.

    Este modelo almacena la información de autenticación y personal de los clientes.
    Implementa las propiedades requeridas por Flask-Login para la gestión de sesiones.
    También incluye métodos para la generación y verificación de JWT, y para la
    recuperación de contraseñas.

    Attributes:
        numero (str): Número de teléfono del usuario, usado como identificador único para el login.
        nombre (str): Nombre del usuario.
        apellido (str): Apellido del usuario.
        contraseña (str): Hash de la contraseña del usuario.
        reset_token (str): Token utilizado para el proceso de recuperación de contraseña.
        reset_token_expiration (datetime): Fecha de expiración del `reset_token`.
        likes (List['Likes']): Relación con los 'me gusta' que ha dado el usuario.
        reseñas (List['Reseñas']): Relación con las reseñas que ha escrito el usuario.
        pedidos (List['Pedido']): Relación con los pedidos que ha realizado el usuario.
    """
    __tablename__ = 'usuarios'
    
    # Propiedades requeridas por Flask-Login
    @property
    def is_active(self):
        """
        Indica si el usuario está activo. Requerido por Flask-Login.
        """
        return self.estado == EstadoEnum.ACTIVO
    
    @property
    def is_authenticated(self):
        """
        Indica si el usuario está autenticado. Siempre `True` para instancias de esta clase.
        Requerido por Flask-Login.
        """
        return True
    
    @property
    def is_anonymous(self):
        """
        Indica si el usuario es anónimo. Siempre `False` para instancias de esta clase.
        Requerido por Flask-Login.
        """
        return False
    
    def get_id(self):
        """
        Devuelve el ID del usuario como una cadena. Requerido por Flask-Login.
        """
        return str(self.id)

    @property
    def is_online(self):
        """
        Determina si un usuario está en línea basándose en su última actividad.
        Se considera en línea si 'last_seen' es de hace menos de 5 minutos.
        """
        #  Definir el umbral de "en línea" como una constante para fácil mantenimiento.
        ONLINE_THRESHOLD_MINUTES = 5

        if not self.last_seen:
            return False
        # Asegurarse de que last_seen tenga timezone para una comparación correcta.
        # Si la BD guarda naive datetimes (sin tz), asumimos que es UTC.
        last_seen_utc = self.last_seen.replace(tzinfo=timezone.utc) if self.last_seen.tzinfo is None else self.last_seen
        return (datetime.now(timezone.utc) - last_seen_utc) < timedelta(minutes=ONLINE_THRESHOLD_MINUTES)

    @property
    def last_seen_display(self):
        """
        Formatea el timestamp de 'last_seen' en un formato legible para humanos.
        Ej: "Última vez hoy a las 10:30", "Última vez ayer a las 20:15", "Última vez el 15 de mayo".
        """
        if not self.last_seen:
            return "Nunca"

        # Asegurarse de que last_seen tenga timezone para una comparación correcta
        last_seen_aware = self.last_seen.replace(tzinfo=timezone.utc) if self.last_seen.tzinfo is None else self.last_seen
        now_aware = datetime.now(timezone.utc)
        
        # Convertir a la zona horaria local (ej. Colombia) para la visualización
        try:
            import pytz
            local_tz = pytz.timezone('America/Bogota')
            last_seen_local = last_seen_aware.astimezone(local_tz)
            now_local = now_aware.astimezone(local_tz)
        except ImportError:
            # Fallback si pytz no está instalado (aunque debería estarlo)
            last_seen_local = last_seen_aware
            now_local = now_aware

        delta = now_local.date() - last_seen_local.date()

        if delta.days == 0:
            return f"Última vez hoy a las {last_seen_local.strftime('%H:%M')}"
        elif delta.days == 1:
            return f"Última vez ayer a las {last_seen_local.strftime('%H:%M')}"
        elif delta.days < 7:
            # Nombres de los días en español
            dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
            return f"Última vez el {dias[last_seen_local.weekday()]} a las {last_seen_local.strftime('%H:%M')}"
        else:
            # Nombres de los meses en español
            meses = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
            return f"Última vez el {last_seen_local.day} de {meses[last_seen_local.month]}"


    def generar_jwt(self):
        """
        Genera un JSON Web Token (JWT) para el usuario.

        El token contiene información básica del usuario y una fecha de expiración.

        Returns:
            str: El token JWT codificado.
        """
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

    @staticmethod
    def verificar_jwt(token):
        """
        Verifica un JWT y devuelve la instancia del usuario si es válido.

        Args:
            token (str): El token JWT a verificar.

        Returns:
            Optional[Usuarios]: La instancia del usuario si el token es válido y el usuario
                                existe, de lo contrario `None`.
        """
        import jwt
        from flask import current_app
        try:
            secret = current_app.config.get('SECRET_KEY', 'super-secret')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            user_id = payload.get('user_id')
            if user_id:
                return Usuarios.query.get(user_id)
            return None
        except jwt.ExpiredSignatureError:
            current_app.logger.warning("Token JWT expirado.")
            return None
        except jwt.InvalidTokenError:
            current_app.logger.warning("Token JWT inválido.")
            return None
        except Exception as e:
            current_app.logger.error(f"Error al verificar JWT: {e}")
            return None

    # id y timestamps heredados de los mixins
    numero: Mapped[str] = mapped_column(db.String(10), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(db.String(50), nullable=False)
    apellido: Mapped[str] = mapped_column(db.String(50), nullable=False)
    _contraseña: Mapped[str] = mapped_column("contraseña", db.String(256), nullable=False)
    reset_token: Mapped[str] = mapped_column(db.String(256), nullable=True, unique=True)
    reset_token_expiration: Mapped[datetime] = mapped_column(db.DateTime, nullable=True)
    last_seen: Mapped[datetime] = mapped_column(db.DateTime, nullable=True, index=True)
    # estado ya está en el mixin
    likes: Mapped[List['Likes']] = relationship('Likes', back_populates='usuario', lazy=True)
    reseñas: Mapped[List['Reseñas']] = relationship('Reseñas', back_populates='usuario', lazy=True)
    pedidos: Mapped[List['Pedido']] = relationship(back_populates='usuario', lazy=True)

    # Restricciones
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero) = 10 AND numero ~ '^[0-9]+$'", name='check_usuario_numero'),
    )

    @property
    def contraseña(self):
        """
        Getter para la contraseña. Lanza un error si se intenta leer el hash.
        """
        raise AttributeError('contraseña no es un atributo legible.')

    @contraseña.setter
    def contraseña(self, password_plano: str):
        """
        Setter profesional que hashea la contraseña automáticamente al asignarla.
        """
        validated_password = str(Password(password_plano))
        self._contraseña = bcrypt.generate_password_hash(validated_password).decode('utf-8')

    def __init__(self, numero, nombre, apellido, contraseña, estado='activo', id=None):
        """
        Inicializa una nueva instancia de Usuario.

        Args:
            numero (str): El número de teléfono del usuario (10 dígitos).
            nombre (str): El nombre del usuario.
            apellido (str): El apellido del usuario.
            contraseña (str): La contraseña en texto plano (será hasheada).
            estado (str): El estado inicial ('activo' o 'inactivo').
            id (Optional[str]): Un ID predefinido, si es necesario.
        """
        self.numero = str(NumeroUsuario(numero))
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not apellido or not apellido.strip():
            raise ValueError("El apellido no puede estar vacío")
        self.nombre = nombre
        self.apellido = apellido
        # El setter se encargará del hasheo
        self.contraseña = contraseña
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.estado = estado
        if id:
            self.id = id


    def verificar_contraseña(self, contraseña):
        """
        Verifica si una contraseña proporcionada coincide con la contraseña hasheada del usuario.

        Args:
            contraseña (str): La contraseña en texto plano a verificar.

        Returns:
            bool: `True` si la contraseña es correcta, `False` en caso contrario.
        """
        return bcrypt.check_password_hash(self._contraseña, contraseña)

    def generar_codigo_recuperacion(self):
        """
        Genera un código numérico de 6 dígitos para recuperación de contraseña.

        El código se almacena en `reset_token` y tiene una expiración de 10 minutos.
        """
        import random
        from datetime import datetime, timedelta
        # Generamos un código numérico de 6 dígitos
        self.reset_token = str(random.randint(100000, 999999))
        self.reset_token_expiration = datetime.utcnow() + timedelta(minutes=10) # El código expira en 10 minutos
        db.session.add(self)
        db.session.commit()
        return self.reset_token

    def generar_token_seguro_reseteo(self):
        """
        Genera un token de reseteo seguro y largo para el paso final del cambio de contraseña.

        Este token se genera después de verificar el código numérico para mayor seguridad.
        """
        import secrets
        from datetime import datetime, timedelta
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_token_expiration = datetime.utcnow() + timedelta(minutes=10) # El código expira en 10 minutos
        db.session.add(self)
        db.session.commit()
        return self.reset_token

    @staticmethod
    def verificar_reset_token(token):
        """
        Verifica si un token de reseteo (código o token seguro) es válido y no ha expirado.

        Args:
            token (str): El token a verificar.

        Returns:
            Optional[Usuarios]: La instancia del usuario si el token es válido, de lo contrario `None`.
        """
        from datetime import datetime
        usuario = Usuarios.query.filter_by(reset_token=token).first()
        if usuario and usuario.reset_token_expiration and usuario.reset_token_expiration > datetime.utcnow():
            return usuario
        return None

class Admins(UserMixin, UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    """
    Representa a un usuario administrador del sistema.

    Este modelo almacena la información de los administradores, separada de los
    usuarios clientes para mayor seguridad y claridad.

    Attributes:
        cedula (str): Cédula de identidad del administrador.
        nombre (str): Nombre del administrador.
        apellido (str): Apellido del administrador.
        numero_telefono (str): Número de teléfono del administrador.
        contraseña (str): Hash de la contraseña del administrador.
    """
    __tablename__ = 'admins'

    # Propiedades requeridas por Flask-Login
    @property
    def is_active(self):
        """Indica si el administrador está activo."""
        return self.estado == EstadoEnum.ACTIVO

    @property
    def is_authenticated(self):
        """Indica si el administrador está autenticado."""
        return True

    @property
    def is_anonymous(self):
        """Indica si el administrador es anónimo."""
        return False

    def get_id(self):
        """Devuelve el ID del administrador como una cadena."""
        return str(self.id)

    @property
    def is_online(self):
        """
        Determina si un administrador está en línea basándose en su última actividad.
        Se considera en línea si 'last_seen' es de hace menos de 5 minutos.
        """
        #  Definir el umbral de "en línea" como una constante para fácil mantenimiento.
        ONLINE_THRESHOLD_MINUTES = 5

        if not self.last_seen:
            return False
        # Asegurarse de que last_seen tenga timezone para una comparación correcta.
        # Si la BD guarda naive datetimes (sin tz), asumimos que es UTC.
        last_seen_utc = self.last_seen.replace(tzinfo=timezone.utc) if self.last_seen.tzinfo is None else self.last_seen
        return (datetime.now(timezone.utc) - last_seen_utc) < timedelta(minutes=ONLINE_THRESHOLD_MINUTES)

    @property
    def last_seen_display(self):
        """
        Formatea el timestamp de 'last_seen' en un formato legible para humanos.
        Ej: "Última vez hoy a las 10:30", "Última vez ayer a las 20:15", "Última vez el 15 de mayo".
        """
        if not self.last_seen:
            return "Nunca"

        # Asegurarse de que last_seen tenga timezone para una comparación correcta
        last_seen_aware = self.last_seen.replace(tzinfo=timezone.utc) if self.last_seen.tzinfo is None else self.last_seen
        now_aware = datetime.now(timezone.utc)
        
        # Convertir a la zona horaria local (ej. Colombia) para la visualización
        try:
            import pytz
            local_tz = pytz.timezone('America/Bogota')
            last_seen_local = last_seen_aware.astimezone(local_tz)
            now_local = now_aware.astimezone(local_tz)
        except ImportError:
            # Fallback si pytz no está instalado
            last_seen_local = last_seen_aware
            now_local = now_aware

        delta = now_local.date() - last_seen_local.date()

        if delta.days == 0:
            return f"Última vez hoy a las {last_seen_local.strftime('%H:%M')}"
        elif delta.days == 1:
            return f"Última vez ayer a las {last_seen_local.strftime('%H:%M')}"
        elif delta.days < 7:
            # Nombres de los días en español
            dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
            return f"Última vez el {dias[last_seen_local.weekday()]} a las {last_seen_local.strftime('%H:%M')}"
        else:
            # Nombres de los meses en español
            meses = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
            return f"Última vez el {last_seen_local.day} de {meses[last_seen_local.month]}"


    # id y timestamps heredados de los mixins
    cedula: Mapped[str] = mapped_column(db.String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(db.String(50), nullable=False)
    apellido: Mapped[str] = mapped_column(db.String(50), nullable=False)
    numero_telefono: Mapped[str] = mapped_column(db.String(10), nullable=False, unique=True)
    _contraseña: Mapped[str] = mapped_column("contraseña", db.String(256), nullable=False)
    # estado ya está en el mixin
    last_seen: Mapped[datetime] = mapped_column(db.DateTime, nullable=True, index=True)

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero_telefono) = 10 AND numero_telefono ~ '^[0-9]+$'", name='check_numero_telefono'),
        db.Index('idx_admin_cedula', 'cedula'),
        db.Index('idx_admin_numero_telefono', 'numero_telefono'),
    )

    @property
    def contraseña(self):
        """Getter para la contraseña. No debería ser usado para leer el hash."""
        return self._contraseña

    @contraseña.setter
    def contraseña(self, password_plano: str):
        """
        Setter profesional que hashea la contraseña automáticamente al asignarla.
        """
        # Validar y hashear la contraseña en texto plano.
        validated_password = str(Password(password_plano))
        self._contraseña = bcrypt.generate_password_hash(validated_password).decode('utf-8')

    def __init__(self, cedula, nombre, apellido, numero_telefono, contraseña, estado='activo', id=None):
        """
        Inicializa una nueva instancia de Admin.

        Args:
            cedula (str): La cédula del administrador.
            nombre (str): El nombre del administrador.
            apellido (str): El apellido del administrador.
            numero_telefono (str): El número de teléfono (10 dígitos).
            contraseña (str): La contraseña en texto plano (será hasheada).
            estado (str): El estado inicial ('activo' o 'inactivo').
            id (Optional[str]): Un ID predefinido, si es necesario.
        """
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
        # El setter se encargará del hasheo
        self.contraseña = contraseña
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.estado = estado
        if id:
            self.id = id


    def verificar_contraseña(self, contraseña):
        """
        Verifica si una contraseña proporcionada coincide con la contraseña hasheada del admin.

        Args:
            contraseña (str): La contraseña en texto plano a verificar.

        Returns:
            bool: `True` si la contraseña es correcta, `False` en caso contrario.
        """
        return bcrypt.check_password_hash(self._contraseña, contraseña)

    def generar_jwt(self):
        """
        Genera un JSON Web Token (JWT) para el administrador.

        Returns:
            str: El token JWT codificado, con un flag `is_admin`.
        """
        import jwt
        from datetime import datetime, timedelta
        from flask import current_app
        payload = {
            'user_id': self.id,
            'cedula': self.cedula,
            'nombre': self.nombre,
            'is_admin': True,
            'exp': datetime.utcnow() + timedelta(days=7)
        }
        secret = current_app.config.get('SECRET_KEY', 'super-secret')
        return jwt.encode(payload, secret, algorithm='HS256')
