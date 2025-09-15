# script_prueba.py
from app import create_app
from app.extensions import db
from app.models.domains.product_models import CategoriasPrincipales, Subcategorias, Seudocategorias, Productos

app = create_app()

def get_or_create(session, model, defaults=None, **kwargs):
    """
    Busca una instancia de un modelo por kwargs. Si no la encuentra, la crea.
    `defaults` es un diccionario de atributos para establecer al crear la instancia.
    Retorna la instancia y un booleano indicando si fue creada.
    """
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        print(f"'{kwargs.get('nombre')}' en {model.__name__} ya existe. Omitiendo creación.")
        # Actualizar especificaciones si es necesario
        if 'especificaciones' in defaults:
            instance.especificaciones = defaults['especificaciones']
            print(f"Actualizando especificaciones para '{instance.nombre}'.")
        return instance, False
    else:
        params = kwargs.copy()
        if defaults:
            params.update(defaults)
        instance = model(**params)
        session.add(instance)
        print(f"Creando '{params.get('nombre')}' en {model.__name__}.")
        return instance, True

with app.app_context():
    # Definición de la estructura de datos (se mantiene igual)
    datos = {
        "Maquillaje": {
            "descripcion": "Productos de maquillaje para realzar tu belleza",
            "subcategorias": {
                "Labios": {
                    "descripcion": "Productos para el maquillaje de labios",
                    "seudocategorias": {
                        "Labiales Mate": "Labiales de acabado mate y larga duración",
                        "Gloss Labiales": "Brillos y gloss para labios con efecto brillante",
                        "Bálsamos Labiales": "Bálsamos hidratantes con color para labios",
                        "Lápices Labiales": "Lápices precisos para contornear y rellenar labios"
                    }
                },
                "Ojos": {
                    "descripcion": "Productos para el maquillaje de ojos",
                    "seudocategorias": {
                        "Máscaras de Pestañas": "Productos para dar volumen y longitud a las pestañas",
                        "Sombras de Ojos": "Paletas y sombras individuales para ojos",
                        "Delineadores": "Delineadores líquidos, en gel y lápiz para ojos",
                        "Cejas": "Productos para definir y rellenar las cejas"
                    }
                },
                "Rostro": {
                    "descripcion": "Productos para el maquillaje del rostro",
                    "seudocategorias": {
                        "Bases de Maquillaje": "Bases de maquillaje para unificar el tono de la piel",
                        "Correctores": "Correctores para cubrir imperfecciones",
                        "Polvos Faciales": "Polvos compactos y sueltos para fijar el maquillaje",
                        "Iluminadores": "Iluminadores faciales para dar brillo y dimensión",
                        "Rubores": "Rubores en polvo, crema y líquido para dar color a las mejillas"
                    }
                }
            }
        },
        "Cuidado Facial": {
            "descripcion": "Productos para el cuidado y tratamiento de la piel",
            "subcategorias": {
                "Limpieza Facial": {
                    "descripcion": "Productos para la limpieza diaria de la piel",
                    "seudocategorias": {
                        "Geles Limpiadores": "Geles de limpieza para todo tipo de piel",
                        "Aguas Micelares": "Soluciones micelares para desmaquillar y limpiar",
                        "Exfoliantes": "Exfoliantes químicos y físicos para renovar la piel",
                        "Tónicos": "Tónicos para equilibrar el pH y refrescar la piel"
                    }
                },
                "Hidratación": {
                    "descripcion": "Productos para hidratar y nutrir la piel",
                    "seudocategorias": {
                        "Cremas Hidratantes": "Cremas faciales para hidratación diaria",
                        "Sérums Faciales": "Sérums concentrados para tratamientos específicos",
                        "Contorno de Ojos": "Cremas específicas para el contorno de ojos",
                        "Mascarillas Faciales": "Mascarillas para tratamientos intensivos"
                    }
                }
            }
        },
        "Cuidado del Cabello": {
            "descripcion": "Productos para el cuidado y tratamiento capilar",
            "subcategorias": {
                "Shampoo": {
                    "descripcion": "Shampoos para diferentes tipos de cabello",
                    "seudocategorias": {
                        "Shampoo Hidratante": "Shampoos con propiedades hidratantes",
                        "Shampoo Anticaspa": "Shampoos para tratamiento de caspa",
                        "Shampoo Color": "Shampoos para proteger el color del cabello teñido",
                        "Shampoo Volumen": "Shampoos para dar volumen al cabello fino"
                    }
                },
                "Tratamientos": {
                    "descripcion": "Productos para tratamientos capilares",
                    "seudocategorias": {
                        "Mascarillas Capilares": "Mascarillas nutritivas para el cabello",
                        "Aceites Capilares": "Aceites para tratamiento y brillo del cabello",
                        "Acondicionadores": "Acondicionadores para desenredar y suavizar",
                        "Sérums Capilares": "Sérums para tratar puntas abiertas y frizz"
                    }
                }
            }
        },
        "Fragancias": {
            "descripcion": "Perfumes y colonias para hombre y mujer",
            "subcategorias": {
                "Fragancias para Mujer": {
                    "descripcion": "Perfumes y colonias para mujer",
                    "seudocategorias": {
                        "Eau de Parfum": "Perfumes con alta concentración de esencias",
                        "Eau de Toilette": "Fragancias ligeras para uso diario",
                        "Perfumes Florales": "Fragancias con notas florales dominantes",
                        "Perfumes Frutales": "Fragancias con notas frutales frescas"
                    }
                },
                "Fragancias para Hombre": {
                    "descripcion": "Perfumes y colonias para hombre",
                    "seudocategorias": {
                        "Perfumes para Hombre": "Fragancias masculinas intensas",
                        "Colonias": "Fragancias ligeras para hombre",
                        "Aftershave": "Lociones para después del afeitado",
                        "Perfumes Maderados": "Fragancias con notas de madera y especias"
                    }
                }
            }
        }
    }

    # Procesar la estructura de datos para crear categorías (se mantiene igual)
    for nombre_cat, datos_cat in datos.items():
        cat, _ = get_or_create(db.session, CategoriasPrincipales, nombre=nombre_cat, defaults={
            'descripcion': datos_cat['descripcion'],
            'estado': 'activo'
        })
        db.session.flush() # Para asegurar que cat.id está disponible

        for nombre_sub, datos_sub in datos_cat['subcategorias'].items():
            sub, _ = get_or_create(db.session, Subcategorias, nombre=nombre_sub, categoria_principal_id=cat.id, defaults={
                'descripcion': datos_sub['descripcion'],
                'estado': 'activo'
            })
            db.session.flush() # Para asegurar que sub.id está disponible

            for nombre_seudo, desc_seudo in datos_sub['seudocategorias'].items():
                get_or_create(db.session, Seudocategorias, nombre=nombre_seudo, subcategoria_id=sub.id, defaults={
                    'descripcion': desc_seudo,
                    'estado': 'activo'
                })
    
    # Commit de todas las categorías, subcategorías y seudocategorías
    db.session.commit()
    print("\n--- Categorías, Subcategorías y Seudocategorías verificadas/creadas ---\n")

    # ========== CREACIÓN DE PRODUCTOS ========== 
    # Se obtienen las seudocategorías de la BD para asegurar que tenemos los objetos correctos
    seudo_labiales_mate = db.session.query(Seudocategorias).filter_by(nombre="Labiales Mate").one()
    seudo_gloss = db.session.query(Seudocategorias).filter_by(nombre="Gloss Labiales").one()
    seudo_balsamos = db.session.query(Seudocategorias).filter_by(nombre="Bálsamos Labiales").one()
    seudo_lapices = db.session.query(Seudocategorias).filter_by(nombre="Lápices Labiales").one()
    seudo_mascaras = db.session.query(Seudocategorias).filter_by(nombre="Máscaras de Pestañas").one()
    seudo_sombras = db.session.query(Seudocategorias).filter_by(nombre="Sombras de Ojos").one()
    seudo_delineadores = db.session.query(Seudocategorias).filter_by(nombre="Delineadores").one()
    seudo_cejas = db.session.query(Seudocategorias).filter_by(nombre="Cejas").one()
    seudo_bases = db.session.query(Seudocategorias).filter_by(nombre="Bases de Maquillaje").one()
    seudo_correctores = db.session.query(Seudocategorias).filter_by(nombre="Correctores").one()
    seudo_polvos = db.session.query(Seudocategorias).filter_by(nombre="Polvos Faciales").one()
    seudo_iluminadores = db.session.query(Seudocategorias).filter_by(nombre="Iluminadores").one()
    seudo_rubores = db.session.query(Seudocategorias).filter_by(nombre="Rubores").one()
    seudo_geles = db.session.query(Seudocategorias).filter_by(nombre="Geles Limpiadores").one()
    seudo_aguas_micelares = db.session.query(Seudocategorias).filter_by(nombre="Aguas Micelares").one()
    seudo_exfoliantes = db.session.query(Seudocategorias).filter_by(nombre="Exfoliantes").one()
    seudo_tonicos = db.session.query(Seudocategorias).filter_by(nombre="Tónicos").one()
    seudo_cremas = db.session.query(Seudocategorias).filter_by(nombre="Cremas Hidratantes").one()
    seudo_serums = db.session.query(Seudocategorias).filter_by(nombre="Sérums Faciales").one()
    seudo_contorno_ojos = db.session.query(Seudocategorias).filter_by(nombre="Contorno de Ojos").one()
    seudo_mascarillas_faciales = db.session.query(Seudocategorias).filter_by(nombre="Mascarillas Faciales").one()
    seudo_shampoo_hidratante = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Hidratante").one()
    seudo_shampoo_anticaspa = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Anticaspa").one()
    seudo_shampoo_color = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Color").one()
    seudo_shampoo_volumen = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Volumen").one()
    seudo_mascarillas = db.session.query(Seudocategorias).filter_by(nombre="Mascarillas Capilares").one()
    seudo_aceites = db.session.query(Seudocategorias).filter_by(nombre="Aceites Capilares").one()
    seudo_acondicionadores = db.session.query(Seudocategorias).filter_by(nombre="Acondicionadores").one()
    seudo_serums_capilares = db.session.query(Seudocategorias).filter_by(nombre="Sérums Capilares").one()
    seudo_eau_de_parfum = db.session.query(Seudocategorias).filter_by(nombre="Eau de Parfum").one()
    seudo_eau_de_toilette = db.session.query(Seudocategorias).filter_by(nombre="Eau de Toilette").one()
    seudo_perfumes_florales = db.session.query(Seudocategorias).filter_by(nombre="Perfumes Florales").one()
    seudo_perfumes_frutales = db.session.query(Seudocategorias).filter_by(nombre="Perfumes Frutales").one()
    seudo_parfum_hombre = db.session.query(Seudocategorias).filter_by(nombre="Perfumes para Hombre").one()
    seudo_colonias = db.session.query(Seudocategorias).filter_by(nombre="Colonias").one()
    seudo_aftershave = db.session.query(Seudocategorias).filter_by(nombre="Aftershave").one()
    seudo_perfumes_maderados = db.session.query(Seudocategorias).filter_by(nombre="Perfumes Maderados").one()

    productos_a_crear = [
        # LABIALES MATE
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Ruby Woo", 'defaults': {'descripcion': "Labial mate intenso en tono rojo vivo, de larga duración", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M6P701_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Acabado": "Mate", "Contenido": "3g", "Tono": "Ruby Woo"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Diva", 'defaults': {'descripcion': "Labial mate en tono burdeo intenso, de larga duración", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M60P01_640x800_0.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Acabado": "Mate", "Contenido": "3g", "Tono": "Diva"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte 999", 'defaults': {'descripcion': "Labial mate icónico en tono rojo clásico", 'precio': 120000, 'costo': 60000, 'imagen_url': "https://www.chanel.com/images/q_auto,f_jpg,w_500/09-red-rouge-allure-velvet-luminous-matte-lip-colour-3-5g-packshot-default-134440-8828453524546.jpg", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Chanel", 'estado': "activo", 'especificaciones': {"Acabado": "Mate", "Contenido": "3.5g", "Tono": "999"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Velvet Teddy", 'defaults': {'descripcion': "Labial mate en tono nude beige, muy popular", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2W201_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Acabado": "Mate", "Contenido": "3g", "Tono": "Velvet Teddy"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Ruby Kiss", 'defaults': {'descripcion': "Labial mate en tono rojo cereza intenso", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.revlon.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-revlon-master-catalog/default/dw2d7a3b8e/images/Product/030/839780533030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Revlon", 'estado': "activo", 'especificaciones': {"Acabado": "Mate", "Contenido": "4.2g", "Tono": "Ruby Kiss"}}},
        
        # GLOSS LABIALES
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Lip Glass Clear", 'defaults': {'descripcion': "Gloss transparente con efecto plumping", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_SGZ01_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Acabado": "Brillante", "Contenido": "15ml", "Tono": "Transparente"}}},
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Juicy Shutter Pink", 'defaults': {'descripcion': "Gloss con pigmentación rosa brillante", 'precio': 42000, 'costo': 21000, 'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/face/lip-gloss/400/super-stay-vinyl-ink-liquid-lipstick-40-pink.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Acabado": "Vinyl", "Contenido": "5ml", "Tono": "Pink"}}},
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Crystal Glow", 'defaults': {'descripcion': "Gloss con partículas de destello", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.dior.com/couture/var/dior/storage/images/14441515/1_1200_1200/0/14441515.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dior", 'estado': "activo", 'especificaciones': {"Acabado": "Brillante", "Contenido": "6ml", "Tono": "Crystal"}}},
        
        # BALSAMOS LABIALES
        {'seudocategoria_id': seudo_balsamos.id, 'nombre': "Bálsamo Labial Tinted Peach", 'defaults': {'descripcion': "Bálsamo hidratante con color melocotón", 'precio': 35000, 'costo': 17500, 'imagen_url': "https://www.fresh.com/dw/image/v2/BBQJ_PRD/on/demandware.static/-/Sites-fresh-master-catalog/default/dw1f4b3b5c/images/Product/011/325073000011_1.jpg?sw=500&sh=500", 'existencia': 45, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Fresh", 'estado': "activo", 'especificaciones': {"Acabado": "Hidratante", "Contenido": "4.3g", "Tono": "Peach"}}},
        {'seudocategoria_id': seudo_balsamos.id, 'nombre': "Bálsamo Labial Cherry", 'defaults': {'descripcion': "Bálsamo con tono cereza y SPF 15", 'precio': 28000, 'costo': 14000, 'imagen_url': "https://www.esteelauder.com/media/export/cms/products/640x800/el_sku_0L8A01_640x800_0.jpg", 'existencia': 50, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Estée Lauder", 'estado': "activo", 'especificaciones': {"Acabado": "Hidratante", "Contenido": "3.5g", "Tono": "Cherry"}}},
        
        # LÁPICES LABIALES
        {'seudocategoria_id': seudo_lapices.id, 'nombre': "Lápiz Labial Cherry", 'defaults': {'descripcion': "Lápiz labial en tono cereza intenso", 'precio': 38000, 'costo': 19000, 'imagen_url': "https://www.narscosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-itemmaster_nars/default/dw3d3c0e2c/0605045020731_main.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "NARS", 'estado': "activo", 'especificaciones': {"Tipo": "Lápiz", "Contenido": "1.2g", "Tono": "Cherry"}}},
        {'seudocategoria_id': seudo_lapices.id, 'nombre': "Lápiz Contorno Nude", 'defaults': {'descripcion': "Lápiz para contornear labios en tono nude", 'precio': 32000, 'costo': 16000, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_MAE01_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Tipo": "Contorno", "Contenido": "1.45g", "Tono": "Nude"}}},
        
        # MÁSCARAS DE PESTAÑAS
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas Hypnose", 'defaults': {'descripcion': "Máscara para volumen dramático", 'precio': 95000, 'costo': 47500, 'imagen_url': "https://www.lancome-usa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lancome-usa-Library/default/dw1d9b5b4c/images/2021/Hypnose/3147758019210_01.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Lancôme", 'estado': "activo", 'especificaciones': {"Efecto": "Volumen", "Color": "Negro", "Resistente al agua": "No"}}},
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas Better Than Sex", 'defaults': {'descripcion': "Máscara para pestañas voluminosas y curvadas", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.tartecosmetics.com/dw/image/v2/BBTX_PRD/on/demandware.static/-/Sites-tarte-master-catalog/default/dw9e5c1e5c/images/product/BEAUTY/31925/31925_01.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Tarte", 'estado': "activo", 'especificaciones': {"Efecto": "Volumen y Curvatura", "Color": "Negro Carbón", "Resistente al agua": "Sí"}}},
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas They're Real", 'defaults': {'descripcion': "Máscara para alargar y separar pestañas", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.benefitcosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-benefit-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Benefit", 'estado': "activo", 'especificaciones': {"Efecto": "Alargamiento", "Color": "Negro", "Resistente al agua": "Sí"}}},
        
        # SOMBRAS DE OJOS
        {'seudocategoria_id': seudo_sombras.id, 'nombre': "Paleta Sombras Naked", 'defaults': {'descripcion': "Paleta con 12 tonos neutros", 'precio': 145000, 'costo': 72500, 'imagen_url': "https://www.urbandecay.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-urbandecay-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Urban Decay", 'estado': "activo", 'especificaciones': {"Tonos": "12 neutros", "Acabado": "Mixto", "Incluye": "Espejo y pincel"}}},
        {'seudocategoria_id': seudo_sombras.id, 'nombre': "Paleta Sombras Modern Renaissance", 'defaults': {'descripcion': "Paleta con tonos terracota y rojos", 'precio': 155000, 'costo': 77500, 'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 18, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Tonos": "14 tonos cálidos", "Acabado": "Mixto", "Incluye": "Espejo y pincel"}}},
        
        # DELINEADORES
        {'seudocategoria_id': seudo_delineadores.id, 'nombre': "Delineador Líquido Black", 'defaults': {'descripcion': "Delineador líquido negro intenso con punta fina", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/eye/eyeliner/110/eyestudio-master-precise-ink-eyeliner-110-black.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Tipo": "Líquido", "Color": "Negro", "Duración": "24 horas"}}},
        {'seudocategoria_id': seudo_delineadores.id, 'nombre': "Delineador Gel Black", 'defaults': {'descripcion': "Delineador en gel de alta precisión", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.bobbibrown.com/media/export/cms/products/640x800/bb_sku_S9N301_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Bobbi Brown", 'estado': "activo", 'especificaciones': {"Tipo": "Gel", "Color": "Negro Intenso", "Duración": "12 horas"}}},
        
        # CEJAS
        {'seudocategoria_id': seudo_cejas.id, 'nombre': "Lápiz para Cejas Taupe", 'defaults': {'descripcion': "Lápiz preciso para rellenar cejas", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Tipo": "Lápiz", "Color": "Taupe", "Duración": "12 horas"}}},
        {'seudocategoria_id': seudo_cejas.id, 'nombre': "Gel para Cejas Clear", 'defaults': {'descripcion': "Gel transparente para fijar cejas", 'precio': 35000, 'costo': 17500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_MGZ01_640x800_0.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Tipo": "Gel", "Color": "Transparente", "Duración": "8 horas"}}},
        
        # BASES DE MAQUILLAJE
        {'seudocategoria_id': seudo_bases.id, 'nombre': "Base Double Wear", 'defaults': {'descripcion': "Base de maquillaje de larga duración", 'precio': 95000, 'costo': 47500, 'imagen_url': "https://www.esteelauder.com/media/export/cms/products/640x800/el_sku_0W1A01_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Estée Lauder", 'estado': "activo", 'especificaciones': {"Cobertura": "Media-Alta", "Acabado": "Natural", "Duración": "24 horas"}}},
        {'seudocategoria_id': seudo_bases.id, 'nombre': "Base Pro Filt'r", 'defaults': {'descripcion': "Base de maquillaje ligera con SPF", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.fentybeauty.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-fenty-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Fenty Beauty", 'estado': "activo", 'especificaciones': {"Cobertura": "Media", "Acabado": "Natural", "Duración": "12 horas"}}},
        
        # CORRECTORES
        {'seudocategoria_id': seudo_correctores.id, 'nombre': "Corrector Eraser", 'defaults': {'descripcion': "Corrector con esponja aplicadora", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/face/concealer/120/instant-age-rewind-eraser-dark-circles-treatment-concealer-120-light.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Cobertura": "Alta", "Textura": "Líquida", "Zona de uso": "Ojeras"}}},
        {'seudocategoria_id': seudo_correctores.id, 'nombre': "Corrector Longwear", 'defaults': {'descripcion': "Corrector de larga duración", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2U201_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Cobertura": "Alta", "Textura": "Crema", "Zona de uso": "Imperfecciones"}}},
        
        # POLVOS FACIALES
        {'seudocategoria_id': seudo_polvos.id, 'nombre': "Polvo Compacto Translucent", 'defaults': {'descripcion': "Polvo compacto translúcido para fijar maquillaje", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2N201_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Tipo": "Compacto", "Color": "Translúcido", "Acabado": "Mate"}}},
        {'seudocategoria_id': seudo_polvos.id, 'nombre': "Polvo Suelto Invisible", 'defaults': {'descripcion': "Polvo suelto transparente para fijar maquillaje", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.lauramercier.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-laura-mercier-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Laura Mercier", 'estado': "activo", 'especificaciones': {"Tipo": "Suelto", "Color": "Invisible", "Acabado": "Natural"}}},
        
        # ILUMINADORES
        {'seudocategoria_id': seudo_iluminadores.id, 'nombre': "Iluminador Liquid Gold", 'defaults': {'descripcion': "Iluminador líquido en tono dorado", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2G201_640x800_0.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Tipo": "Líquido", "Color": "Dorado", "Acabado": "Metálico"}}},
        {'seudocategoria_id': seudo_iluminadores.id, 'nombre': "Iluminador Polvo Champagne", 'defaults': {'descripcion': "Iluminador en polvo tono champán", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Tipo": "Polvo", "Color": "Champán", "Acabado": "Brillante"}}},
        
        # RUBORES
        {'seudocategoria_id': seudo_rubores.id, 'nombre': "Rubor Powder Pink", 'defaults': {'descripcion': "Rubor en polvo tono rosa", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.narscosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-itemmaster_nars/default/dw3d3c0e2c/0605045020731_main.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "NARS", 'estado': "activo", 'especificaciones': {"Tipo": "Polvo", "Color": "Rosa", "Acabado": "Mate"}}},
        {'seudocategoria_id': seudo_rubores.id, 'nombre': "Rubor Cream Peach", 'defaults': {'descripcion': "Rubor en crema tono melocotón", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2P201_640x800_0.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Tipo": "Crema", "Color": "Melocotón", "Acabado": "Natural"}}},
        
        # GELES LIMPIADORES
        {'seudocategoria_id': seudo_geles.id, 'nombre': "Gel Limpiador Espumoso", 'defaults': {'descripcion': "Gel limpiador que genera espusa para piel grasa", 'precio': 48000, 'costo': 24000, 'imagen_url': "https://www.laroche-posay.us/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lrp-usa-Library/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "La Roche-Posay", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Grasa", "Beneficio": "Control de brillo", "Libre de": "Jabón"}}},
        {'seudocategoria_id': seudo_geles.id, 'nombre': "Gel Limpiador Suave", 'defaults': {'descripcion': "Gel limpiador para piel sensible", 'precio': 42000, 'costo': 21000, 'imagen_url': "https://www.cerave.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-cerave-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "CeraVe", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Sensible", "Beneficio": "Limpieza suave", "Libre de": "Fragancia"}}},
        
        # AGUAS MICELARES
        {'seudocategoria_id': seudo_aguas_micelares.id, 'nombre': "Agua Micelar 3 en 1", 'defaults': {'descripcion': "Agua micelar que limpia, tonifica y desmaquilla", 'precio': 35000, 'costo': 17500, 'imagen_url': "https://www.garnier.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-garnier-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 45, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Garnier", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Todo tipo", "Beneficio": "Limpia y tonifica", "Libre de": "Alcohol"}}},
        {'seudocategoria_id': seudo_aguas_micelares.id, 'nombre': "Agua Micelar Hidratante", 'defaults': {'descripcion': "Agua micelar con ácido hialurónico", 'precio': 42000, 'costo': 21000, 'imagen_url': "https://www.laroche-posay.us/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lrp-usa-Library/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "La Roche-Posay", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Sensible y seca", "Beneficio": "Hidratación", "Libre de": "Alcohol y parabenos"}}},
        
        # EXFOLIANTES
        {'seudocategoria_id': seudo_exfoliantes.id, 'nombre': "Exfoliante Físico Microperlado", 'defaults': {'descripcion': "Exfoliante con microperlas para renovar la piel", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.stives.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-stives-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "St. Ives", 'estado': "activo", 'especificaciones': {"Tipo": "Físico", "Frecuencia": "2-3 veces por semana", "Ingredientes": "Microperlas naturales"}}},
        {'seudocategoria_id': seudo_exfoliantes.id, 'nombre': "Exfoliante Químico AHA", 'defaults': {'descripcion': "Exfoliante con ácidos glicólico y láctico", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.theordinary.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-deciem-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "The Ordinary", 'estado': "activo", 'especificaciones': {"Tipo": "Químico", "Frecuencia": "Nocturno", "Ingredientes": "AHA 7%"}}},
        
        # TÓNICOS
        {'seudocategoria_id': seudo_tonicos.id, 'nombre': "Tónico Equilibrante", 'defaults': {'descripcion': "Tónico para equilibrar el pH de la piel", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.kiehls.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-kiehls-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Kiehl's", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Todo tipo", "Beneficio": "Equilibrio", "Libre de": "Alcohol"}}},
        {'seudocategoria_id': seudo_tonicos.id, 'nombre': "Tónico Refrescante", 'defaults': {'descripcion': "Tónico con pepino para refrescar la piel", 'precio': 35000, 'costo': 17500, 'imagen_url': "https://www.thefaceshop.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-tfs-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "The Face Shop", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Sensible", "Beneficio": "Refresca y calma", "Ingredientes": "Extracto de pepino"}}},
        
        # CREMAS HIDRATANTES
        {'seudocategoria_id': seudo_cremas.id, 'nombre': "Crema Hidratante Nutritiva", 'defaults': {'descripcion': "Crema hidratante para piel seca", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.clinique.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-clinique-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Clinique", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Seca", "Contenido": "50ml", "Textura": "Crema rica"}}},
        {'seudocategoria_id': seudo_cremas.id, 'nombre': "Crema Hidratante Ligera", 'defaults': {'descripcion': "Crema hidratante para piel grasa", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.neutrogena.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-neutrogena-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Neutrogena", 'estado': "activo", 'especificaciones': {"Tipo de Piel": "Grasa", "Contenido": "50ml", "Textura": "Gel-crema"}}},
        
        # SÉRUMS FACIALES
        {'seudocategoria_id': seudo_serums.id, 'nombre': "Sérum Ácido Hialurónico", 'defaults': {'descripcion': "Sérum hidratante con ácido hialurónico", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.laroche-posay.us/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lrp-usa-Library/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "La Roche-Posay", 'estado': "activo", 'especificaciones': {"Ingrediente Activo": "Ácido Hialurónico", "Beneficio": "Hidratación profunda", "Contenido": "30ml"}}},
        {'seudocategoria_id': seudo_serums.id, 'nombre': "Sérum Retinol", 'defaults': {'descripcion': "Sérum con retinol para anti-envejecimiento", 'precio': 95000, 'costo': 47500, 'imagen_url': "https://www.cerave.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-cerave-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "CeraVe", 'estado': "activo", 'especificaciones': {"Ingrediente Activo": "Retinol 0.3%", "Beneficio": "Anti-envejecimiento", "Contenido": "30ml"}}},
        
        # CONTORNO DE OJOS
        {'seudocategoria_id': seudo_contorno_ojos.id, 'nombre': "Contorno de Ojos Anti-Edad", 'defaults': {'descripcion': "Crema para contorno de ojos con retinol", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.esteelauder.com/media/export/cms/products/640x800/el_sku_0L8A01_640x800_0.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Estée Lauder", 'estado': "activo", 'especificaciones': {"Ingrediente Activo": "Retinol", "Beneficio": "Anti-edad", "Contenido": "15ml"}}},
        {'seudocategoria_id': seudo_contorno_ojos.id, 'nombre': "Contorno de Ojos Hidratante", 'defaults': {'descripcion': "Gel para contorno de ojos con ácido hialurónico", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.kiehls.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-kiehls-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Kiehl's", 'estado': "activo", 'especificaciones': {"Ingrediente Activo": "Ácido Hialurónico", "Beneficio": "Hidratación", "Contenido": "15ml"}}},
        
        # MASCARILLAS FACIALES
        {'seudocategoria_id': seudo_mascarillas_faciales.id, 'nombre': "Mascarilla de Arcilla", 'defaults': {'descripcion': "Mascarilla purificante de arcilla", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.garnier.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-garnier-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Garnier", 'estado': "activo", 'especificaciones': {"Tipo": "Arcilla", "Beneficio": "Purifica poros", "Contenido": "50ml"}}},
        {'seudocategoria_id': seudo_mascarillas_faciales.id, 'nombre': "Mascarilla de Tela Hidratante", 'defaults': {'descripcion': "Mascarilla de tela con ácido hialurónico", 'precio': 35000, 'costo': 17500, 'imagen_url': "https://www.drjart.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-drjart-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dr. Jart+", 'estado': "activo", 'especificaciones': {"Tipo": "Tela", "Beneficio": "Hidratación intensa", "Contenido": "25ml"}}},
        
        # SHAMPOO HIDRATANTE
        {'seudocategoria_id': seudo_shampoo_hidratante.id, 'nombre': "Shampoo Hidratación Extrema", 'defaults': {'descripcion': "Shampoo con aceite de argán para cabello muy seco", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Cantidad": "250ml", "Tipo de Cabello": "Muy seco", "Función": "Hidratación profunda"}}},
        {'seudocategoria_id': seudo_shampoo_hidratante.id, 'nombre': "Shampoo Nutritivo", 'defaults': {'descripcion': "Shampoo con proteína de trigo para cabello dañado", 'precio': 38000, 'costo': 19000, 'imagen_url': "https://www.kerastase.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-kerastase-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Kérastase", 'estado': "activo", 'especificaciones': {"Cantidad": "250ml", "Tipo de Cabello": "Dañado", "Función": "Nutrición"}}},
        
        # SHAMPOO ANTICASPA
        {'seudocategoria_id': seudo_shampoo_anticaspa.id, 'nombre': "Shampoo Anticaspa Intenso", 'defaults': {'descripcion': "Shampoo con piritiona de zinc para caspa severa", 'precio': 42000, 'costo': 21000, 'imagen_url': "https://www.headandshoulders.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-headandshoulders-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Head & Shoulders", 'estado': "activo", 'especificaciones': {"Cantidad": "400ml", "Tipo de Cabello": "Con caspa severa", "Función": "Control caspa intensivo"}}},
        {'seudocategoria_id': seudo_shampoo_anticaspa.id, 'nombre': "Shampoo Anticaspa Suave", 'defaults': {'descripcion': "Shampoo con aceite de árbol de té para cuero cabelludo sensible", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.nioxin.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-nioxin-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Nioxin", 'estado': "activo", 'especificaciones': {"Cantidad": "300ml", "Tipo de Cabello": "Cuero cabelludo sensible", "Función": "Control caspa suave"}}},
        
        # SHAMPOO COLOR
        {'seudocategoria_id': seudo_shampoo_color.id, 'nombre': "Shampoo Protección Color", 'defaults': {'descripcion': "Shampoo sin sulfatos para proteger el color", 'precio': 48000, 'costo': 24000, 'imagen_url': "https://www.redken.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-redken-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Redken", 'estado': "activo", 'especificaciones': {"Cantidad": "300ml", "Tipo de Cabello": "Teñido", "Función": "Protección del color"}}},
        {'seudocategoria_id': seudo_shampoo_color.id, 'nombre': "Shampoo Reparador Color", 'defaults': {'descripcion': "Shampoo con keratina para cabello teñido dañado", 'precio': 52000, 'costo': 26000, 'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Cantidad": "250ml", "Tipo de Cabello": "Teñido y dañado", "Función": "Reparación y protección del color"}}},
        
        # SHAMPOO VOLUMEN
        {'seudocategoria_id': seudo_shampoo_volumen.id, 'nombre': "Shampoo Volumen Extremo", 'defaults': {'descripcion': "Shampoo con proteínas para cabello fino", 'precio': 45000, 'costo': 22500, 'imagen_url': "https://www.aveda.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-aveda-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Aveda", 'estado': "activo", 'especificaciones': {"Cantidad": "250ml", "Tipo de Cabello": "Fino", "Función": "Volumen extremo"}}},
        {'seudocategoria_id': seudo_shampoo_volumen.id, 'nombre': "Shampoo Volumen Ligero", 'defaults': {'descripcion': "Shampoo sin sulfatos para cabello fino", 'precio': 38000, 'costo': 19000, 'imagen_url': "https://www.livingproof.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-living-proof-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Living Proof", 'estado': "activo", 'especificaciones': {"Cantidad": "236ml", "Tipo de Cabello": "Fino", "Función": "Volumen ligero"}}},
        
        # MASCARILLAS CAPILARES
        {'seudocategoria_id': seudo_mascarillas.id, 'nombre': "Mascarilla Reparadora Intensa", 'defaults': {'descripcion': "Mascarilla con keratina para cabello muy dañado", 'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Tipo de Cabello": "Muy dañado", "Función": "Reparación intensiva", "Ingredientes": "Keratina y aceites reparadores"}}},
        {'seudocategoria_id': seudo_mascarillas.id, 'nombre': "Mascarilla Hidratante", 'defaults': {'descripcion': "Mascarilla con manteca de karité para cabello seco", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Tipo de Cabello": "Seco", "Función": "Hidratación profunda", "Ingredientes": "Manteca de karité y aceite de argán"}}},
        
        # ACEITES CAPILARES
        {'seudocategoria_id': seudo_aceites.id, 'nombre': "Aceite de Argán Puro", 'defaults': {'descripcion': "Aceite 100% puro de argán para cabello y piel", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Ingrediente Principal": "Aceite de Argán 100% Puro", "Volumen": "100ml", "Uso": "Cabello y Piel"}}},
        {'seudocategoria_id': seudo_aceites.id, 'nombre': "Aceite Nutritivo", 'defaults': {'descripcion': "Aceite con 6 aceites nutritivos para cabello seco", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.lorealparisusa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-loreal-usa-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "L'Oréal Paris", 'estado': "activo", 'especificaciones': {"Ingredientes": "6 aceites nutritivos", "Volumen": "90ml", "Uso": "Cabello seco y dañado"}}},
        
        # ACONDICIONADORES
        {'seudocategoria_id': seudo_acondicionadores.id, 'nombre': "Acondicionador Hidratante", 'defaults': {'descripcion': "Acondicionador con aceite de argán para cabello seco", 'precio': 38000, 'costo': 19000, 'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Tipo de Cabello": "Seco", "Función": "Hidratación y suavidad", "Contenido": "250ml"}}},
        {'seudocategoria_id': seudo_acondicionadores.id, 'nombre': "Acondicionador Reparador", 'defaults': {'descripcion': "Acondicionador con keratina para cabello dañado", 'precio': 42000, 'costo': 21000, 'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Tipo de Cabello": "Dañado", "Función": "Reparación y protección", "Contenido": "250ml"}}},
        
        # SÉRUMS CAPILARES
        {'seudocategoria_id': seudo_serums_capilares.id, 'nombre': "Sérum Anti-Frizz", 'defaults': {'descripcion': "Sérum para controlar el frizz y dar brillo", 'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.johnfrieda.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-john-frieda-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "John Frieda", 'estado': "activo", 'especificaciones': {"Función": "Control de frizz", "Beneficio": "Brillo y suavidad", "Contenido": "50ml"}}},
        {'seudocategoria_id': seudo_serums_capilares.id, 'nombre': "Sérum Reparador de Puntas", 'defaults': {'descripcion': "Sérum para reparar puntas abiertas", 'precio': 48000, 'costo': 24000, 'imagen_url': "https://www.lorealparisusa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-loreal-usa-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "L'Oréal Paris", 'estado': "activo", 'especificaciones': {"Función": "Reparación de puntas", "Beneficio": "Sellado de puntas", "Contenido": "40ml"}}},
        
        # EAU DE PARFUM
        {'seudocategoria_id': seudo_eau_de_parfum.id, 'nombre': "Chanel N°5 Eau de Parfum", 'defaults': {'descripcion': "Fragancia icónica floral aldehídica", 'precio': 320000, 'costo': 160000, 'imagen_url': "https://www.chanel.com/images/q_auto,f_jpg,w_500/05-white-n5-eau-de-parfum-spray-3-4fl-oz-packshot-default-134440-8828453524546.jpg", 'existencia': 15, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Chanel", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Floral Aldehídica", "Notas": "Rosa, jazmín, aldehídos"}}},
        {'seudocategoria_id': seudo_eau_de_parfum.id, 'nombre': "Dior J'adore Eau de Parfum", 'defaults': {'descripcion': "Fragancia floral fresca y luminosa", 'precio': 280000, 'costo': 140000, 'imagen_url': "https://www.dior.com/couture/var/dior/storage/images/14441515/1_1200_1200/0/14441515.jpg", 'existencia': 18, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dior", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Floral", "Notas": "Ylang-ylang, rosa, granada"}}},
        
        # EAU DE TOILETTE
        {'seudocategoria_id': seudo_eau_de_toilette.id, 'nombre': "Light Blue Eau de Toilette", 'defaults': {'descripcion': "Fragancia fresca y frutal", 'precio': 180000, 'costo': 90000, 'imagen_url': "https://www.dolcegabbana.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-dolcegabbana-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dolce & Gabbana", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Toilette", "Familia Olfativa": "Frutal Cítrica", "Notas": "Limón, manzana, cedro"}}},
        {'seudocategoria_id': seudo_eau_de_toilette.id, 'nombre': "Acqua di Gio Eau de Toilette", 'defaults': {'descripcion': "Fragancia acuática aromática", 'precio': 150000, 'costo': 75000, 'imagen_url': "https://www.giorgioarmani.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-giorgioarmani-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Giorgio Armani", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Toilette", "Familia Olfativa": "Acuática Aromática", "Notas": "Notas marinas, bergamota, pachulí"}}},
        
        # PERFUMES FLORALES
        {'seudocategoria_id': seudo_perfumes_florales.id, 'nombre': "Flowerbomb Eau de Parfum", 'defaults': {'descripcion': "Fragancia floral explosiva", 'precio': 250000, 'costo': 125000, 'imagen_url': "https://www.viktor-rolf.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-viktor-rolf-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 12, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Viktor & Rolf", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Floral Oriental", "Notas": "Orquídea, freesia, rosa"}}},
        {'seudocategoria_id': seudo_perfumes_florales.id, 'nombre': "La Vie Est Belle Eau de Parfum", 'defaults': {'descripcion': "Fragancia floral gourmand", 'precio': 220000, 'costo': 110000, 'imagen_url': "https://www.lancome-usa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lancome-usa-Library/default/dw1d9b5b4c/images/2021/La-Vie-Est-Belle/3147758019210_01.jpg?sw=500&sh=500", 'existencia': 15, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Lancôme", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Floral Gourmand", "Notas": "Iris, jazmín, vainilla"}}},
        
        # PERFUMES FRUTALES
        {'seudocategoria_id': seudo_perfumes_frutales.id, 'nombre': "Dolce Eau de Parfum", 'defaults': {'descripcion': "Fragancia frutal floral", 'precio': 200000, 'costo': 100000, 'imagen_url': "https://www.dolcegabbana.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-dolcegabbana-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 18, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dolce & Gabbana", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Frutal Floral", "Notas": "Naranja amarga, papaya, flor de almendro"}}},
        {'seudocategoria_id': seudo_perfumes_frutales.id, 'nombre': "Daisy Eau de Toilette", 'defaults': {'descripcion': "Fragancia frutal floral fresca", 'precio': 180000, 'costo': 90000, 'imagen_url': "https://www.marcjacobs.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-marc-jacobs-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Marc Jacobs", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Toilette", "Familia Olfativa": "Frutal Floral", "Notas": "Fresa, violeta, jazmín"}}},
        
        # PERFUMES PARA HOMBRE
        {'seudocategoria_id': seudo_parfum_hombre.id, 'nombre': "Bleu de Chanel Parfum", 'defaults': {'descripcion': "Fragancia aromática maderada", 'precio': 300000, 'costo': 150000, 'imagen_url': "https://www.chanel.com/images/q_auto,f_jpg,w_500/09-blue-bleu-de-chanel-eau-de-parfum-spray-3-4fl-oz-packshot-default-134440-8828453524546.jpg", 'existencia': 12, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Chanel", 'estado': "activo", 'especificaciones': {"Tipo": "Parfum", "Familia Olfativa": "Aromática Maderada", "Notas": "Menta, incienso, cedro"}}},
        {'seudocategoria_id': seudo_parfum_hombre.id, 'nombre': "Sauvage Eau de Parfum", 'defaults': {'descripcion': "Fragancia especiada fresca", 'precio': 280000, 'costo': 140000, 'imagen_url': "https://www.dior.com/couture/var/dior/storage/images/14441515/1_1200_1200/0/14441515.jpg", 'existencia': 15, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dior", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Especiada Fresca", "Notas": "Pimienta, lavanda, ámbar"}}},
        
        # COLONIAS
        
        # AFTERSHAVE
        {'seudocategoria_id': seudo_aftershave.id, 'nombre': "Aftershave Balm", 'defaults': {'descripcion': "Loción after shave calmante", 'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.dior.com/couture/var/dior/storage/images/14441515/1_1200_1200/0/14441515.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dior", 'estado': "activo", 'especificaciones': {"Tipo": "Bálsamo", "Beneficio": "Calma e hidrata", "Contenido": "100ml"}}},
        {'seudocategoria_id': seudo_aftershave.id, 'nombre': "Aftershave Lotion", 'defaults': {'descripcion': "Loción after shave refrescante", 'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.hugoboss.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-hugo-boss-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Hugo Boss", 'estado': "activo", 'especificaciones': {"Tipo": "Loción", "Beneficio": "Refresca y desinfecta", "Contenido": "100ml"}}},
        
        # PERFUMES MADERADOS
        {'seudocategoria_id': seudo_perfumes_maderados.id, 'nombre': "Terre d'Hermès Eau de Toilette", 'defaults': {'descripcion': "Fragancia maderada mineral", 'precio': 220000, 'costo': 110000, 'imagen_url': "https://www.hermes.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-hermes-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 15, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Hermès", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Toilette", "Familia Olfativa": "Maderada Mineral", "Notas": "Naranja amarga, pimienta, benjuí"}}},
        {'seudocategoria_id': seudo_perfumes_maderados.id, 'nombre': "Santal 33 Eau de Parfum", 'defaults': {'descripcion': "Fragancia maderada especiada", 'precio': 250000, 'costo': 125000, 'imagen_url': "https://www.lelabofragrances.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-le-labo-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 12, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Le Labo", 'estado': "activo", 'especificaciones': {"Tipo": "Eau de Parfum", "Familia Olfativa": "Maderada Especiada", "Notas": "Sándalo, cardamomo, violeta"}}},
    ]

    for producto_data in productos_a_crear:
        # El identificador único de un producto es su nombre y la seudocategoría
        identificador = {'nombre': producto_data['nombre'], 'seudocategoria_id': producto_data['seudocategoria_id']}
        get_or_create(db.session, Productos, defaults=producto_data['defaults'], **identificador)

    # Commit final para los productos
    db.session.commit()

    print("\nDatos de prueba creados o verificados con éxito. Total de productos:", Productos.query.count())