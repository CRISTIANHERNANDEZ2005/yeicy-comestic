# app/models/models.py
from app.extensions import db, bcrypt 
from sqlalchemy import CheckConstraint, UniqueConstraint
from datetime import datetime
import json
from flask_login import UserMixin
import jwt
from flask import current_app
from datetime import datetime

class Usuario(db.Model):
    __tablename__ = 'usuarios'

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
        """Verifica un token JWT y devuelve el payload si es válido"""
        from flask import current_app
        import jwt
        from jwt import ExpiredSignatureError, InvalidTokenError
        
        secret = current_app.config.get('SECRET_KEY', 'super-secret')
        
        try:
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            return payload
        except ExpiredSignatureError:
            return None
        except InvalidTokenError:
            return None

    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.String(10), nullable=False, unique=True)
    nombre = db.Column(db.String(50), nullable=False)
    apellido = db.Column(db.String(50), nullable=False)
    contraseña = db.Column(db.String(128), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='activo')
    likes = db.relationship('Like', backref='usuario', lazy=True)
    reseñas = db.relationship('Reseña', backref='usuario', lazy=True)

    # Restricciones
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero) = 10 AND numero ~ '^[0-9]+$'", name='check_numero'),
        CheckConstraint("LENGTH(contraseña) >= 6", name='check_contraseña'),
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_usuario'),
    )

    def __init__(self, numero, nombre, apellido, contraseña, estado='activo'):
        if len(contraseña) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.numero = numero
        self.nombre = nombre
        self.apellido = apellido
        self.contraseña = bcrypt.generate_password_hash(
            contraseña).decode('utf-8')
        self.estado = estado

    def verificar_contraseña(self, contraseña):
        return bcrypt.check_password_hash(self.contraseña, contraseña)


class Admin(db.Model):
    __tablename__ = 'admins'

    id = db.Column(db.Integer, primary_key=True)
    cedula = db.Column(db.String(20), nullable=False, unique=True)
    nombre = db.Column(db.String(50), nullable=False)
    apellido = db.Column(db.String(50), nullable=False)
    numero_telefono = db.Column(db.String(10), nullable=False, unique=True)
    contraseña = db.Column(db.String(128), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='activo')

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint(
            "LENGTH(numero_telefono) = 10 AND numero_telefono ~ '^[0-9]+$'", name='check_numero_telefono'),
        CheckConstraint("LENGTH(contraseña) >= 6",
                        name='check_contraseña_admin'),
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_admin'),
        db.Index('idx_admin_cedula', 'cedula'),
        db.Index('idx_admin_numero_telefono', 'numero_telefono'),
    )

    def __init__(self, cedula, nombre, apellido, numero_telefono, contraseña, estado='activo'):
        if len(contraseña) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        if len(numero_telefono) != 10 or not numero_telefono.isdigit():
            raise ValueError(
                "El número de teléfono debe tener 10 dígitos numéricos")
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.cedula = cedula
        self.nombre = nombre
        self.apellido = apellido
        self.numero_telefono = numero_telefono
        self.contraseña = bcrypt.generate_password_hash(
            contraseña).decode('utf-8')
        self.estado = estado

    def verificar_contraseña(self, contraseña):
        return bcrypt.check_password_hash(self.contraseña, contraseña)


class CategoriaPrincipal(db.Model):
    __tablename__ = 'categorias_principales'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.String(500), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='activo')
    subcategorias = db.relationship(
        'Subcategoria', backref='categoria_principal', lazy=True)

    # Restricciones
    __table_args__ = (
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_categoria_principal'),
    )

    def __init__(self, nombre, descripcion, estado='activo'):
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.descripcion = descripcion
        self.estado = estado


class Subcategoria(db.Model):
    __tablename__ = 'subcategorias'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.String(500), nullable=False)
    categoria_principal_id = db.Column(db.Integer, db.ForeignKey(
        'categorias_principales.id'), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='activo')
    seudocategorias = db.relationship(
        'Seudocategoria', backref='subcategoria', lazy=True)

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_subcategoria'),
        db.Index('idx_subcategoria_categoria_principal_id',
                 'categoria_principal_id'),
    )

    def __init__(self, nombre, descripcion, categoria_principal_id, estado='activo'):
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.descripcion = descripcion
        self.categoria_principal_id = categoria_principal_id
        self.estado = estado


class Seudocategoria(db.Model):
    __tablename__ = 'seudocategorias'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.String(500), nullable=False)
    subcategoria_id = db.Column(db.Integer, db.ForeignKey(
        'subcategorias.id'), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='activo')
    productos = db.relationship(
        'Producto', backref='seudocategoria', lazy=True)

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_seudocategoria'),
        db.Index('idx_seudocategoria_subcategoria_id', 'subcategoria_id'),
    )

    def __init__(self, nombre, descripcion, subcategoria_id, estado='activo'):
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.descripcion = descripcion
        self.subcategoria_id = subcategoria_id
        self.estado = estado

class Producto(db.Model):
    __tablename__ = 'productos'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.String(1000), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    imagen_url = db.Column(db.String(255), nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    seudocategoria_id = db.Column(db.Integer, db.ForeignKey(
        'seudocategorias.id'), nullable=False)
    marca = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default='activo')
    fecha_creacion = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # NUEVO CAMPO
    likes = db.relationship('Like', backref='producto', lazy=True)
    reseñas = db.relationship('Reseña', backref='producto', lazy=True)

    # Propiedad para calcular la calificación promedio
    @property
    def calificacion_promedio(self):
        if not self.reseñas:
            return 0
        total = sum(
            reseña.calificacion for reseña in self.reseñas if reseña.estado == 'activo')
        return round(total / len([r for r in self.reseñas if r.estado == 'activo']), 1)

    # Propiedad para verificar si es nuevo
    @property
    def es_nuevo(self):
        from datetime import datetime, timedelta
        return datetime.utcnow() - self.fecha_creacion <= timedelta(days=5)

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("precio > 0", name='check_precio_positivo'),
        CheckConstraint("stock >= 0", name='check_stock_no_negativo'),
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_producto'),
        db.Index('idx_producto_seudocategoria_id', 'seudocategoria_id'),
        db.Index('idx_producto_nombre', 'nombre'),
        db.Index('idx_producto_estado', 'estado'),
        db.Index('idx_producto_marca', 'marca'),
        db.Index('idx_producto_nombre_lower', db.func.lower(nombre)),
    )

    def __init__(self, nombre, descripcion, precio, imagen_url, stock, seudocategoria_id, marca=None, estado='activo'):
        if precio <= 0:
            raise ValueError("El precio debe ser mayor que 0")
        if stock < 0:
            raise ValueError("El stock no puede ser negativo")
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.descripcion = descripcion
        self.precio = precio
        self.imagen_url = imagen_url
        self.stock = stock
        self.seudocategoria_id = seudocategoria_id
        self.marca = marca
        self.estado = estado


class Like(db.Model):
    __tablename__ = 'likes'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey(
        'usuarios.id'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey(
        'productos.id'), nullable=False)
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    estado = db.Column(db.String(20), nullable=False, default='activo')

    # Restricciones e índices
    __table_args__ = (
        UniqueConstraint('usuario_id', 'producto_id',
                         name='unique_usuario_producto_like'),
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_like'),
        db.Index('idx_like_usuario_id', 'usuario_id'),
        db.Index('idx_like_producto_id', 'producto_id'),
    )

    def __init__(self, usuario_id, producto_id, estado='activo'):
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.usuario_id = usuario_id
        self.producto_id = producto_id
        self.estado = estado


class Reseña(db.Model):
    __tablename__ = 'reseñas'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey(
        'usuarios.id'), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey(
        'productos.id'), nullable=False)
    texto = db.Column(db.String(1000), nullable=False)
    calificacion = db.Column(db.Integer, nullable=False)
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    estado = db.Column(db.String(20), nullable=False, default='activo')

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("calificacion >= 1 AND calificacion <= 5",
                        name='check_calificacion_rango'),
        CheckConstraint("estado IN ('activo', 'inactivo')",
                        name='check_estado_reseña'),
        UniqueConstraint('usuario_id', 'producto_id',
                         name='unique_usuario_producto_reseña'),
        db.Index('idx_reseña_usuario_id', 'usuario_id'),
        db.Index('idx_reseña_producto_id', 'producto_id'),
    )

    def __init__(self, usuario_id, producto_id, texto, calificacion, estado='activo'):
        if not texto.strip():
            raise ValueError("El texto de la reseña no puede estar vacío")
        if not (1 <= calificacion <= 5):
            raise ValueError("La calificación debe estar entre 1 y 5")
        if estado not in ['activo', 'inactivo']:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.usuario_id = usuario_id
        self.producto_id = producto_id
        self.texto = texto
        self.calificacion = calificacion
        self.estado = estado


class CartSession(db.Model):
    """Modelo para usuarios no autenticados"""
    __tablename__ = 'cart_sessions'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID de sesión
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    items = db.Column(db.Text)  # JSON de items
    
    def __repr__(self):
        return f'<CartSession {self.id}>'

class CartItem(db.Model):
    """Modelo para usuarios autenticados"""
    __tablename__ = 'cart_items'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    session_id = db.Column(db.String(36), nullable=True)
    product_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relaciones
    product = db.relationship('Producto', backref='cart_items')
    user = db.relationship('Usuario', backref='cart_items')
    
    __table_args__ = (
        db.Index('idx_user_product', 'user_id', 'product_id'),
        db.Index('idx_session_product', 'session_id', 'product_id'),
    )
    
    @property
    def subtotal(self):
        return self.product.precio * self.quantity
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'quantity': self.quantity,
            'product': {
                'id': self.product.id,
                'nombre': self.product.nombre,
                'precio': float(self.product.precio),
                'imagen_url': self.product.imagen_url,
                'marca': self.product.marca,
                'stock': self.product.stock
            },
            'subtotal': float(self.subtotal)
        }
        
class BusquedaTermino(db.Model):
    __tablename__ = 'busqueda_terminos'

    id = db.Column(db.Integer, primary_key=True)
    termino = db.Column(db.String(255), nullable=False, unique=True)
    contador = db.Column(db.Integer, default=1)
    ultima_busqueda = db.Column(db.DateTime, default=datetime.utcnow)

    @staticmethod
    def registrar(termino):
        termino = termino.strip().lower()
        if not termino:
            return
        registro = BusquedaTermino.query.filter_by(termino=termino).first()
        if registro:
            registro.contador += 1
            registro.ultima_busqueda = datetime.utcnow()
        else:
            registro = BusquedaTermino(termino=termino)
            db.session.add(registro)
        db.session.commit()

    @staticmethod
    def top_terminos(limit=10):
        return BusquedaTermino.query.order_by(
            BusquedaTermino.contador.desc()
        ).limit(limit).all()