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
    # Definición de la estructura de datos
    datos = {
        "Maquillaje": {
            "descripcion": "Productos de maquillaje para realzar tu belleza",
            "subcategorias": {
                "Labios": {
                    "descripcion": "Productos para el maquillaje de labios",
                    "seudocategorias": {
                        "Labiales Mate": "Labiales de acabado mate y larga duración",
                        "Gloss Labiales": "Brillos y gloss para labios con efecto brillante"
                    }
                },
                "Ojos": {
                    "descripcion": "Productos para el maquillaje de ojos",
                    "seudocategorias": {
                        "Máscaras de Pestañas": "Productos para dar volumen y longitud a las pestañas",
                        "Sombras de Ojos": "Paletas y sombras individuales para ojos"
                    }
                },
                "Rostro": {
                    "descripcion": "Productos para el maquillaje del rostro",
                    "seudocategorias": {
                        "Bases de Maquillaje": "Bases de maquillaje para unificar el tono de la piel",
                        "Correctores": "Correctores para cubrir imperfecciones"
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
                        "Aguas Micelares": "Soluciones micelares para desmaquillar y limpiar"
                    }
                },
                "Hidratación": {
                    "descripcion": "Productos para hidratar y nutrir la piel",
                    "seudocategorias": {
                        "Cremas Hidratantes": "Cremas faciales para hidratación diaria",
                        "Sérums Faciales": "Sérums concentrados para tratamientos específicos"
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
                        "Shampoo Anticaspa": "Shampoos para tratamiento de caspa"
                    }
                },
                "Tratamientos": {
                    "descripcion": "Productos para tratamientos capilares",
                    "seudocategorias": {
                        "Mascarillas Capilares": "Mascarillas nutritivas para el cabello",
                        "Aceites Capilares": "Aceites para tratamiento y brillo del cabello"
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
                        "Eau de Toilette": "Fragancias ligeras para uso diario"
                    }
                },
                "Fragancias para Hombre": {
                    "descripcion": "Perfumes y colonias para hombre",
                    "seudocategorias": {
                        "Perfumes para Hombre": "Fragancias masculinas intensas",
                        "Colonias": "Fragancias ligeras para hombre"
                    }
                }
            }
        }
    }

    # Procesar la estructura de datos para crear categorías
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
    seudo_mascaras = db.session.query(Seudocategorias).filter_by(nombre="Máscaras de Pestañas").one()
    seudo_sombras = db.session.query(Seudocategorias).filter_by(nombre="Sombras de Ojos").one()
    seudo_bases = db.session.query(Seudocategorias).filter_by(nombre="Bases de Maquillaje").one()
    seudo_correctores = db.session.query(Seudocategorias).filter_by(nombre="Correctores").one()
    seudo_geles = db.session.query(Seudocategorias).filter_by(nombre="Geles Limpiadores").one()
    seudo_aguas_micelares = db.session.query(Seudocategorias).filter_by(nombre="Aguas Micelares").one()
    seudo_cremas = db.session.query(Seudocategorias).filter_by(nombre="Cremas Hidratantes").one()
    seudo_serums = db.session.query(Seudocategorias).filter_by(nombre="Sérums Faciales").one()
    seudo_shampoo_hidratante = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Hidratante").one()
    seudo_shampoo_anticaspa = db.session.query(Seudocategorias).filter_by(nombre="Shampoo Anticaspa").one()
    seudo_mascarillas = db.session.query(Seudocategorias).filter_by(nombre="Mascarillas Capilares").one()
    seudo_aceites = db.session.query(Seudocategorias).filter_by(nombre="Aceites Capilares").one()
    seudo_eau_de_parfum = db.session.query(Seudocategorias).filter_by(nombre="Eau de Parfum").one()
    seudo_eau_de_toilette = db.session.query(Seudocategorias).filter_by(nombre="Eau de Toilette").one()
    seudo_parfum_hombre = db.session.query(Seudocategorias).filter_by(nombre="Perfumes para Hombre").one()
    seudo_colonias = db.session.query(Seudocategorias).filter_by(nombre="Colonias").one()

    productos_a_crear = [
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Mate Rojo Pasión", 'defaults': {'descripcion': "Labial mate de larga duración en tono rojo intenso", 'precio': 18.99, 'imagen_url': "https://tauro.com.co/wp-content/uploads/2021/08/7702433291194.jpg", 'stock': 45, 'marca': "L'Oréal", 'estado': "activo"}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Mate Nude Elegante", 'defaults': {'descripcion': "Tonos nude mate para un look natural y sofisticado", 'precio': 16.50, 'imagen_url': "https://beautycreationscol.com/cdn/shop/files/Labial_en_barra_Nudex.png?v=1718324768", 'stock': 30, 'marca': "Maybelline", 'estado': "activo"}},
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Brillante Rosé", 'defaults': {'descripcion': "Gloss con efecto brillante y tono rosado", 'precio': 12.99, 'imagen_url': "https://example.com/gloss-rose.jpg", 'stock': 40, 'marca': "NYX", 'estado': "activo"}},
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara Volumen Extremo", 'defaults': {'descripcion': "Máscara de pestañas para un volumen impactante", 'precio': 22.00, 'imagen_url': "https://example.com/mascara-volumen.jpg", 'stock': 25, 'marca': "Maybelline", 'estado': "activo"}},
        {'seudocategoria_id': seudo_sombras.id, 'nombre': "Paleta Sombras Nude", 'defaults': {'descripcion': "Paleta con 12 tonos nude para crear diferentes looks", 'precio': 29.99, 'imagen_url': "https://example.com/paleta-nude.jpg", 'stock': 20, 'marca': "Urban Decay", 'estado': "activo"}},
        {'seudocategoria_id': seudo_bases.id, 'nombre': "Base Fluida Larga Duración", 'defaults': {'descripcion': "Base de maquillaje fluida con acabado natural y larga duración", 'precio': 25.99, 'imagen_url': "https://example.com/base-fluida.jpg", 'stock': 30, 'marca': "Fenty Beauty", 'estado': "activo"}},
        {'seudocategoria_id': seudo_correctores.id, 'nombre': "Corrector Alta Cobertura", 'defaults': {'descripcion': "Corrector líquido de alta cobertura para ojeras e imperfecciones", 'precio': 14.50, 'imagen_url': "https://example.com/corrector-cobertura.jpg", 'stock': 25, 'marca': "NARS", 'estado': "activo"}},
        {'seudocategoria_id': seudo_geles.id, 'nombre': "Gel Limpiador Piel Mixta", 'defaults': {'descripcion': "Gel limpiador suave para piel mixta, libre de jabón", 'precio': 15.50, 'imagen_url': "https://example.com/gel-limpiador.jpg", 'stock': 35, 'marca': "La Roche-Posay", 'estado': "activo"}},
        {'seudocategoria_id': seudo_aguas_micelares.id, 'nombre': "Agua Micelar Sensibio", 'defaults': {'descripcion': "Agua micelar para pieles sensibles, sin alcohol", 'precio': 12.99, 'imagen_url': "https://example.com/agua-micelar.jpg", 'stock': 40, 'marca': "Bioderma", 'estado': "activo"}},
        {'seudocategoria_id': seudo_cremas.id, 'nombre': "Crema Hidratante 24h", 'defaults': {'descripcion': "Hidratación intensa durante 24 horas, para todo tipo de piel", 'precio': 18.75, 'imagen_url': "https://example.com/crema-hidratante.jpg", 'stock': 30, 'marca': "Neutrogena", 'estado': "activo"}},
        {'seudocategoria_id': seudo_serums.id, 'nombre': "Sérum Vitamina C", 'defaults': {'descripcion': "Sérum antioxidante con vitamina C para un brillo saludable", 'precio': 32.99, 'imagen_url': "https://example.com/serum-vitc.jpg", 'stock': 25, 'marca': "The Ordinary", 'estado': "activo"}},
        {'seudocategoria_id': seudo_shampoo_hidratante.id, 'nombre': "Shampoo Hidratación Profunda", 'defaults': {'descripcion': "Shampoo con aceite de argán para cabellos secos", 'precio': 14.99, 'imagen_url': "https://example.com/shampoo-hidratante.jpg", 'stock': 40, 'marca': "Pantene", 'estado': "activo"}},
        {'seudocategoria_id': seudo_shampoo_anticaspa.id, 'nombre': "Shampoo Anticaspa Control", 'defaults': {'descripcion': "Controla la caspa y alivia el picor del cuero cabelludo", 'precio': 16.50, 'imagen_url': "https://example.com/shampoo-anticaspa.jpg", 'stock': 35, 'marca': "Head & Shoulders", 'estado': "activo"}},
        {'seudocategoria_id': seudo_mascarillas.id, 'nombre': "Mascarilla Reparadora", 'defaults': {'descripcion': "Tratamiento intensivo para cabellos dañados", 'precio': 21.99, 'imagen_url': "https://example.com/mascarilla-reparadora.jpg", 'stock': 25, 'marca': "Garnier", 'estado': "activo"}},
        {'seudocategoria_id': seudo_aceites.id, 'nombre': "Aceite de Argán Puro", 'defaults': {'descripcion': "Aceite 100% puro para nutrición y brillo del cabello", 'precio': 19.99, 'imagen_url': "https://example.com/aceite-argan.jpg", 'stock': 30, 'marca': "Moroccanoil", 'estado': "activo"}},
        {'seudocategoria_id': seudo_eau_de_parfum.id, 'nombre': "Floral Dream EDP", 'defaults': {'descripcion': "Fragancia floral con notas de jazmín y vainilla", 'precio': 65.00, 'imagen_url': "https://example.com/floral-dream.jpg", 'stock': 15, 'marca': "Chanel", 'estado': "activo"}},
        {'seudocategoria_id': seudo_eau_de_toilette.id, 'nombre': "Fresh Breeze EDT", 'defaults': {'descripcion': "Fragancia fresca con notas cítricas y florales", 'precio': 45.99, 'imagen_url': "https://example.com/fresh-breeze.jpg", 'stock': 20, 'marca': "Dior", 'estado': "activo"}},
        {'seudocategoria_id': seudo_parfum_hombre.id, 'nombre': "Wood Essence Parfum", 'defaults': {'descripcion': "Fragancia masculina con notas amaderadas y especiadas", 'precio': 70.00, 'imagen_url': "https://example.com/wood-essence.jpg", 'stock': 12, 'marca': "Hugo Boss", 'estado': "activo"}},
        {'seudocategoria_id': seudo_colonias.id, 'nombre': "Blue Ocean Cologne", 'defaults': {'descripcion': "Colonia fresca con notas acuáticas y amaderadas", 'precio': 38.50, 'imagen_url': "https://example.com/blue-ocean.jpg", 'stock': 18, 'marca': "Calvin Klein", 'estado': "activo"}},
    ]

    for producto_data in productos_a_crear:
        # El identificador único de un producto es su nombre y la seudocategoría
        identificador = {'nombre': producto_data['nombre'], 'seudocategoria_id': producto_data['seudocategoria_id']}
        get_or_create(db.session, Productos, defaults=producto_data['defaults'], **identificador)

    # Commit final para los productos
    db.session.commit()

    print("\nDatos de prueba creados o verificados con éxito. Total de productos:", Productos.query.count())
