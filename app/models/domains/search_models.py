# Serializadores
from app.models.serializers import busqueda_termino_to_dict
from app.extensions import db
from datetime import datetime
from app.models.mixins import TimestampMixin
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional

class BusquedaTermino(TimestampMixin,db.Model):

    __tablename__ = 'busqueda_terminos'

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    termino: Mapped[str] = mapped_column(db.String(255), nullable=False, unique=True)
    contador: Mapped[int] = mapped_column(db.Integer, default=1)
    ultima_busqueda: Mapped[Optional[datetime]] = mapped_column(db.DateTime, default=datetime.utcnow)

    def __init__(self, termino, contador=1, ultima_busqueda=None, id=None):
        if not termino or not termino.strip():
            raise ValueError("El término no puede estar vacío")
        self.termino = termino.strip().lower()
        self.contador = contador
        self.ultima_busqueda = ultima_busqueda or datetime.utcnow()
        if id is not None:
            self.id = id
    
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
    def registrar_batch(terminos):
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
        return BusquedaTermino.query.order_by(
            BusquedaTermino.contador.desc()
        ).limit(limit).all()
