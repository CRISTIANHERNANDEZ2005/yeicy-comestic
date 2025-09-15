# app/models/serializers.py

def format_currency_cop(value):
    if value is None:
        return "$ 0"
    try:
        # Ensure value is a float before converting to int, to handle potential non-integer numbers
        # and to catch non-numeric strings that float() would fail on.
        float_value = float(value)
        # Convert to integer to remove decimals
        int_value = int(float_value)
        # Format with thousands separator and replace comma with dot
        return f"$ {int_value:,}".replace(",", ".")
    except (ValueError, TypeError):
        # Handle cases where value is not a valid number (e.g., "NaN", non-numeric string)
        return "$ NaN" # Or "$ 0" or some other indicator, but "$ NaN" is what the user reported.

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

    active_subcategories_count = 0
    total_products_in_main_category = 0
    subcategorias_data = []

    if hasattr(cat, 'subcategorias') and cat.subcategorias is not None:
        for sub in cat.subcategorias:
            sub_dict = subcategoria_to_dict(sub)
            subcategorias_data.append(sub_dict)
            if sub.estado == 'activo':
                active_subcategories_count += 1
            total_products_in_main_category += sub_dict.get('total_productos', 0)

    return {
        'id': cat.id,
        'nombre': cat.nombre,
        'slug': cat.slug,
        'descripcion': cat.descripcion,
        'estado': cat.estado,
        'created_at': cat.created_at.isoformat() if cat.created_at else None,
        'updated_at': cat.updated_at.isoformat() if cat.updated_at else None,
        'subcategorias': subcategorias_data,
        'active_subcategorias_count': active_subcategories_count,
        'total_productos': total_products_in_main_category
    }

def subcategoria_to_dict(sub):
    """Convierte un objeto Subcategoria a un diccionario."""
    if not sub:
        return None

    categoria_principal_nombre = None
    if hasattr(sub, 'categoria_principal') and sub.categoria_principal is not None:
        categoria_principal_nombre = sub.categoria_principal.nombre

    active_pseudocategories_count = 0
    total_products_in_subcategory = 0
    seudocategorias_data = []

    if hasattr(sub, 'seudocategorias') and sub.seudocategorias is not None:
        for seudo in sub.seudocategorias:
            seudo_dict = seudocategoria_to_dict(seudo)
            seudocategorias_data.append(seudo_dict)
            if seudo.estado == 'activo':
                active_pseudocategories_count += 1
            total_products_in_subcategory += seudo_dict.get('total_productos', 0)

    return {
        'id': sub.id,
        'nombre': sub.nombre,
        'slug': sub.slug,
        'descripcion': sub.descripcion,
        'categoria_principal_id': sub.categoria_principal_id,
        'categoria_principal_nombre': categoria_principal_nombre,
        'estado': sub.estado,
        'created_at': sub.created_at.isoformat() if sub.created_at else None,
        'updated_at': sub.updated_at.isoformat() if sub.updated_at else None,
        'seudocategorias': seudocategorias_data,
        'active_seudocategorias_count': active_pseudocategories_count,
        'total_productos': total_products_in_subcategory
    }

def seudocategoria_to_dict(seudo):
    """Convierte un objeto Seudocategoria a un diccionario."""
    if not seudo:
        return None

    subcategoria_nombre = None
    categoria_principal_nombre = None
    total_products_in_pseudocategory = 0

    if hasattr(seudo, 'subcategoria') and seudo.subcategoria is not None:
        subcategoria_nombre = seudo.subcategoria.nombre
        if hasattr(seudo.subcategoria, 'categoria_principal') and seudo.subcategoria.categoria_principal is not None:
            categoria_principal_nombre = seudo.subcategoria.categoria_principal.nombre
    
    if hasattr(seudo, 'productos') and seudo.productos is not None:
        print(f"Type of seudo.productos: {type(seudo.productos)}, Value of seudo.productos: {seudo.productos}") # Debug print
        total_products_in_pseudocategory = len(seudo.productos)

    return {
        'id': seudo.id,
        'nombre': seudo.nombre,
        'slug': seudo.slug,
        'descripcion': seudo.descripcion,
        'subcategoria_id': seudo.subcategoria_id,
        'subcategoria_nombre': subcategoria_nombre,
        'categoria_principal_nombre': categoria_principal_nombre,
        'estado': seudo.estado,
        'created_at': seudo.created_at.isoformat() if seudo.created_at else None,
        'updated_at': seudo.updated_at.isoformat() if seudo.updated_at else None,
        'total_productos': total_products_in_pseudocategory
    }

from datetime import datetime

def producto_to_dict(prod):
    """Convierte un objeto Producto a un diccionario con datos enriquecidos."""
    if not prod or prod.estado != 'activo':
        return None

    # --- Navegación de categorías ---
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if (seudocategoria := getattr(prod, 'seudocategoria', None)):
        seudocategoria_nombre = getattr(seudocategoria, 'nombre', None)
        seudocategoria_slug = getattr(seudocategoria, 'slug', None)
        if (subcategoria := getattr(seudocategoria, 'subcategoria', None)):
            subcategoria_nombre = getattr(subcategoria, 'nombre', None)
            subcategoria_slug = getattr(subcategoria, 'slug', None)
            if (categoria_principal := getattr(subcategoria, 'categoria_principal', None)):
                categoria_principal_nombre = getattr(
                    categoria_principal, 'nombre', None)
                categoria_principal_slug = getattr(
                    categoria_principal, 'slug', None)

    # --- Cálculos de negocio ---
    margen_ganancia = 0
    if prod.precio and prod.costo and prod.precio > 0:
        margen_ganancia = round(((prod.precio - prod.costo) / prod.precio) * 100, 2)

    antiguedad_dias = 0
    if prod.created_at:
        antiguedad_dias = (datetime.utcnow() - prod.created_at).days

    # --- Datos adicionales ---
    # Simulado, se necesitaría un modelo de ventas
    ventas_unidades = len(prod.reseñas) * 3 if hasattr(prod, 'reseñas') else 42

    existencia_porcentaje = 0
    if prod.existencia is not None and prod.stock_maximo is not None and prod.stock_maximo > 0:
        existencia_porcentaje = round((prod.existencia / prod.stock_maximo) * 100)

    return {
        'id': prod.id,
        'nombre': prod.nombre,
        'slug': prod.slug,
        'descripcion': prod.descripcion,
        'precio': prod.precio,
        'costo': prod.costo,
        'imagen_url': prod.imagen_url,
        'existencia': prod.existencia,  # Asegurar que el stock esté incluido
        'stock_minimo': prod.stock_minimo,
        'stock_maximo': prod.stock_maximo,
        'seudocategoria_id': prod.seudocategoria_id,
        'marca': prod.marca,
        'estado': prod.estado,
        'created_at': prod.created_at if prod.created_at else None,
        'updated_at': prod.updated_at.isoformat() if prod.updated_at else None,

        # Categorías
        'categoria_principal_nombre': categoria_principal_nombre,
        'subcategoria_nombre': subcategoria_nombre,
        'seudocategoria_nombre': seudocategoria_nombre,
        'categoria_principal_slug': categoria_principal_slug,
        'subcategoria_slug': subcategoria_slug,
        'seudocategoria_slug': seudocategoria_slug,

        # Datos de reseñas y calificaciones
        'calificacion_promedio': prod.calificacion_promedio_almacenada,
        'reseñas_count': len(prod.reseñas) if hasattr(prod, 'reseñas') else 0,

        # Indicadores y estado
        'es_nuevo': prod.es_nuevo,
        'agotado': prod.agotado,

        # Especificaciones
        'especificaciones': prod.especificaciones or {},

        # --- Campos Enriquecidos ---
        'margen_ganancia': margen_ganancia,
        'antiguedad_dias': antiguedad_dias,
        'ventas_unidades': ventas_unidades,
        'existencia_porcentaje': existencia_porcentaje
    }

def admin_producto_to_dict(prod):
    """Convierte un objeto Producto a un diccionario para la vista de admin, sin filtrar por estado."""
    if not prod:
        return None

    # --- Navegación de categorías ---
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if (seudocategoria := getattr(prod, 'seudocategoria', None)):
        seudocategoria_nombre = getattr(seudocategoria, 'nombre', None)
        seudocategoria_slug = getattr(seudocategoria, 'slug', None)
        if (subcategoria := getattr(seudocategoria, 'subcategoria', None)):
            subcategoria_nombre = getattr(subcategoria, 'nombre', None)
            subcategoria_slug = getattr(subcategoria, 'slug', None)
            if (categoria_principal := getattr(subcategoria, 'categoria_principal', None)):
                categoria_principal_nombre = getattr(
                    categoria_principal, 'nombre', None)
                categoria_principal_slug = getattr(
                    categoria_principal, 'slug', None)

    # --- Cálculos de negocio ---
    margen_ganancia = 0
    if prod.precio and prod.costo and prod.precio > 0:
        margen_ganancia = round(((prod.precio - prod.costo) / prod.precio) * 100, 2)

    antiguedad_dias = 0
    if prod.created_at:
        antiguedad_dias = (datetime.utcnow() - prod.created_at).days

    # --- Datos adicionales ---
    # Simulado, se necesitaría un modelo de ventas
    ventas_unidades = len(prod.reseñas) * 3 if hasattr(prod, 'reseñas') else 42

    existencia_porcentaje = 0
    if prod.existencia is not None and prod.stock_maximo is not None and prod.stock_maximo > 0:
        existencia_porcentaje = round((prod.existencia / prod.stock_maximo) * 100)

    return {
        'id': prod.id,
        'nombre': prod.nombre,
        'slug': prod.slug,
        'descripcion': prod.descripcion,
        'precio': prod.precio,
        'costo': prod.costo,
        'imagen_url': prod.imagen_url,
        'existencia': prod.existencia,
        'stock_minimo': prod.stock_minimo,
        'stock_maximo': prod.stock_maximo,
        'seudocategoria_id': prod.seudocategoria_id,
        'marca': prod.marca,
        'estado': prod.estado,
        'created_at': prod.created_at if prod.created_at else None,
        'updated_at': prod.updated_at.isoformat() if prod.updated_at else None,

        # Categorías
        'categoria_principal_nombre': categoria_principal_nombre,
        'subcategoria_nombre': subcategoria_nombre,
        'seudocategoria_nombre': seudocategoria_nombre,
        'categoria_principal_slug': categoria_principal_slug,
        'subcategoria_slug': subcategoria_slug,
        'seudocategoria_slug': seudocategoria_slug,

        # Datos de reseñas y calificaciones
        'calificacion_promedio': prod.calificacion_promedio_almacenada,
        'reseñas_count': len(prod.reseñas) if hasattr(prod, 'reseñas') else 0,

        # Indicadores y estado
        'es_nuevo': prod.es_nuevo,
        'agotado': prod.agotado,

        # Especificaciones
        'especificaciones': prod.especificaciones or {},

        # --- Campos Enriquecidos ---
        'margen_ganancia': margen_ganancia,
        'antiguedad_dias': antiguedad_dias,
        'ventas_unidades': ventas_unidades,
        'existencia_porcentaje': existencia_porcentaje
    }


def producto_list_to_dict(prod):
    """Convierte un objeto Producto a un diccionario para la lista de productos (excluye id)."""
    if not prod:
        return None
        
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if (seudocategoria := getattr(prod, 'seudocategoria', None)):
        seudocategoria_nombre = getattr(seudocategoria, 'nombre', None)
        seudocategoria_slug = getattr(seudocategoria, 'slug', None)
        if (subcategoria := getattr(seudocategoria, 'subcategoria', None)):
            subcategoria_nombre = getattr(subcategoria, 'nombre', None)
            subcategoria_slug = getattr(subcategoria, 'slug', None)
            if (categoria_principal := getattr(subcategoria, 'categoria_principal', None)):
                categoria_principal_nombre = getattr(categoria_principal, 'nombre', None)
                categoria_principal_slug = getattr(categoria_principal, 'slug', None)

    return {
        'id': prod.id,
        'nombre': prod.nombre,
        'slug': prod.slug,
        'descripcion': prod.descripcion,
        'precio': prod.precio,
        'costo': prod.costo,
        'imagen_url': prod.imagen_url,
        'existencia': prod.existencia,
        'stock_minimo': prod.stock_minimo,
        'stock_maximo': prod.stock_maximo,
        'seudocategoria_id': prod.seudocategoria_id,
        'marca': prod.marca,
        'estado': prod.estado,
        'created_at': prod.created_at if prod.created_at else None,
        'updated_at': prod.updated_at.isoformat() if prod.updated_at else None,
        'categoria_principal_nombre': categoria_principal_nombre,
        'subcategoria_nombre': subcategoria_nombre,
        'seudocategoria_nombre': seudocategoria_nombre,
        'categoria_principal_slug': categoria_principal_slug,
        'subcategoria_slug': subcategoria_slug,
        'seudocategoria_slug': seudocategoria_slug,
        'calificacion_promedio': prod.calificacion_promedio_almacenada,
        'es_nuevo': prod.es_nuevo,
        'reseñas_count': len(prod.reseñas) if hasattr(prod, 'reseñas') else 0,
        'especificaciones': prod.especificaciones or {},
        'agotado': prod.agotado
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
        'created_at': resena.created_at,
        'updated_at': resena.updated_at
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
            'precio': item.product.precio,
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
        'subtotal': item.subtotal
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

def pedido_to_dict(pedido):
    """Convierte un objeto Pedido a un diccionario."""
    if not pedido:
        return None
        
    usuario_nombre = None
    if pedido.usuario:
        usuario_nombre = f"{pedido.usuario.nombre} {pedido.usuario.apellido}"

    return {
        'id': pedido.id,
        'usuario_id': pedido.usuario_id,
        'usuario_nombre': usuario_nombre,
        'total': pedido.total,
        'estado_pedido': pedido.estado_pedido,
        'estado': pedido.estado,
        'created_at': pedido.created_at.isoformat() if pedido.created_at else None,
        'updated_at': pedido.updated_at.isoformat() if pedido.updated_at else None,
        'productos_count': len(pedido.productos) if pedido.productos else 0
    }

def pedido_detalle_cliente_to_dict(pedido):
    """Convierte un objeto Pedido a un diccionario con detalles completos."""
    if not pedido:
        return None
        
    usuario_info = None
    if pedido.usuario:
        usuario_info = {
            'id': pedido.usuario.id,
            'nombre': pedido.usuario.nombre,
            'apellido': pedido.usuario.apellido,
            'numero': pedido.usuario.numero
        }

    productos_info = []
    calculated_total = 0
    
    if pedido.productos:
        for pp in pedido.productos:
            subtotal = pp.cantidad * pp.precio_unitario
            calculated_total += subtotal
            
            productos_info.append({
                'producto_id': pp.producto_id,
                'producto_nombre': pp.producto.nombre if pp.producto else 'Producto no disponible',
                'producto_imagen_url': pp.producto.imagen_url if pp.producto else None,
                'producto_marca': pp.producto.marca if pp.producto else 'N/A',
                'producto_existencia': pp.producto.existencia if pp.producto else 0,
                'cantidad': pp.cantidad,
                'precio_unitario': pp.precio_unitario,
                'subtotal': subtotal
            })

    # Asegurarnos de que pedido.total sea un número válido
    try:
        final_total = float(pedido.total) if pedido.total is not None else calculated_total
    except (ValueError, TypeError):
        final_total = calculated_total

    return {
        'id': pedido.id,
        'usuario': usuario_info,
        'subtotal_productos': calculated_total, # Nuevo campo para el subtotal de los productos
        'total': final_total,
        'estado_pedido': pedido.estado_pedido,
        'estado': pedido.estado,
        'created_at': pedido.created_at if pedido.created_at else None,
        'updated_at': pedido.updated_at if pedido.updated_at else None,
        'productos': productos_info,
        'productos_count': len(productos_info)
    }

def pedido_detalle_to_dict(pedido):
    """Convierte un objeto Pedido a un diccionario con detalles completos."""
    if not pedido:
        return None
        
    usuario_info = None
    if pedido.usuario:
        usuario_info = {
            'id': pedido.usuario.id,
            'nombre': pedido.usuario.nombre,
            'apellido': pedido.usuario.apellido,
            'numero': pedido.usuario.numero
        }

    productos_info = []
    if pedido.productos:
        for pp in pedido.productos:
            productos_info.append({
                'producto_id': pp.producto_id,
                'producto_nombre': pp.producto.nombre if pp.producto else 'Producto no disponible',
                'producto_imagen_url': pp.producto.imagen_url if pp.producto else None,
                'producto_marca': pp.producto.marca if pp.producto else 'N/A',  # Añadimos esta línea
                'producto_existencia': pp.producto.existencia if pp.producto else 0,
                'cantidad': pp.cantidad,
                'precio_unitario': pp.precio_unitario,
                'subtotal': pp.cantidad * pp.precio_unitario
            })

    return {
        'id': pedido.id,
        'usuario': usuario_info,
        'total': pedido.total,
        'estado_pedido': pedido.estado_pedido,
        'estado': pedido.estado,
        'created_at': pedido.created_at.isoformat() if pedido.created_at else None,
        'updated_at': pedido.updated_at.isoformat() if pedido.updated_at else None,
        'productos': productos_info,
        'productos_count': len(productos_info)  # Añadimos esta línea
    }