# app/models/serializers.py

def usuario_to_dict(usuario):
    return {
        'id': usuario.id,
        'numero': usuario.numero,
        'nombre': usuario.nombre,
        'apellido': usuario.apellido,
        'estado': usuario.estado,
        'created_at': usuario.created_at.isoformat() if usuario.created_at else None,
        'updated_at': usuario.updated_at.isoformat() if usuario.updated_at else None
    }

def admin_to_dict(admin):
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
    return {
        'id': cat.id,
        'nombre': cat.nombre,
        'descripcion': cat.descripcion,
        'estado': cat.estado,
        'created_at': cat.created_at.isoformat() if cat.created_at else None,
        'updated_at': cat.updated_at.isoformat() if cat.updated_at else None
    }

def subcategoria_to_dict(sub):
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
    return {
        'id': prod.id,
        'nombre': prod.nombre,
        'descripcion': prod.descripcion,
        'precio': prod.precio,
        'imagen_url': prod.imagen_url,
        'stock': prod.stock,
        'seudocategoria_id': prod.seudocategoria_id,
        'marca': prod.marca,
        'estado': prod.estado,
        'created_at': prod.created_at.isoformat() if prod.created_at else None,
        'updated_at': prod.updated_at.isoformat() if prod.updated_at else None
    }

def like_to_dict(like):
    return {
        'id': like.id,
        'usuario_id': like.usuario_id,
        'producto_id': like.producto_id,
        'estado': like.estado,
        'created_at': like.created_at.isoformat() if like.created_at else None,
        'updated_at': like.updated_at.isoformat() if like.updated_at else None
    }

def resena_to_dict(resena):
    return {
        'id': resena.id,
        'usuario_id': resena.usuario_id,
        'producto_id': resena.producto_id,
        'texto': resena.texto,
        'calificacion': resena.calificacion,
        'estado': resena.estado,
        'created_at': resena.created_at.isoformat() if resena.created_at else None,
        'updated_at': resena.updated_at.isoformat() if resena.updated_at else None
    }

def cart_session_to_dict(session):
    return {
        'id': session.id,
        'created_at': session.created_at.isoformat() if session.created_at else None,
        'updated_at': session.updated_at.isoformat() if session.updated_at else None,
        'expires_at': session.expires_at.isoformat() if session.expires_at else None,
        'items': session.items
    }

def cart_item_to_dict(item):
    return {
        'id': item.id,
        'user_id': item.user_id,
        'session_id': item.session_id,
        'product_id': item.product_id,
        'quantity': item.quantity,
        'created_at': item.created_at.isoformat() if item.created_at else None,
        'updated_at': item.updated_at.isoformat() if item.updated_at else None,
        'product': {
            'id': item.product.id,
            'nombre': item.product.nombre,
            'precio': float(item.product.precio),
            'imagen_url': item.product.imagen_url,
            'marca': item.product.marca,
            'stock': item.product.stock
        } if item.product else None,
        'subtotal': float(item.subtotal) if item.product else 0.0
    }

def busqueda_termino_to_dict(busq):
    return {
        'id': busq.id,
        'termino': busq.termino,
        'contador': busq.contador,
        'created_at': busq.created_at.isoformat() if busq.created_at else None,
        'updated_at': busq.updated_at.isoformat() if busq.updated_at else None,
        'ultima_busqueda': busq.ultima_busqueda.isoformat() if busq.ultima_busqueda else None
    }
