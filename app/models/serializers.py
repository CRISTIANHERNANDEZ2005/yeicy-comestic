# app/models/serializers.py

def usuario_to_dict(usuario):
    """Convierte un objeto Usuario a un diccionario."""
    if not usuario:
        return None
    return {
        'id': usuario.id,
        'numero': usuario.numero,
        'nombre': usuario.nombre,
        'apellido': usuario.apellido,
        'estado': usuario.estado,
        'created_at': usuario.created_at.isoformat() if usuario.created_at else None,
        'updated_at': usuario.updated_at.isoformat() if usuario.updated_at else None
    }

def usuario_publico_to_dict(usuario):
    """Convierte un objeto Usuario a un diccionario con su información pública."""
    if not usuario:
        return None
    return {
        'id': usuario.id,
        'nombre': usuario.nombre,
        'apellido': usuario.apellido,
    }

def admin_to_dict(admin):
    """Convierte un objeto Admin a un diccionario."""
    if not admin:
        return None
    return {
        'id': admin.id,
        'cedula': admin.cedula,
        'nombre': admin.nombre,
        'apellido': admin.apellido,
        'numero_telefono': admin.numero_telefono,
        'estado': admin.estado,
        'created_at': admin.created_at.isoformat() if admin.created_at else None,
        'updated_at': admin.updated_at.isoformat() if admin.updated_at else None
    }

def categoria_principal_to_dict(cat):
    """Convierte un objeto CategoriaPrincipal a un diccionario."""
    if not cat:
        return None
    return {
        'id': cat.id,
        'nombre': cat.nombre,
        'descripcion': cat.descripcion,
        'estado': cat.estado,
        'created_at': cat.created_at.isoformat() if cat.created_at else None,
        'updated_at': cat.updated_at.isoformat() if cat.updated_at else None
    }

def subcategoria_to_dict(sub):
    """Convierte un objeto Subcategoria a un diccionario."""
    if not sub:
        return None
    return {
        'id': sub.id,
        'nombre': sub.nombre,
        'descripcion': sub.descripcion,
        'categoria_principal_id': sub.categoria_principal_id,
        'estado': sub.estado,
        'created_at': sub.created_at.isoformat() if sub.created_at else None,
        'updated_at': sub.updated_at.isoformat() if sub.updated_at else None
    }

def seudocategoria_to_dict(seudo):
    """Convierte un objeto Seudocategoria a un diccionario."""
    if not seudo:
        return None
    return {
        'id': seudo.id,
        'nombre': seudo.nombre,
        'descripcion': seudo.descripcion,
        'subcategoria_id': seudo.subcategoria_id,
        'estado': seudo.estado,
        'created_at': seudo.created_at.isoformat() if seudo.created_at else None,
        'updated_at': seudo.updated_at.isoformat() if seudo.updated_at else None
    }

def producto_to_dict(prod):
    """Convierte un objeto Producto a un diccionario."""
    if not prod:
        return None
        
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None

    if (seudocategoria := getattr(prod, 'seudocategoria', None)):
        seudocategoria_nombre = getattr(seudocategoria, 'nombre', None)
        if (subcategoria := getattr(seudocategoria, 'subcategoria', None)):
            subcategoria_nombre = getattr(subcategoria, 'nombre', None)
            if (categoria_principal := getattr(subcategoria, 'categoria_principal', None)):
                categoria_principal_nombre = getattr(categoria_principal, 'nombre', None)

    return {
        'id': prod.id,
        'nombre': prod.nombre,
        'slug': prod.slug,
        'descripcion': prod.descripcion,
        'precio': float(prod.precio) if prod.precio is not None else 0.0,
        'imagen_url': prod.imagen_url,
        'existencia': prod.existencia,
        'stock_minimo': prod.stock_minimo,
        'stock_maximo': prod.stock_maximo,
        'seudocategoria_id': prod.seudocategoria_id,
        'marca': prod.marca,
        'estado': prod.estado,
        'created_at': prod.created_at.isoformat() if prod.created_at else None,
        'updated_at': prod.updated_at.isoformat() if prod.updated_at else None,
        'categoria_principal_nombre': categoria_principal_nombre,
        'subcategoria_nombre': subcategoria_nombre,
        'seudocategoria_nombre': seudocategoria_nombre,
        'calificacion_promedio': prod.calificacion_promedio_almacenada,
        'es_nuevo': prod.es_nuevo,
        'reseñas_count': len(prod.reseñas) if hasattr(prod, 'reseñas') else 0
    }

def like_to_dict(like):
    """Convierte un objeto Like a un diccionario."""
    if not like:
        return None
    return {
        'id': like.id,
        'usuario_id': like.usuario_id,
        'producto_id': like.producto_id,
        'estado': like.estado,
        'created_at': like.created_at.isoformat() if like.created_at else None,
        'updated_at': like.updated_at.isoformat() if like.updated_at else None
    }

def resena_to_dict(resena):
    """Convierte un objeto Reseña a diccionario con información completa."""
    if not resena:
        return None
    return {
        'id': resena.id,
        'usuario': usuario_publico_to_dict(resena.usuario),
        'texto': resena.texto,
        'titulo': resena.titulo,
        'calificacion': resena.calificacion,
        'created_at': resena.created_at.isoformat() if resena.created_at else None,
        'updated_at': resena.updated_at.isoformat() if resena.updated_at else None
    }


def cart_item_to_dict(item):
    """Convierte un objeto CartItem a un diccionario."""
    if not item:
        return None
        
    product_info = None
    if item.product:
        product_info = {
            'id': item.product.id,
            'nombre': item.product.nombre,
            'precio': float(item.product.precio) if item.product.precio is not None else 0.0,
            'imagen_url': item.product.imagen_url,
            'marca': item.product.marca,
            'existencia': item.product.existencia
        }

    return {
        'id': item.id,
        'user_id': item.user_id,
        'session_id': item.session_id,
        'product_id': item.product_id,
        'quantity': item.quantity,
        'created_at': item.created_at.isoformat() if item.created_at else None,
        'updated_at': item.updated_at.isoformat() if item.updated_at else None,
        'product': product_info,
        'subtotal': float(item.subtotal) if item.subtotal is not None else 0.0
    }

def busqueda_termino_to_dict(busq):
    """Convierte un objeto BusquedaTermino a un diccionario."""
    if not busq:
        return None
    return {
        'id': busq.id,
        'termino': busq.termino,
        'contador': busq.contador,
        'created_at': busq.created_at.isoformat() if busq.created_at else None,
        'updated_at': busq.updated_at.isoformat() if busq.updated_at else None,
        'ultima_busqueda': busq.ultima_busqueda.isoformat() if busq.ultima_busqueda else None
    }