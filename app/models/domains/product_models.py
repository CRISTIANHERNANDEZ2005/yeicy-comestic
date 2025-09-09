# Serializadores
from app.models.serializers import categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, producto_to_dict
from app.extensions import db
from sqlalchemy import CheckConstraint, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional, TYPE_CHECKING
from slugify import slugify

if TYPE_CHECKING:
    from app.models.domains.review_models import Likes, Reseñas
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin, EstadoActivoInactivoMixin
from app.models.enums import EstadoEnum

class NombreProducto:
    """Value object para validar el nombre del producto."""
    def __init__(self, nombre: str):
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        self.value = nombre.strip()
    def __str__(self):
        return self.value

class DescripcionProducto:
    """Value object para validar la descripción del producto."""
    def __init__(self, descripcion: str):
        if not descripcion or not descripcion.strip():
            raise ValueError("La descripción no puede estar vacía")
        self.value = descripcion.strip()
    def __str__(self):
        return self.value


class CategoriasPrincipales(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'categorias_principales'

    # id y timestamps heredados de los mixins
    nombre: Mapped[str] = mapped_column(db.String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(db.String(120), nullable=False, unique=True) # Nuevo campo slug
    descripcion: Mapped[str] = mapped_column(db.String(500), nullable=False)
    # estado ya está en el mixin
    subcategorias: Mapped[List['Subcategorias']] = relationship('Subcategorias', back_populates='categoria_principal', lazy=True)

    # Restricciones
    __table_args__ = (
        db.Index('idx_categoria_principal_slug', 'slug'), # Índice para el slug
    )

    def check_and_update_status(self):
        """
        Verifica el estado de todas las subcategorías asociadas a esta categoría principal.
        Si todas las subcategorías están inactivas, desactiva la categoría principal.
        Si hay al menos una subcategoría activa, asegura que la categoría principal esté activa.
        """
        from app.models.enums import EstadoEnum # Importar aquí para evitar circular
        
        # Contar subcategorías activas asociadas a esta categoría principal
        active_subcategories_count = Subcategorias.query.filter_by(
            categoria_principal_id=self.id,
            estado=EstadoEnum.ACTIVO.value
        ).count()

        with db.session.no_autoflush:
            original_estado = self.estado # Store original state
            if active_subcategories_count == 0:
                if self.estado != EstadoEnum.INACTIVO.value:
                    self.estado = EstadoEnum.INACTIVO.value
            # No activar si ya está inactivo por una acción explícita del usuario
            # Solo se activa si estaba inactivo y ahora tiene subcategorías activas
            elif self.estado == EstadoEnum.INACTIVO.value:
                self.estado = EstadoEnum.ACTIVO.value

            if self.estado != original_estado: # Only add if status changed
                pass

    def __init__(self, nombre, descripcion, estado='activo', id=None):
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not descripcion or not descripcion.strip():
            raise ValueError("La descripción no puede estar vacía")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.slug = slugify(nombre) # Generar slug automáticamente
        self.descripcion = descripcion
        self.estado = estado
        if id:
            self.id = id

class Subcategorias(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'subcategorias'

    # id y timestamps heredados de los mixins
    nombre: Mapped[str] = mapped_column(db.String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(db.String(120), nullable=False, unique=True) # Nuevo campo slug
    descripcion: Mapped[str] = mapped_column(db.String(500), nullable=False)
    categoria_principal_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('categorias_principales.id'), nullable=False)
    # estado ya está en el mixin
    seudocategorias: Mapped[List['Seudocategorias']] = relationship('Seudocategorias', back_populates='subcategoria', lazy=True)
    categoria_principal: Mapped['CategoriasPrincipales'] = relationship('CategoriasPrincipales', back_populates='subcategorias')

    # Restricciones e índices
    __table_args__ = (
        db.Index('idx_subcategoria_categoria_principal_id',
                 'categoria_principal_id'),
        db.Index('idx_subcategoria_slug', 'slug'), # Índice para el slug
    )

    def check_and_update_status(self):
        """
        Verifica el estado de todas las pseudocategorías asociadas a esta subcategoría.
        Si todas las pseudocategorías están inactivas, desactiva la subcategoría.
        Si hay al menos una pseudocategoría activa, asegura que la subcategoría esté activa.
        """
        from app.models.enums import EstadoEnum # Importar aquí para evitar circular
        
        # Contar pseudocategorías activas asociadas a esta subcategoría
        active_pseudocategories_count = Seudocategorias.query.filter_by(
            subcategoria_id=self.id,
            estado=EstadoEnum.ACTIVO.value
        ).count()

        with db.session.no_autoflush:
            original_estado = self.estado # Store original state
            if active_pseudocategories_count == 0:
                if self.estado != EstadoEnum.INACTIVO.value:
                    self.estado = EstadoEnum.INACTIVO.value
            # No activar si ya está inactivo por una acción explícita del usuario
            # Solo se activa si estaba inactivo y ahora tiene seudocategorías activas
            elif self.estado == EstadoEnum.INACTIVO.value:
                self.estado = EstadoEnum.ACTIVO.value

            if self.estado != original_estado: # Only add if status changed
                pass
            
            
            
            # Always check parent status, regardless of own status change
            # The parent's check_and_update_status will handle its own status change logic
            if self.categoria_principal:
                self.categoria_principal.check_and_update_status()

    def __init__(self, nombre, descripcion, categoria_principal_id, estado='activo', id=None):
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not descripcion or not descripcion.strip():
            raise ValueError("La descripción no puede estar vacía")
        if not categoria_principal_id:
            raise ValueError("Debe indicar la categoría principal")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.slug = slugify(nombre) # Generar slug automáticamente
        self.descripcion = descripcion
        self.categoria_principal_id = categoria_principal_id
        self.estado = estado
        if id:
            self.id = id

class Seudocategorias(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'seudocategorias'

    # id y timestamps heredados de los mixins
    nombre: Mapped[str] = mapped_column(db.String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(db.String(120), nullable=False, unique=True) # Nuevo campo slug
    descripcion: Mapped[str] = mapped_column(db.String(500), nullable=False)
    subcategoria_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('subcategorias.id'), nullable=False)
    # estado ya está en el mixin
    productos: Mapped[List['Productos']] = relationship('Productos', back_populates='seudocategoria', lazy=True)
    subcategoria: Mapped['Subcategorias'] = relationship('Subcategorias', back_populates='seudocategorias')

    # Restricciones e índices
    __table_args__ = (
        db.Index('idx_seudocategoria_subcategoria_id', 'subcategoria_id'),
        db.Index('idx_seudocategoria_slug', 'slug'), # Índice para el slug
    )

    def check_and_update_status(self):
        """
        Verifica el estado de todos los productos asociados a esta pseudocategoría.
        Si todos los productos están inactivos, desactiva la pseudocategoría.
        Si hay al menos un producto activo, asegura que la pseudocategoría esté activa.
        """
        from app.models.enums import EstadoEnum # Importar aquí para evitar circular
        
        # Contar productos activos asociados a esta pseudocategoría
        active_products_count = Productos.query.filter_by(
            seudocategoria_id=self.id,
            estado=EstadoEnum.ACTIVO.value
        ).count()

        with db.session.no_autoflush:
            original_estado = self.estado # Store original state
            if active_products_count == 0:
                if self.estado != EstadoEnum.INACTIVO.value:
                    self.estado = EstadoEnum.INACTIVO.value
            # No activar si ya está inactivo por una acción explícita del usuario
            # Solo se activa si estaba inactivo y ahora tiene productos activos
            elif self.estado == EstadoEnum.INACTIVO.value:
                self.estado = EstadoEnum.ACTIVO.value

            if self.estado != original_estado: # Only add if status changed
                pass
            

            # Always check parent status, regardless of own status change
            # The parent's check_and_update_status will handle its own status change logic
            if self.subcategoria:
                self.subcategoria.check_and_update_status()

    def __init__(self, nombre, descripcion, subcategoria_id, estado='activo', id=None):
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not descripcion or not descripcion.strip():
            raise ValueError("La descripción no puede estar vacía")
        if not subcategoria_id:
            raise ValueError("Debe indicar la subcategoría")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.slug = slugify(nombre) # Generar slug automáticamente
        self.descripcion = descripcion
        self.subcategoria_id = subcategoria_id
        self.estado = estado
        if id:
            self.id = id

class Productos(UUIDPrimaryKeyMixin, TimestampMixin, EstadoActivoInactivoMixin, db.Model):
    __tablename__ = 'productos'

    # id y timestamps heredados de los mixins
    nombre: Mapped[str] = mapped_column(db.String(100), nullable=False)
    slug: Mapped[str] = mapped_column(db.String(255), nullable=False, unique=True)
    descripcion: Mapped[str] = mapped_column(db.String(1000), nullable=False)
    precio: Mapped[float] = mapped_column(db.Float, nullable=False)
    costo: Mapped[float] = mapped_column(db.Float, nullable=False)
    imagen_url: Mapped[str] = mapped_column(db.String(255), nullable=False)
    _existencia: Mapped[int] = mapped_column(db.Integer, nullable=False, name='existencia') # Renombrado para el setter

    @property
    def existencia(self):
        return self._existencia

    @existencia.setter
    def existencia(self, value):
        if value < 0:
            raise ValueError("La existencia no puede ser negativa")
        self._existencia = value
        if self._existencia == 0:
            from app.models.enums import EstadoEnum # Importar aquí para evitar circular
            self.estado = EstadoEnum.INACTIVO.value # Desactivar si la existencia es 0
            db.session.add(self)
            # Después de actualizar el producto, verificar el estado de la pseudocategoría
            if self.seudocategoria:
                self.seudocategoria.check_and_update_status()
        else: # Si la existencia es > 0, asegurar que el producto esté activo
            from app.models.enums import EstadoEnum # Importar aquí para evitar circular
            if self.estado != EstadoEnum.ACTIVO.value:
                self.estado = EstadoEnum.ACTIVO.value
                db.session.add(self)
                # Después de actualizar el producto, verificar el estado de la pseudocategoría
                if self.seudocategoria:
                    self.seudocategoria.check_and_update_status()
    stock_minimo: Mapped[int] = mapped_column(db.Integer, default=10, nullable=False)
    stock_maximo: Mapped[int] = mapped_column(db.Integer, default=100, nullable=False)
    seudocategoria_id: Mapped[str] = mapped_column(db.String(36), db.ForeignKey('seudocategorias.id'), nullable=False)
    marca: Mapped[Optional[str]] = mapped_column(db.String(100), nullable=True)
    especificaciones: Mapped[Optional[dict]] = mapped_column(db.JSON, nullable=True) # Nuevo campo para especificaciones
    # estado ya está en el mixin
    likes: Mapped[List['Likes']] = relationship('Likes', back_populates='producto', lazy=True)
    reseñas: Mapped[List['Reseñas']] = relationship('Reseñas', back_populates='producto', lazy=True)
    seudocategoria: Mapped['Seudocategorias'] = relationship('Seudocategorias', back_populates='productos')

    calificacion_promedio_almacenada: Mapped[float] = mapped_column(db.Float, default=0.0) # Nueva columna para almacenar el promedio
    # Propiedad para calcular la calificación promedio (se mantiene para compatibilidad o acceso directo)
    @property
    def calificacion_promedio(self):
        """Calcula el promedio de calificaciones de las reseñas (dinámico)."""
        if not self.reseñas:
            return 0.0
        total = sum(reseña.calificacion for reseña in self.reseñas)
        return round(total / len(self.reseñas), 1)

    def actualizar_promedio_calificaciones(self):
        """
        Actualiza la calificación promedio almacenada del producto
        basándose en las reseñas y guarda el cambio en la base de datos.
        """
        if not self.reseñas:
            self.calificacion_promedio_almacenada = 0.0
        else:
            total = sum(reseña.calificacion for reseña in self.reseñas)
            self.calificacion_promedio_almacenada = round(total / len(self.reseñas), 1)
        db.session.add(self)
        db.session.commit() # Guardar el cambio inmediatamente

    # Propiedad para verificar si es nuevo
    @property
    def es_nuevo(self):
        from datetime import datetime, timedelta
        return datetime.utcnow() - self.created_at <= timedelta(days=5)

    @property
    def agotado(self):
        return self.existencia < self.stock_minimo

    # Restricciones e índices
    __table_args__ = (
        CheckConstraint("precio > 0", name='check_precio_positivo'),
        CheckConstraint("precio > costo", name='check_precio_mayor_costo'),
        CheckConstraint("existencia >= 0", name='check_existencia_no_negativo'),
        db.Index('idx_producto_seudocategoria_id', 'seudocategoria_id'),
        db.Index('idx_producto_nombre', 'nombre'),
        db.Index('idx_producto_slug', 'slug'),
        db.Index('idx_producto_estado', 'estado'),
        db.Index('idx_producto_marca', 'marca'),
        db.Index('idx_producto_nombre_lower', db.func.lower(nombre)),
        db.Index('idx_producto_stock_minimo', 'stock_minimo'),
        db.Index('idx_producto_stock_maximo', 'stock_maximo'),
    )

    def __init__(self, nombre, descripcion, precio, costo, imagen_url, existencia, seudocategoria_id, especificaciones=None, stock_minimo=10, stock_maximo=100, marca=None, estado='activo', id=None):
        self.nombre = str(NombreProducto(nombre))
        self.slug = slugify(self.nombre)
        self.descripcion = str(DescripcionProducto(descripcion))
        if precio is None or precio <= 0:
            raise ValueError("El precio debe ser mayor que 0")
        if costo is None or costo <= 0:
            raise ValueError("El costo debe ser mayor que 0")
        if precio <= costo:
            raise ValueError("El precio debe ser mayor que el costo")
        if existencia is None or existencia < 0:
            raise ValueError("La existencia no puede ser negativa")
        if not imagen_url or not imagen_url.strip():
            raise ValueError("La URL de la imagen no puede estar vacía")
        if not seudocategoria_id:
            raise ValueError("Debe indicar la seudocategoría")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        if marca is not None and not marca.strip():
            raise ValueError("La marca no puede estar vacía si se proporciona")
        
        self.precio = precio
        self.costo = costo
        self.imagen_url = imagen_url.strip()
        self.existencia = existencia # Usar el setter para inicializar
        self.stock_minimo = stock_minimo
        self.stock_maximo = stock_maximo
        self.seudocategoria_id = seudocategoria_id
        self.marca = marca.strip() if marca else None
        self.estado = estado
        self.especificaciones = especificaciones
        if id:
            self.id = id
        self.calificacion_promedio_almacenada = 0.0 # Inicializar la nueva columna

    def __init__(self, nombre, descripcion, subcategoria_id, estado='activo', id=None):
        if not nombre or not nombre.strip():
            raise ValueError("El nombre no puede estar vacío")
        if not descripcion or not descripcion.strip():
            raise ValueError("La descripción no puede estar vacía")
        if not subcategoria_id:
            raise ValueError("Debe indicar la subcategoría")
        if estado not in EstadoEnum._value2member_map_:
            raise ValueError("El estado debe ser 'activo' o 'inactivo'")
        self.nombre = nombre
        self.slug = slugify(nombre) # Generar slug automáticamente
        self.descripcion = descripcion
        self.subcategoria_id = subcategoria_id
        self.estado = estado
        if id:
            self.id = id
