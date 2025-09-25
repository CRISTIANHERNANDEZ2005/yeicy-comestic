"""
Módulo de Modelos de Dominio para Búsquedas.

Este archivo define el modelo `BusquedaTermino`, diseñado para registrar y analizar
los términos que los usuarios introducen en el buscador. Esta información es
fundamental para entender las tendencias de búsqueda, optimizar los resultados
y ofrecer sugerencias relevantes a los usuarios.
"""
# --- Importaciones de Serializadores ---
from app.models.serializers import busqueda_termino_to_dict
# --- Importaciones de Extensiones y Terceros ---
from app.extensions import db
# --- Importaciones de la Librería Estándar ---
from datetime import datetime
# --- Importaciones Locales de la Aplicación ---
from app.models.mixins import TimestampMixin
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional

class BusquedaTermino(TimestampMixin,db.Model):
    """
    Representa un término de búsqueda realizado por los usuarios.

    Este modelo se utiliza para registrar y contar la frecuencia de los términos
    que los usuarios buscan en el sitio. Es útil para análisis de tendencias,
    sugerencias de búsqueda populares y SEO.

    Attributes:
        id (int): Identificador único del término.
        termino (str): El término de búsqueda, almacenado en minúsculas.
        contador (int): El número de veces que este término ha sido buscado.
        ultima_busqueda (Optional[datetime]): La fecha y hora de la última vez que se buscó el término.
    """

    __tablename__ = 'busqueda_terminos'

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    termino: Mapped[str] = mapped_column(db.String(255), nullable=False, unique=True)
    contador: Mapped[int] = mapped_column(db.Integer, default=1)
    ultima_busqueda: Mapped[Optional[datetime]] = mapped_column(db.DateTime, default=datetime.utcnow)

    def __init__(self, termino, contador=1, ultima_busqueda=None, id=None):
        """
        Inicializa una nueva instancia de BusquedaTermino.

        Args:
            termino (str): El término de búsqueda.
            contador (int): El conteo inicial.
            ultima_busqueda (Optional[datetime]): La fecha de la última búsqueda.
            id (Optional[int]): Un ID predefinido, si es necesario.
        """
        if not termino or not termino.strip():
            raise ValueError("El término no puede estar vacío")
        self.termino = termino.strip().lower()
        self.contador = contador
        self.ultima_busqueda = ultima_busqueda or datetime.utcnow()
        if id is not None:
            self.id = id
    
    @staticmethod
    def registrar(termino):
        """
        Registra una búsqueda de un solo término.

        Si el término ya existe, incrementa su contador. Si no, crea un nuevo registro.

        Args:
            termino (str): El término de búsqueda a registrar.
        """
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
    def registrar_batch(terminos):
        """
        Registra un lote de términos de búsqueda de manera eficiente.

        Este método está optimizado para manejar múltiples términos en una sola
        transacción de base de datos, reduciendo la sobrecarga.

        Args:
            terminos (List[str]): Una lista de términos de búsqueda a registrar.
        """
        if not terminos:
            return

        # Normalizar y filtrar términos vacíos
        terminos_normalizados = [t.strip().lower() for t in terminos if t and t.strip()]
        if not terminos_normalizados:
            return

        # Contar la frecuencia de cada término en el lote
        from collections import Counter
        conteo_terminos = Counter(terminos_normalizados)

        # Obtener registros existentes en una sola consulta
        terminos_unicos = list(conteo_terminos.keys())
        registros_existentes = BusquedaTermino.query.filter(
            BusquedaTermino.termino.in_(terminos_unicos)
        ).all()

        mapa_registros = {r.termino: r for r in registros_existentes}
        
        now = datetime.utcnow()

        for termino, count in conteo_terminos.items():
            if termino in mapa_registros:
                # Actualizar contador si existe
                registro = mapa_registros[termino]
                registro.contador += count
                registro.ultima_busqueda = now
            else:
                # Crear nuevo registro si no existe
                nuevo_registro = BusquedaTermino(
                    termino=termino,
                    contador=count,
                    ultima_busqueda=now
                )
                db.session.add(nuevo_registro)
        
        # Realizar el commit una sola vez para todo el lote
        db.session.commit()

    @staticmethod
    def top_terminos(limit=10):
        """
        Obtiene los términos de búsqueda más populares.

        Args:
            limit (int): El número máximo de términos a devolver.

        Returns:
            List[BusquedaTermino]: Una lista de las instancias de BusquedaTermino más buscadas.
        """
        return BusquedaTermino.query.order_by(
            BusquedaTermino.contador.desc()
        ).limit(limit).all()
