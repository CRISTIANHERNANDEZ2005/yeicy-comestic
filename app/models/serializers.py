"""
Módulo de Serializadores de Modelos.

Este archivo contiene funciones dedicadas a convertir objetos de modelos de SQLAlchemy
en diccionarios de Python. Esta serialización es un paso esencial para transformar
los datos de la base de datos en un formato JSON que pueda ser enviado a través de APIs
al frontend o a otros servicios.
"""

# --- Importaciones de la Librería Estándar ---
from datetime import datetime

from sqlalchemy import func

from app.extensions import db
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.enums import EstadoPedido


def format_currency_cop(value):
    """
    Formatea un valor numérico como una cadena de moneda en pesos colombianos (COP).

    Args:
        value (Union[int, float, None]): El valor numérico a formatear.

    Returns:
        str: Una cadena formateada como '$ 1.234.567'. Devuelve '$ 0' si el valor es None
             y '$ NaN' si el valor no es un número válido.
    """
    if value is None:
        return "$ 0"
    try:
        # Asegura que el valor sea un float antes de convertirlo a int, para manejar números no enteros
        # y capturar cadenas no numéricas en las que float() fallaría.
        float_value = float(value)
        # Convierte a entero para eliminar decimales.
        int_value = int(float_value)
        # Formatea con separador de miles y reemplaza la coma por un punto.
        return f"$ {int_value:,}".replace(",", ".")
    except (ValueError, TypeError):
        # Maneja casos donde el valor no es un número válido (ej. "NaN", cadena no numérica).
        return "$ NaN"


def usuario_to_dict(usuario):
    """Serializa un objeto Usuario a un diccionario para uso interno o de administrador."""
    if not usuario:
        return None
    return {
        "id": usuario.id,
        "numero": usuario.numero,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "estado": usuario.estado,
        "created_at": usuario.created_at.isoformat() if usuario.created_at else None,
        "updated_at": usuario.updated_at.isoformat() if usuario.updated_at else None,
    }


def usuario_publico_to_dict(usuario):
    """Serializa un objeto Usuario a un diccionario con su información pública, ideal para vistas de cliente."""
    if not usuario:
        return None
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "avatar_url": usuario.avatar_url if hasattr(usuario, "avatar_url") else None,
    }


def admin_to_dict(admin):
    """Serializa un objeto Admin a un diccionario."""
    if not admin:
        return None
    return {
        "id": admin.id,
        "cedula": admin.cedula,
        "nombre": admin.nombre,
        "apellido": admin.apellido,
        "numero_telefono": admin.numero_telefono,
        "estado": admin.estado,
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
        "updated_at": admin.updated_at.isoformat() if admin.updated_at else None,
    }


def categoria_principal_to_dict(cat):
    """
    Serializa un objeto CategoriaPrincipal a un diccionario.

    Este serializador es recursivo: invoca a `subcategoria_to_dict` para cada una de
    sus subcategorías, construyendo un árbol de datos completo. Además, calcula
    métricas agregadas como el conteo de subcategorías activas y el total de productos
    en toda la categoría principal.

    Returns:
        dict: Un diccionario que representa la categoría principal, sus subcategorías
              y los datos agregados.
    """
    if not cat:
        return None

    active_subcategories_count = 0
    total_products_in_main_category = 0
    subcategorias_data = []

    if hasattr(cat, "subcategorias") and cat.subcategorias is not None:
        for sub in cat.subcategorias:
            sub_dict = subcategoria_to_dict(sub)
            subcategorias_data.append(sub_dict)
            if sub.estado == "activo":
                active_subcategories_count += 1
            total_products_in_main_category += sub_dict.get("total_productos", 0)

    return {
        "id": cat.id,
        "nombre": cat.nombre,
        "slug": cat.slug,
        "descripcion": cat.descripcion,
        "estado": cat.estado,
        "created_at": cat.created_at.isoformat() if cat.created_at else None,
        "updated_at": cat.updated_at.isoformat() if cat.updated_at else None,
        "subcategorias": subcategorias_data,
        "active_subcategorias_count": active_subcategories_count,
        "total_productos": total_products_in_main_category,
    }


def subcategoria_to_dict(sub):
    """
    Serializa un objeto Subcategoria a un diccionario.

    De forma similar a `categoria_principal_to_dict`, este serializador es recursivo
    y construye parte del árbol de categorías. Obtiene información del padre
    (nombre de la categoría principal) y calcula métricas agregadas de sus hijos,
    como el conteo de seudocategorías activas y el total de productos.

    Returns:
        dict: Un diccionario que representa la subcategoría, sus seudocategorías,
              información del padre y datos agregados.
    """
    if not sub:
        return None

    categoria_principal_nombre = None
    if hasattr(sub, "categoria_principal") and sub.categoria_principal is not None:
        categoria_principal_nombre = sub.categoria_principal.nombre

    active_pseudocategories_count = 0
    total_products_in_subcategory = 0
    seudocategorias_data = []

    if hasattr(sub, "seudocategorias") and sub.seudocategorias is not None:
        for seudo in sub.seudocategorias:
            seudo_dict = seudocategoria_to_dict(seudo)
            seudocategorias_data.append(seudo_dict)
            if seudo.estado == "activo":
                active_pseudocategories_count += 1
            total_products_in_subcategory += seudo_dict.get("total_productos", 0)

    return {
        "id": sub.id,
        "nombre": sub.nombre,
        "slug": sub.slug,
        "descripcion": sub.descripcion,
        "categoria_principal_id": sub.categoria_principal_id,
        "categoria_principal_nombre": categoria_principal_nombre,
        "estado": sub.estado,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
        "seudocategorias": seudocategorias_data,
        "active_seudocategorias_count": active_pseudocategories_count,
        "total_productos": total_products_in_subcategory,
    }


def seudocategoria_to_dict(seudo):
    """
    Serializa un objeto Seudocategoria a un diccionario.

    Este es el nivel más bajo de la jerarquía de categorías. El serializador enriquece
    el objeto con los nombres de sus ancestros (subcategoría y categoría principal)
    para facilitar la navegación y la presentación en la UI. También calcula el
    número total de productos que pertenecen directamente a ella.

    Returns:
        dict: Un diccionario que representa la seudocategoría y su contexto jerárquico.
    """
    if not seudo:
        return None

    subcategoria_nombre = None
    categoria_principal_nombre = None
    total_products_in_pseudocategory = 0

    if hasattr(seudo, "subcategoria") and seudo.subcategoria is not None:
        subcategoria_nombre = seudo.subcategoria.nombre
        if (
            hasattr(seudo.subcategoria, "categoria_principal")
            and seudo.subcategoria.categoria_principal is not None
        ):
            categoria_principal_nombre = seudo.subcategoria.categoria_principal.nombre

    if hasattr(seudo, "productos") and seudo.productos is not None:
        # NOTA PROFESIONAL: Esta línea es la que causa el problema N+1 si los productos
        # no se cargan de forma ansiosa (eager loading) con subqueryload o joinedload
        # en la consulta principal. La solución se aplica en la vista que llama a este
        # serializador, no aquí directamente.
        total_products_in_pseudocategory = len(seudo.productos)

    return {
        "id": seudo.id,
        "nombre": seudo.nombre,
        "slug": seudo.slug,
        "descripcion": seudo.descripcion,
        "subcategoria_id": seudo.subcategoria_id,
        "subcategoria_nombre": subcategoria_nombre,
        "categoria_principal_nombre": categoria_principal_nombre,
        "estado": seudo.estado,
        "created_at": seudo.created_at.isoformat() if seudo.created_at else None,
        "updated_at": seudo.updated_at.isoformat() if seudo.updated_at else None,
        "total_productos": total_products_in_pseudocategory,
    }


def producto_to_dict(prod):
    """
    Serializa un objeto Producto para la vista pública del cliente.

    Este es un serializador clave que no solo expone los datos del producto, sino que
    también los enriquece con información calculada y de contexto para la UI.

    Características importantes:
    - **Filtrado de Estado**: Devuelve `None` si el producto no está 'activo', asegurando
      que solo productos visibles se muestren al cliente.
    - **Navegación de Categorías**: Extrae los nombres y slugs de toda la jerarquía
      de categorías (principal, sub, seudo) para construir breadcrumbs y URLs.
    - **Datos Enriquecidos**: Calcula métricas de negocio como `margen_ganancia`,
      `antiguedad_dias`, `ventas_unidades` (simulado) y `existencia_porcentaje`.

    Returns:
        Optional[dict]: Un diccionario con los datos completos y enriquecidos del producto,
                        o `None` si el producto no es apto para la vista pública.
    """
    if not prod or prod.estado != "activo":
        return None

    # --- Navegación de categorías ---
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if seudocategoria := getattr(prod, "seudocategoria", None):
        seudocategoria_nombre = getattr(seudocategoria, "nombre", None)
        seudocategoria_slug = getattr(seudocategoria, "slug", None)
        if subcategoria := getattr(seudocategoria, "subcategoria", None):
            subcategoria_nombre = getattr(subcategoria, "nombre", None)
            subcategoria_slug = getattr(subcategoria, "slug", None)
            if categoria_principal := getattr(
                subcategoria, "categoria_principal", None
            ):
                categoria_principal_nombre = getattr(
                    categoria_principal, "nombre", None
                )
                categoria_principal_slug = getattr(categoria_principal, "slug", None)

    # --- Cálculos de negocio ---
    margen_ganancia = 0
    if prod.precio and prod.costo and prod.precio > 0:
        margen_ganancia = round(((prod.precio - prod.costo) / prod.precio) * 100, 2)

    antiguedad_dias = 0
    if prod.created_at:
        antiguedad_dias = (datetime.utcnow() - prod.created_at).days

    # --- Datos adicionales ---
    # --- Ventas Reales ---
    # Se realiza una subconsulta para obtener las ventas y los ingresos de forma eficiente.
    # Se filtran solo los pedidos que han sido completados.
    sales_data = (
        db.session.query(
            func.sum(PedidoProducto.cantidad).label("unidades_vendidas"),
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label(
                "ingresos_totales"
            ),
        )
        .join(Pedido, Pedido.id == PedidoProducto.pedido_id)
        .filter(
            PedidoProducto.producto_id == prod.id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
        )
        .first()
    )

    ventas_unidades = (
        int(sales_data.unidades_vendidas) if sales_data.unidades_vendidas else 0
    )
    ingresos_totales = (
        float(sales_data.ingresos_totales) if sales_data.ingresos_totales else 0.0
    )

    existencia_porcentaje = 0
    if (
        prod.existencia is not None
        and prod.stock_maximo is not None
        and prod.stock_maximo > 0
    ):
        existencia_porcentaje = round((prod.existencia / prod.stock_maximo) * 100)

    return {
        "id": prod.id,
        "nombre": prod.nombre,
        "slug": prod.slug,
        "descripcion": prod.descripcion,
        "precio": prod.precio,
        "costo": prod.costo,
        "imagen_url": prod.imagen_url,
        "existencia": prod.existencia,  # Asegurar que el stock esté incluido
        "stock_minimo": prod.stock_minimo,
        "stock_maximo": prod.stock_maximo,
        "seudocategoria_id": prod.seudocategoria_id,
        "marca": prod.marca,
        "estado": prod.estado,
        "created_at": prod.created_at if prod.created_at else None,
        "updated_at": prod.updated_at.isoformat() if prod.updated_at else None,
        # Categorías
        "categoria_principal_nombre": categoria_principal_nombre,
        "subcategoria_nombre": subcategoria_nombre,
        "seudocategoria_nombre": seudocategoria_nombre,
        "categoria_principal_slug": categoria_principal_slug,
        "subcategoria_slug": subcategoria_slug,
        "seudocategoria_slug": seudocategoria_slug,
        # Datos de reseñas y calificaciones
        "calificacion_promedio": prod.calificacion_promedio_almacenada,
        "reseñas_count": len(prod.reseñas) if hasattr(prod, "reseñas") else 0,
        # Indicadores y estado
        "es_nuevo": prod.es_nuevo,
        "agotado": prod.agotado,
        # Especificaciones
        "especificaciones": prod.especificaciones or {},
        # --- Campos Enriquecidos ---
        "margen_ganancia": margen_ganancia,
        "antiguedad_dias": antiguedad_dias,
        "ventas_unidades": ventas_unidades,
        "ingresos_totales": ingresos_totales,
        "existencia_porcentaje": existencia_porcentaje,
    }


def admin_producto_to_dict(prod):
    """
    Serializa un objeto Producto para la vista de administrador.

    Es funcionalmente idéntico a `producto_to_dict` pero con una diferencia crucial:
    **no filtra por estado**. Esto permite que el panel de administración muestre
    y gestione tanto productos activos como inactivos.

    Returns:
        Optional[dict]: Un diccionario con los datos completos y enriquecidos del producto,
                        independientemente de su estado. `None` si el producto no existe.
    """
    if not prod:
        return None

    # --- Navegación de categorías ---
    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if seudocategoria := getattr(prod, "seudocategoria", None):
        seudocategoria_nombre = getattr(seudocategoria, "nombre", None)
        seudocategoria_slug = getattr(seudocategoria, "slug", None)
        if subcategoria := getattr(seudocategoria, "subcategoria", None):
            subcategoria_nombre = getattr(subcategoria, "nombre", None)
            subcategoria_slug = getattr(subcategoria, "slug", None)
            if categoria_principal := getattr(
                subcategoria, "categoria_principal", None
            ):
                categoria_principal_nombre = getattr(
                    categoria_principal, "nombre", None
                )
                categoria_principal_slug = getattr(categoria_principal, "slug", None)

    # --- Cálculos de negocio ---
    margen_ganancia = 0
    if prod.precio and prod.costo and prod.precio > 0:
        margen_ganancia = round(((prod.precio - prod.costo) / prod.precio) * 100, 2)

    antiguedad_dias = 0
    if prod.created_at:
        antiguedad_dias = (datetime.utcnow() - prod.created_at).days

    # --- Ventas Reales ---
    # Se realiza una subconsulta para obtener las ventas y los ingresos de forma eficiente.
    # Se filtran solo los pedidos que han sido completados.
    sales_data = (
        db.session.query(
            func.sum(PedidoProducto.cantidad).label("unidades_vendidas"),
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label(
                "ingresos_totales"
            ),
        )
        .join(Pedido, Pedido.id == PedidoProducto.pedido_id)
        .filter(
            PedidoProducto.producto_id == prod.id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
        )
        .first()
    )

    ventas_unidades = (
        int(sales_data.unidades_vendidas) if sales_data.unidades_vendidas else 0
    )
    ingresos_totales = (
        float(sales_data.ingresos_totales) if sales_data.ingresos_totales else 0.0
    )

    existencia_porcentaje = 0
    if (
        prod.existencia is not None
        and prod.stock_maximo is not None
        and prod.stock_maximo > 0
    ):
        existencia_porcentaje = round((prod.existencia / prod.stock_maximo) * 100)

    return {
        "id": prod.id,
        "nombre": prod.nombre,
        "slug": prod.slug,
        "descripcion": prod.descripcion,
        "precio": prod.precio,
        "costo": prod.costo,
        "imagen_url": prod.imagen_url,
        "existencia": prod.existencia,
        "stock_minimo": prod.stock_minimo,
        "stock_maximo": prod.stock_maximo,
        "seudocategoria_id": prod.seudocategoria_id,
        "marca": prod.marca,
        "estado": prod.estado,
        "created_at": prod.created_at if prod.created_at else None,
        "updated_at": prod.updated_at.isoformat() if prod.updated_at else None,
        # Categorías
        "categoria_principal_nombre": categoria_principal_nombre,
        "subcategoria_nombre": subcategoria_nombre,
        "seudocategoria_nombre": seudocategoria_nombre,
        "categoria_principal_slug": categoria_principal_slug,
        "subcategoria_slug": subcategoria_slug,
        "seudocategoria_slug": seudocategoria_slug,
        # Datos de reseñas y calificaciones
        "calificacion_promedio": prod.calificacion_promedio_almacenada,
        "reseñas_count": len(prod.reseñas) if hasattr(prod, "reseñas") else 0,
        # Indicadores y estado
        "es_nuevo": prod.es_nuevo,
        "agotado": prod.agotado,
        # Especificaciones
        "especificaciones": prod.especificaciones or {},
        # --- Campos Enriquecidos ---
        "margen_ganancia": margen_ganancia,
        "antiguedad_dias": antiguedad_dias,
        "ventas_unidades": ventas_unidades,
        "ingresos_totales": ingresos_totales,
        "existencia_porcentaje": existencia_porcentaje,
    }


def producto_list_to_dict(prod):
    """
    Serializa un objeto Producto a un diccionario optimizado para listas.

    Esta versión del serializador está diseñada para ser ligera y rápida, ideal para
    renderizar grandes volúmenes de productos en páginas de listado o resultados de
    búsqueda. Excluye campos pesados o innecesarios para una vista de lista.

    Returns:
        Optional[dict]: Un diccionario con un subconjunto de datos del producto.
    """
    if not prod:
        return None

    categoria_principal_nombre = None
    subcategoria_nombre = None
    seudocategoria_nombre = None
    categoria_principal_slug = None
    subcategoria_slug = None
    seudocategoria_slug = None

    if seudocategoria := getattr(prod, "seudocategoria", None):
        seudocategoria_nombre = getattr(seudocategoria, "nombre", None)
        seudocategoria_slug = getattr(seudocategoria, "slug", None)
        if subcategoria := getattr(seudocategoria, "subcategoria", None):
            subcategoria_nombre = getattr(subcategoria, "nombre", None)
            subcategoria_slug = getattr(subcategoria, "slug", None)
            if categoria_principal := getattr(
                subcategoria, "categoria_principal", None
            ):
                categoria_principal_nombre = getattr(
                    categoria_principal, "nombre", None
                )
                categoria_principal_slug = getattr(categoria_principal, "slug", None)

    return {
        "id": prod.id,
        "nombre": prod.nombre,
        "slug": prod.slug,
        "descripcion": prod.descripcion,
        "precio": prod.precio,
        "costo": prod.costo,
        "imagen_url": prod.imagen_url,
        "existencia": prod.existencia,
        "stock_minimo": prod.stock_minimo,
        "stock_maximo": prod.stock_maximo,
        "seudocategoria_id": prod.seudocategoria_id,
        "marca": prod.marca,
        "estado": prod.estado,
        "created_at": prod.created_at if prod.created_at else None,
        "updated_at": prod.updated_at.isoformat() if prod.updated_at else None,
        "categoria_principal_nombre": categoria_principal_nombre,
        "subcategoria_nombre": subcategoria_nombre,
        "seudocategoria_nombre": seudocategoria_nombre,
        "categoria_principal_slug": categoria_principal_slug,
        "subcategoria_slug": subcategoria_slug,
        "seudocategoria_slug": seudocategoria_slug,
        "calificacion_promedio": prod.calificacion_promedio_almacenada,
        "es_nuevo": prod.es_nuevo,
        "reseñas_count": len(prod.reseñas) if hasattr(prod, "reseñas") else 0,
        "especificaciones": prod.especificaciones or {},
        "agotado": prod.agotado,
    }


def like_to_dict(like):
    """Serializa un objeto Like a un diccionario."""
    if not like:
        return None
    return {
        "id": like.id,
        "usuario_id": like.usuario_id,
        "producto_id": like.producto_id,
        "estado": like.estado,
        "created_at": like.created_at.isoformat() if like.created_at else None,
        "updated_at": like.updated_at.isoformat() if like.updated_at else None,
    }


def resena_to_dict(resena, current_user_id=None):
    """Serializa un objeto Reseña, incluyendo la información pública del usuario que la escribió."""
    if not resena:
        return None

    # Determina si el usuario actual (si existe) ha votado por esta reseña.
    # Esto es crucial para que el frontend muestre el estado correcto del botón de voto.
    current_user_voted = False
    if current_user_id and hasattr(resena, "votos"):
        current_user_voted = any(
            voto.usuario_id == current_user_id for voto in resena.votos
        )

    # Obtener el avatar del usuario de forma segura
    # Se añade una comprobación para `resena.usuario` antes de acceder a sus atributos.
    avatar_url = None
    if (
        resena.usuario
        and hasattr(resena.usuario, "avatar_url")
        and resena.usuario.avatar_url
    ):
        avatar_url = resena.usuario.avatar_url

    # Acceso seguro a la jerarquía de categorías para la URL del producto.
    # Se utiliza `getattr` en cadena para evitar errores `AttributeError` si alguna
    # categoría intermedia (subcategoría, etc.) es None. Es más limpio y robusto.
    categoria_principal_slug_url = None
    subcategoria_slug_url = None
    seudocategoria_slug_url = None
    if resena.producto:
        seudocategoria_obj = getattr(resena.producto, "seudocategoria", None)
        if seudocategoria_obj:
            seudocategoria_slug_url = getattr(seudocategoria_obj, "slug", None)
            subcategoria_obj = getattr(seudocategoria_obj, "subcategoria", None)
            if subcategoria_obj:
                subcategoria_slug_url = getattr(subcategoria_obj, "slug", None)
                categoria_principal_obj = getattr(
                    subcategoria_obj, "categoria_principal", None
                )
                if categoria_principal_obj:
                    categoria_principal_slug_url = getattr(
                        categoria_principal_obj, "slug", None
                    )

    return {
        "id": resena.id,
        "usuario": usuario_publico_to_dict(resena.usuario) if resena.usuario else None,
        "texto": resena.texto,
        "titulo": resena.titulo,
        "calificacion": resena.calificacion,
        "created_at": resena.created_at,
        "updated_at": resena.updated_at,
        "votos_utiles_count": resena.votos_utiles_count or 0,
        "current_user_voted": current_user_voted,  # Flag para la UI
        "visitas": resena.visitas,  # Nuevo campo
        "producto": {
            "id": resena.producto.id,
            "nombre": resena.producto.nombre,
            "slug": resena.producto.slug,
            "imagen_url": resena.producto.imagen_url,
            "marca": resena.producto.marca,
            "precio": resena.producto.precio,
            "categoria_principal_slug": categoria_principal_slug_url,
            "subcategoria_slug": subcategoria_slug_url,
            "seudocategoria_slug": seudocategoria_slug_url,
        },
    }


def cart_item_to_dict(item):
    """Serializa un objeto CartItem, incluyendo información básica del producto y el subtotal calculado."""
    if not item:
        return None

    product_info = None
    if item.product:
        product_info = {
            "id": item.product.id,
            "nombre": item.product.nombre,
            "precio": item.product.precio,
            "imagen_url": item.product.imagen_url,
            "marca": item.product.marca,
            "existencia": item.product.existencia,
        }

    return {
        "id": item.id,
        "user_id": item.user_id,
        "session_id": item.session_id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "product": product_info,
        "subtotal": item.subtotal,
    }


def busqueda_termino_to_dict(busq):
    """Serializa un objeto BusquedaTermino a un diccionario."""
    if not busq:
        return None
    return {
        "id": busq.id,
        "termino": busq.termino,
        "contador": busq.contador,
        "created_at": busq.created_at.isoformat() if busq.created_at else None,
        "updated_at": busq.updated_at.isoformat() if busq.updated_at else None,
        "ultima_busqueda": busq.ultima_busqueda.isoformat()
        if busq.ultima_busqueda
        else None,
    }


def pedido_to_dict(pedido):
    """
    Serializa un objeto Pedido a un diccionario para vistas de lista (resumen).

    Proporciona una vista condensada de un pedido, ideal para tablas en el panel de
    administración donde se muestran múltiples pedidos. Incluye información clave
    y un conteo de productos en lugar de la lista completa.
    """
    if not pedido:
        return None

    usuario_nombre = None
    if pedido.usuario:
        usuario_nombre = f"{pedido.usuario.nombre} {pedido.usuario.apellido}"

    return {
        "id": pedido.id,
        "usuario_id": pedido.usuario_id,
        "usuario_nombre": usuario_nombre,
        "total": pedido.total,
        "estado_pedido": pedido.estado_pedido.value if pedido.estado_pedido else None,
        "estado": pedido.estado,
        "seguimiento_estado": pedido.seguimiento_estado.value
        if pedido.seguimiento_estado
        else None,
        "seguimiento_historial": pedido.seguimiento_historial or [],
        "notas_seguimiento": pedido.notas_seguimiento,
        "created_at": pedido.created_at.isoformat() if pedido.created_at else None,
        "updated_at": pedido.updated_at.isoformat() if pedido.updated_at else None,
        "productos_count": len(pedido.productos) if pedido.productos else 0,
    }


def pedido_detalle_to_dict(pedido):
    """
    Serializa un objeto Pedido con detalles completos para la vista de administrador.

    Esta función construye una representación exhaustiva del pedido, incluyendo:
    - Información detallada del cliente.
    - Una lista completa de los productos del pedido, con sus nombres, imágenes,
      cantidades y subtotales calculados.
    - El historial completo de seguimiento.
    """
    if not pedido:
        return None

    usuario_info = None
    if pedido.usuario:
        usuario_info = {
            "id": pedido.usuario.id,
            "nombre": pedido.usuario.nombre,
            "apellido": pedido.usuario.apellido,
            "numero": pedido.usuario.numero,
        }

    productos_info = []
    if pedido.productos:
        for pp in pedido.productos:
            productos_info.append(
                {
                    "producto_id": pp.producto_id,
                    "producto_nombre": pp.producto.nombre
                    if pp.producto
                    else "Producto no disponible",
                    "producto_imagen_url": pp.producto.imagen_url
                    if pp.producto
                    else None,
                    "producto_marca": pp.producto.marca if pp.producto else "N/A",
                    "producto_existencia": pp.producto.existencia if pp.producto else 0,
                    "cantidad": pp.cantidad,
                    "precio_unitario": pp.precio_unitario,
                    "subtotal": pp.cantidad * pp.precio_unitario,
                }
            )

    return {
        "id": pedido.id,
        "usuario": usuario_info,
        "total": pedido.total,
        "estado_pedido": pedido.estado_pedido.value if pedido.estado_pedido else None,
        "estado": pedido.estado,
        "seguimiento_estado": pedido.seguimiento_estado.value
        if pedido.seguimiento_estado
        else None,
        "seguimiento_historial": pedido.seguimiento_historial or [],
        "notas_seguimiento": pedido.notas_seguimiento,
        "created_at": pedido.created_at.isoformat() if pedido.created_at else None,
        "updated_at": pedido.updated_at.isoformat() if pedido.updated_at else None,
        "productos": productos_info,
        "productos_count": len(productos_info),
    }


def pedido_detalle_cliente_to_dict(pedido):
    """
    Serializa un objeto Pedido con detalles completos, optimizado para la vista del cliente.

    Similar a `pedido_detalle_to_dict`, pero adaptado para lo que el cliente necesita ver.
    - Calcula el subtotal de los productos (`calculated_total`) para mostrarlo por separado.
    - Se asegura de que el `total` final sea un número válido, usando el total calculado
      como fallback.
    - Omite notas internas de seguimiento que podrían no ser relevantes para el cliente.
    """
    if not pedido:
        return None

    usuario_info = None
    if pedido.usuario:
        usuario_info = {
            "id": pedido.usuario.id,
            "nombre": pedido.usuario.nombre,
            "apellido": pedido.usuario.apellido,
            "numero": pedido.usuario.numero,
        }

    productos_info = []
    calculated_total = 0

    if pedido.productos:
        for pp in pedido.productos:
            subtotal = pp.cantidad * pp.precio_unitario
            calculated_total += subtotal

            productos_info.append(
                {
                    "producto_id": pp.producto_id,
                    "producto_nombre": pp.producto.nombre
                    if pp.producto
                    else "Producto no disponible",
                    "producto_imagen_url": pp.producto.imagen_url
                    if pp.producto
                    else None,
                    "producto_marca": pp.producto.marca if pp.producto else "N/A",
                    "producto_existencia": pp.producto.existencia if pp.producto else 0,
                    "cantidad": pp.cantidad,
                    "precio_unitario": pp.precio_unitario,
                    "subtotal": subtotal,
                }
            )

    # Asegurarnos de que pedido.total sea un número válido
    try:
        final_total = (
            float(pedido.total) if pedido.total is not None else calculated_total
        )
    except (ValueError, TypeError):
        final_total = calculated_total

    return {
        "id": pedido.id,
        "usuario": usuario_info,
        "subtotal_productos": calculated_total,
        "total": final_total,
        "estado_pedido": pedido.estado_pedido.value if pedido.estado_pedido else None,
        "estado": pedido.estado,
        "seguimiento_estado": pedido.seguimiento_estado.value
        if pedido.seguimiento_estado
        else None,
        "seguimiento_historial": pedido.seguimiento_historial or [],
        "created_at": pedido.created_at.isoformat() if pedido.created_at else None,
        "updated_at": pedido.updated_at.isoformat() if pedido.updated_at else None,
        "productos": productos_info,
        "productos_count": len(productos_info),
    }
