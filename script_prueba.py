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
        print(
            f"'{kwargs.get('nombre')}' en {model.__name__} ya existe. Omitiendo creación.")
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
            "descripcion": "Una colección completa de productos de maquillaje diseñados para realzar tu belleza natural, expresar tu creatividad y potenciar tu confianza. Desde bases impecables hasta colores vibrantes, encuentra todo lo que necesitas para crear looks espectaculares.",
            "subcategorias": {
                "Labios": {
                    "descripcion": "Descubre nuestra gama de productos para labios, formulados para ofrecer color, brillo y cuidado. Encuentra el acabado perfecto para cada ocasión, desde mates aterciopelados hasta glosses deslumbrantes.",
                    "seudocategorias": {
                        "Labiales Mate": "Experimenta un color intenso y un acabado aterciopelado sin brillo. Nuestros labiales mate ofrecen una pigmentación excepcional y una fórmula de larga duración que se mantiene cómoda durante horas.",
                        "Gloss Labiales": "Añade una dimensión de brillo y volumen a tus labios. Nuestra selección de glosses ofrece desde acabados cristalinos hasta toques de color jugosos, con fórmulas hidratantes y no pegajosas.",
                        "Bálsamos Labiales": "Combina el cuidado intensivo con un toque de color natural. Estos bálsamos nutren, reparan y protegen tus labios de la resequedad, dejándolos suaves y con un aspecto saludable.",
                        "Lápices Labiales": "Define, da forma y previene que tu labial se corra con nuestra colección de lápices de alta precisión. Su textura cremosa se desliza sin esfuerzo para un contorno perfecto y duradero."
                    }
                },
                "Ojos": {
                    "descripcion": "Realza tu mirada con nuestra selección de productos para ojos. Desde máscaras que desafían la gravedad hasta paletas de sombras con infinitas posibilidades, crea looks que van de lo natural a lo dramático.",
                    "seudocategorias": {
                        "Máscaras de Pestañas": "Logra pestañas de impacto. Elige entre nuestras máscaras para obtener volumen, longitud, curvatura o una combinación de todos los efectos. Fórmulas que no se corren y cuidan tus pestañas.",
                        "Sombras de Ojos": "Juega con el color y la textura. Descubre paletas curadas por expertos y sombras individuales de alta pigmentación con acabados que van desde el mate sedoso hasta el metálico deslumbrante.",
                        "Delineadores": "Define tu mirada con la máxima precisión. Encuentra delineadores líquidos para trazos definidos, en gel para ahumados intensos y en lápiz para una aplicación suave y versátil.",
                        "Cejas": "Enmarca tu rostro y perfecciona tu look. Nuestra gama incluye lápices, geles, pomadas y polvos para rellenar, definir y fijar tus cejas con un acabado natural y duradero."
                    }
                },
                "Rostro": {
                    "descripcion": "Crea un lienzo perfecto con nuestra colección de productos para el rostro. Unifica el tono, corrige imperfecciones y añade dimensión para una piel radiante y de aspecto saludable.",
                    "seudocategorias": {
                        "Bases de Maquillaje": "Encuentra tu base ideal. Ofrecemos una amplia gama de coberturas, acabados y tonos para unificar la piel, disimular imperfecciones y lograr un acabado impecable que dura todo el día.",
                        "Correctores": "Borra, ilumina y perfecciona. Nuestros correctores de alta cobertura camuflan ojeras, manchas e imperfecciones con una fórmula ligera que no se cuartea.",
                        "Polvos Faciales": "Sella tu maquillaje y controla el brillo. Elige entre polvos sueltos para un acabado etéreo o compactos para retoques sobre la marcha. Fórmulas que matifican sin resecar.",
                        "Iluminadores": "Aporta luz y dimensión a tu rostro. Descubre iluminadores en polvo, líquidos y en crema para crear un brillo sutil o un efecto estroboscópico deslumbrante en los puntos altos del rostro.",
                        "Rubores": "Añade un toque de color saludable y juvenil. Nuestra selección de rubores en polvo, crema y líquidos se difumina a la perfección para un acabado natural y radiante."
                    }
                }
            }
        },
        "Cuidado del Cabello": {
            "descripcion": "Revitaliza tu cabello con nuestra selección de productos de cuidado capilar de calidad profesional. Desde la limpieza diaria hasta tratamientos intensivos, encuentra la solución perfecta para un cabello sano, fuerte y brillante.",
            "subcategorias": {
                "Shampoo": {
                    "descripcion": "La base de un cabello saludable comienza con la limpieza adecuada. Descubre nuestra gama de shampoos formulados para satisfacer las necesidades específicas de cada tipo de cabello.",
                    "seudocategorias": {
                        "Shampoo Hidratante": "Devuelve la vida y la suavidad al cabello seco y deshidratado. Fórmulas enriquecidas con agentes humectantes que limpian suavemente mientras reponen la hidratación esencial.",
                        "Shampoo Anticaspa": "Combate la caspa y alivia la picazón del cuero cabelludo. Tratamientos efectivos que purifican y equilibran, dejando una sensación de frescura y limpieza duradera.",
                        "Shampoo Color": "Protege tu inversión y mantén la vitalidad de tu color. Shampoos sin sulfatos y con filtros UV que previenen el deslave y mantienen el cabello teñido brillante y radiante por más tiempo.",
                        "Shampoo Volumen": "Aporta cuerpo y densidad al cabello fino y sin vida. Fórmulas ligeras que limpian en profundidad sin apelmazar, levantando las raíces para un efecto de volumen visible y duradero."
                    }
                },
                "Tratamientos": {
                    "descripcion": "Repara, nutre y transforma tu cabello con nuestros tratamientos intensivos. Soluciones concentradas para abordar problemas específicos como el daño, la sequedad o el frizz.",
                    "seudocategorias": {
                        "Mascarillas Capilares": "Un spa para tu cabello. Mascarillas ricas en nutrientes que reparan la fibra capilar desde el interior, devolviendo la fuerza, la elasticidad y un brillo espectacular.",
                        "Aceites Capilares": "El toque final para un cabello perfecto. Aceites ligeros que nutren, controlan el frizz, protegen del calor y aportan un brillo increíble sin dejar residuos grasos.",
                        "Acondicionadores": "Desenreda, suaviza y sella la hidratación. El paso esencial después del shampoo para cerrar la cutícula, facilitar el peinado y dejar el cabello manejable y sedoso.",
                        "Sérums Capilares": "Tratamientos específicos para problemas concretos. Fórmulas concentradas que actúan sobre las puntas abiertas, el encrespamiento o la falta de brillo para un acabado pulido y profesional."
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
        db.session.flush()  # Para asegurar que cat.id está disponible

        for nombre_sub, datos_sub in datos_cat['subcategorias'].items():
            sub, _ = get_or_create(db.session, Subcategorias, nombre=nombre_sub, categoria_principal_id=cat.id, defaults={
                'descripcion': datos_sub['descripcion'],
                'estado': 'activo'
            })
            db.session.flush()  # Para asegurar que sub.id está disponible

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
    seudo_labiales_mate = db.session.query(
        Seudocategorias).filter_by(nombre="Labiales Mate").one()
    seudo_gloss = db.session.query(Seudocategorias).filter_by(
        nombre="Gloss Labiales").one()
    seudo_balsamos = db.session.query(Seudocategorias).filter_by(
        nombre="Bálsamos Labiales").one()
    seudo_lapices = db.session.query(Seudocategorias).filter_by(
        nombre="Lápices Labiales").one()
    seudo_mascaras = db.session.query(Seudocategorias).filter_by(
        nombre="Máscaras de Pestañas").one()
    seudo_sombras = db.session.query(Seudocategorias).filter_by(
        nombre="Sombras de Ojos").one()
    seudo_delineadores = db.session.query(
        Seudocategorias).filter_by(nombre="Delineadores").one()
    seudo_cejas = db.session.query(
        Seudocategorias).filter_by(nombre="Cejas").one()
    seudo_bases = db.session.query(Seudocategorias).filter_by(
        nombre="Bases de Maquillaje").one()
    seudo_correctores = db.session.query(
        Seudocategorias).filter_by(nombre="Correctores").one()
    seudo_polvos = db.session.query(Seudocategorias).filter_by(
        nombre="Polvos Faciales").one()
    seudo_iluminadores = db.session.query(
        Seudocategorias).filter_by(nombre="Iluminadores").one()
    seudo_rubores = db.session.query(
        Seudocategorias).filter_by(nombre="Rubores").one()
    seudo_shampoo_hidratante = db.session.query(
        Seudocategorias).filter_by(nombre="Shampoo Hidratante").one()
    seudo_shampoo_anticaspa = db.session.query(
        Seudocategorias).filter_by(nombre="Shampoo Anticaspa").one()
    seudo_shampoo_color = db.session.query(
        Seudocategorias).filter_by(nombre="Shampoo Color").one()
    seudo_shampoo_volumen = db.session.query(
        Seudocategorias).filter_by(nombre="Shampoo Volumen").one()
    seudo_mascarillas = db.session.query(Seudocategorias).filter_by(
        nombre="Mascarillas Capilares").one()
    seudo_aceites = db.session.query(Seudocategorias).filter_by(
        nombre="Aceites Capilares").one()
    seudo_acondicionadores = db.session.query(
        Seudocategorias).filter_by(nombre="Acondicionadores").one()
    seudo_serums_capilares = db.session.query(
        Seudocategorias).filter_by(nombre="Sérums Capilares").one()

    productos_a_crear = [
        # LABIALES MATE
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Ruby Woo", 'defaults': {'descripcion': "Un ícono de la belleza. El Labial Matte Ruby Woo ofrece un rojo vivo universalmente favorecedor con un acabado mate aterciopelado. Su fórmula de alta pigmentación se desliza suavemente, proporcionando una cobertura total y un uso cómodo que dura horas sin resecar los labios.",
                                                                                                      'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M6P701_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Coloración de labios", "Acabado": "Mate Retro", "Tono": "Ruby Woo (Rojo azulado vivo)", "Contenido": "3g"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Diva", 'defaults': {'descripcion': "Desata tu lado audaz con el Labial Matte Diva. Este labial presenta un sofisticado tono burdeo intenso con un acabado mate impecable. Su fórmula cremosa y de larga duración asegura un color rico y uniforme que se mantiene perfecto durante todo el día, ideal para un look de impacto.",
                                                                                                  'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M60P01_640x800_0.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Coloración de labios", "Acabado": "Mate", "Tono": "Diva (Rojo burdeos intenso)", "Contenido": "3g"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte 999", 'defaults': {'descripcion': "El rojo perfecto existe. El Labial Matte 999 de Chanel es una leyenda en el mundo del maquillaje, un rojo clásico y atemporal con un lujoso acabado mate luminoso. Enriquecido con aceites nutritivos, viste los labios con un color profundo y una sensación de confort inigualable.", 'precio': 120000, 'costo': 60000,
                                                                                                 'imagen_url': "https://www.chanel.com/images/q_auto,f_jpg,w_500/09-red-rouge-allure-velvet-luminous-matte-lip-colour-3-5g-packshot-default-134440-8828453524546.jpg", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Chanel", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Coloración e Hidratación", "Acabado": "Mate Luminoso", "Tono": "999 (Rojo icónico)", "Contenido": "3.5g"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Velvet Teddy", 'defaults': {'descripcion': "El nude perfecto para cualquier ocasión. El Labial Matte Velvet Teddy es un best-seller mundial por su versátil tono nude beige con subtonos rosados. Su textura cremosa y acabado mate confortable lo convierten en el labial de uso diario definitivo, aportando un toque de sofisticación natural.",
                                                                                                          'precio': 85000, 'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2W201_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Coloración de labios", "Acabado": "Mate", "Tono": "Velvet Teddy (Beige profundo)", "Contenido": "3g"}}},
        {'seudocategoria_id': seudo_labiales_mate.id, 'nombre': "Labial Matte Ruby Kiss", 'defaults': {'descripcion': "Un beso de color vibrante. El Labial Matte Ruby Kiss de Revlon ofrece un impactante tono rojo cereza con un acabado mate moderno. Su fórmula ligera y de alta pigmentación proporciona un color audaz y duradero que no renuncia a la comodidad.", 'precio': 45000, 'costo': 22500,
                                                                                                       'imagen_url': "https://www.revlon.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-revlon-master-catalog/default/dw2d7a3b8e/images/Product/030/839780533030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Revlon", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Coloración de labios", "Acabado": "Mate Cremoso", "Tono": "Ruby Kiss (Rojo cereza)", "Contenido": "4.2g"}}},

        # GLOSS LABIALES
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Lip Glass Clear", 'defaults': {'descripcion': "El toque final para unos labios irresistibles. El Gloss Lip Glass Clear de MAC proporciona un brillo cristalino similar al vidrio. Su fórmula única puede usarse sola para un look natural y jugoso, o sobre tu labial favorito para intensificar el color y añadir una dimensión espectacular.",
                                                                                              'precio': 75000, 'costo': 37500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_SGZ01_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Brillo intenso, Efecto espejo", "Acabado": "Brillante (vidrio)", "Tono": "Transparente", "Contenido": "15ml"}}},
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Juicy Shutter Pink", 'defaults': {'descripcion': "Color y brillo que no se rinden. Este gloss con acabado tipo vinilo ofrece un vibrante tono rosa y una duración excepcional. Su fórmula innovadora se fija en los labios sin sensación pegajosa, manteniendo un color intenso y un brillo jugoso por horas.", 'precio': 42000, 'costo': 21000,
                                                                                                 'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/face/lip-gloss/400/super-stay-vinyl-ink-liquid-lipstick-40-pink.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Color y brillo de larga duración", "Acabado": "Vinilo", "Tono": "Pink (Rosa)", "Contenido": "5ml"}}},
        {'seudocategoria_id': seudo_gloss.id, 'nombre': "Gloss Crystal Glow", 'defaults': {'descripcion': "Lujo y luminosidad en tus labios. El Gloss Crystal Glow de Dior está infusionado con micropartículas de destello que capturan la luz, creando un efecto multidimensional y un brillo sofisticado. Su fórmula hidratante deja los labios suaves y con un volumen visiblemente realzado.", 'precio': 55000,
                                                                                           'costo': 27500, 'imagen_url': "https://www.dior.com/couture/var/dior/storage/images/14441515/1_1200_1200/0/14441515.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Dior", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Brillo, Volumen, Hidratación", "Acabado": "Brillante con destellos", "Tono": "Crystal", "Contenido": "6ml"}}},

        # BALSAMOS LABIALES
        {'seudocategoria_id': seudo_balsamos.id, 'nombre': "Bálsamo Labial Tinted Peach", 'defaults': {'descripcion': "Cuidado y color en un solo paso. Este bálsamo labial de Fresh nutre intensamente gracias a su fórmula enriquecida con aceites naturales, mientras deposita un sutil y favorecedor tono melocotón. Perfecto para un look fresco y labios visiblemente más suaves e hidratados.", 'precio': 35000, 'costo': 17500,
                                                                                                       'imagen_url': "https://www.fresh.com/dw/image/v2/BBQJ_PRD/on/demandware.static/-/Sites-fresh-master-catalog/default/dw1f4b3b5c/images/Product/011/325073000011_1.jpg?sw=500&sh=500", 'existencia': 45, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Fresh", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Hidratación, Nutrición, Color sutil", "Acabado": "Natural", "Tono": "Peach (Melocotón)", "Contenido": "4.3g"}}},
        {'seudocategoria_id': seudo_balsamos.id, 'nombre': "Bálsamo Labial Cherry", 'defaults': {'descripcion': "Protección, hidratación y un toque de color. Este bálsamo labial de Estée Lauder no solo embellece tus labios con un jugoso tono cereza, sino que también los protege de los rayos solares gracias a su filtro SPF 15. Su fórmula emoliente combate la resequedad para unos labios sanos y bonitos.",
                                                                                                 'precio': 28000, 'costo': 14000, 'imagen_url': "https://www.esteelauder.com/media/export/cms/products/640x800/el_sku_0L8A01_640x800_0.jpg", 'existencia': 50, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Estée Lauder", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Hidratación, Protección Solar", "Acabado": "Natural", "Tono": "Cherry (Cereza)", "SPF": "15", "Contenido": "3.5g"}}},

        # LÁPICES LABIALES
        {'seudocategoria_id': seudo_lapices.id, 'nombre': "Lápiz Labial Cherry", 'defaults': {'descripcion': "Define y rellena con precisión profesional. Este lápiz labial de NARS combina la facilidad de un lápiz con la intensidad de un labial. Su vibrante tono cereza y su fórmula cremosa permiten un delineado perfecto y un relleno completo con un acabado aterciopelado.", 'precio': 38000, 'costo': 19000,
                                                                                              'imagen_url': "https://www.narscosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-itemmaster_nars/default/dw3d3c0e2c/0605045020731_main.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "NARS", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Delinear y rellenar labios", "Acabado": "Aterciopelado", "Tono": "Cherry (Cereza)", "Contenido": "1.2g"}}},
        {'seudocategoria_id': seudo_lapices.id, 'nombre': "Lápiz Contorno Nude", 'defaults': {'descripcion': "El secreto para unos labios perfectamente definidos. Este lápiz de contorno de MAC, en un versátil tono nude, se desliza sin esfuerzo para delinear, dar forma y prevenir que el labial se corra. Su textura suave y duradera es la base ideal para cualquier look.", 'precio': 32000,
                                                                                              'costo': 16000, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_MAE01_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Delinear labios, Prevenir desbordamiento", "Acabado": "Mate", "Tono": "Nude", "Contenido": "1.45g"}}},

        # MÁSCARAS DE PESTAÑAS
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas Hypnose", 'defaults': {'descripcion': "Consigue una mirada hipnótica con esta máscara de pestañas de Lancôme. Su cepillo patentado y fórmula exclusiva permiten construir un volumen a medida, desde un look natural hasta uno dramáticamente intenso, sin crear grumos. Cada capa intensifica tus pestañas para un efecto impactante.", 'precio': 95000, 'costo': 47500,
                                                                                                       'imagen_url': "https://www.lancome-usa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-lancome-usa-Library/default/dw1d9b5b4c/images/2021/Hypnose/3147758019210_01.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Lancôme", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Volumen modulable", "Color": "Negro", "Resistente al agua": "No", "Tipo de cepillo": "PowerFULL™"}}},
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas Better Than Sex", 'defaults': {'descripcion': "Una máscara de pestañas legendaria que cumple lo que promete. Su cepillo en forma de reloj de arena separa, cubre y riza cada pestaña a la perfección. La fórmula, enriquecida con colágeno, proporciona un volumen y una longitud extremos para unas pestañas de infarto.", 'precio': 85000, 'costo': 42500,
                                                                                                               'imagen_url': "https://www.tartecosmetics.com/dw/image/v2/BBTX_PRD/on/demandware.static/-/Sites-tarte-master-catalog/default/dw9e5c1e5c/images/product/BEAUTY/31925/31925_01.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Tarte", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Volumen y curvatura", "Color": "Negro Intenso", "Resistente al agua": "Sí", "Ingrediente clave": "Colágeno"}}},
        {'seudocategoria_id': seudo_mascaras.id, 'nombre': "Máscara de Pestañas They're Real", 'defaults': {'descripcion': "Logra el efecto de pestañas postizas con esta innovadora máscara de Benefit. Su cepillo especialmente diseñado con punta de erizo alcanza hasta las pestañas más pequeñas, alargando, curvando, voluminizando y separando para una mirada de alto impacto que dura todo el día.", 'precio': 75000, 'costo': 37500,
                                                                                                            'imagen_url': "https://www.benefitcosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-benefit-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Benefit", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Funcion": "Alargamiento y separación", "Color": "Negro", "Resistente al agua": "Sí", "Tipo de cepillo": "Punta de erizo"}}},

        # SOMBRAS DE OJOS
        {'seudocategoria_id': seudo_sombras.id, 'nombre': "Paleta Sombras Naked", 'defaults': {'descripcion': "La paleta que revolucionó los neutros. Naked de Urban Decay ofrece 12 sombras de ojos versátiles en una gama de tonos que van desde el beige pálido hasta el gris plomo más intenso. Su fórmula de alta pigmentación y textura aterciopelada permite crear looks infinitos, desde los más sutiles hasta los más dramáticos.", 'precio': 145000, 'costo': 72500,
                                                                                               'imagen_url': "https://www.urbandecay.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-urbandecay-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Urban Decay", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Maquillaje de ojos", "Acabado": "Mixto (Mate, Satinado, Brillante)", "Tonos": "12 neutros", "Incluye": "Espejo y pincel"}}},
        {'seudocategoria_id': seudo_sombras.id, 'nombre': "Paleta Sombras Modern Renaissance", 'defaults': {'descripcion': "Una obra de arte para tus ojos. La paleta Modern Renaissance de Anastasia Beverly Hills presenta 14 tonos románticos y cálidos, desde neutros esenciales hasta bayas y rojos intensos. Su fórmula ultrapigmentada y fácil de difuminar te permite crear looks modernos y atemporales con acabados mates y metálicos.", 'precio': 155000, 'costo': 77500,
                                                                                                            'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 18, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Maquillaje de ojos", "Acabado": "Mixto (Mate, Metálico)", "Tonos": "14 cálidos y bayas", "Incluye": "Espejo y pincel"}}},

        # DELINEADORES
        {'seudocategoria_id': seudo_delineadores.id, 'nombre': "Delineador Líquido Black", 'defaults': {'descripcion': "Precisión y definición en un solo trazo. Este delineador líquido de Maybelline cuenta con una punta de fieltro ultrafina que permite un control total para crear desde líneas delgadas y sutiles hasta un cat-eye audaz. Su fórmula negra intensa es resistente al agua y dura todo el día sin correrse.",
                                                                                                        'precio': 55000, 'costo': 27500, 'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/eye/eyeliner/110/eyestudio-master-precise-ink-eyeliner-110-black.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Delineado de ojos", "Formato": "Líquido (Plumón)", "Color": "Negro", "Duración": "24 horas"}}},
        {'seudocategoria_id': seudo_delineadores.id, 'nombre': "Delineador Gel Black", 'defaults': {'descripcion': "La intensidad de un delineador líquido con la facilidad de una fórmula en gel. El delineador de Bobbi Brown ofrece un color negro profundo y una aplicación suave que no tira de la piel. Es perfecto para crear líneas precisas o looks ahumados, con una duración excepcional a prueba de agua y sudor.",
                                                                                                    'precio': 65000, 'costo': 32500, 'imagen_url': "https://www.bobbibrown.com/media/export/cms/products/640x800/bb_sku_S9N301_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Bobbi Brown", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Delineado de ojos", "Formato": "Gel", "Color": "Negro Intenso", "Duración": "12 horas"}}},

        # CEJAS
        {'seudocategoria_id': seudo_cejas.id, 'nombre': "Lápiz para Cejas Taupe", 'defaults': {'descripcion': "Cejas perfectas con un acabado natural. Este lápiz de Anastasia Beverly Hills tiene una punta ultrafina que imita el vello natural, permitiendo rellenar y definir las cejas con una precisión increíble. Su fórmula resistente al agua y de larga duración asegura que tus cejas se mantengan impecables.", 'precio': 45000, 'costo': 22500,
                                                                                               'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Definir y rellenar cejas", "Formato": "Lápiz retráctil", "Color": "Taupe", "Duración": "12 horas"}}},
        {'seudocategoria_id': seudo_cejas.id, 'nombre': "Gel para Cejas Clear", 'defaults': {'descripcion': "Mantén tus cejas en su sitio todo el día. Este gel transparente de MAC peina y fija las cejas sin dejar residuos ni sensación de rigidez. Su fórmula ligera y no pegajosa es perfecta para un look pulido y natural, o para sellar el maquillaje de cejas.", 'precio': 35000,
                                                                                             'costo': 17500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_MGZ01_640x800_0.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Fijar cejas", "Formato": "Gel", "Color": "Transparente", "Duración": "8 horas"}}},

        # BASES DE MAQUILLAJE
        {'seudocategoria_id': seudo_bases.id, 'nombre': "Base Double Wear", 'defaults': {'descripcion': "La base de maquillaje que se mantiene impecable durante 24 horas. Double Wear de Estée Lauder ofrece una cobertura media a alta con un acabado natural semi-mate. Su fórmula ligera y confortable resiste el calor, la humedad y la actividad, manteniendo la piel perfecta sin necesidad de retoques.", 'precio': 95000,
                                                                                         'costo': 47500, 'imagen_url': "https://www.esteelauder.com/media/export/cms/products/640x800/el_sku_0W1A01_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Estée Lauder", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Tipo de Piel": "Todo tipo", "Cobertura": "Media a Alta (Construible)", "Acabado": "Semi-Mate Natural", "Duración": "24 horas"}}},
        {'seudocategoria_id': seudo_bases.id, 'nombre': "Base Pro Filt'r", 'defaults': {'descripcion': "Una base que se adapta a tu piel. Pro Filt'r de Fenty Beauty ofrece una cobertura media construible con un acabado mate suave y difuminado. Su tecnología adaptable al clima la hace resistente al sudor y la humedad, y su amplia gama de tonos asegura un match perfecto para cada piel.", 'precio': 85000, 'costo': 42500,
                                                                                        'imagen_url': "https://www.fentybeauty.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-fenty-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Fenty Beauty", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Piel": "Normal, Mixta, Grasa", "Cobertura": "Media (Construible)", "Acabado": "Mate Suave", "Duración": "Larga duración"}}},

        # CORRECTORES
        {'seudocategoria_id': seudo_correctores.id, 'nombre': "Corrector Eraser", 'defaults': {'descripcion': "Borra ojeras e imperfecciones al instante. El corrector Eraser de Maybelline, con su icónico aplicador de esponja, facilita una aplicación precisa y difuminada. Su fórmula de alta cobertura ilumina la zona de la ojera y corrige rojeces sin marcar las líneas de expresión.", 'precio': 55000, 'costo': 27500,
                                                                                               'imagen_url': "https://www.maybelline.com/~/media/mny/global/products/face/concealer/120/instant-age-rewind-eraser-dark-circles-treatment-concealer-120-light.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Maybelline", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Corrección de ojeras e imperfecciones", "Cobertura": "Alta", "Zona de uso": "Contorno de ojos, rostro", "Formato": "Líquido con aplicador de esponja"}}},
        {'seudocategoria_id': seudo_correctores.id, 'nombre': "Corrector Longwear", 'defaults': {'descripcion': "Cobertura total que dura todo el día. El corrector Pro Longwear de MAC es un fluido ligero pero de alta cobertura que camufla imperfecciones, ojeras y manchas con un acabado mate natural. Su fórmula de larga duración se mantiene intacta hasta por 15 horas.", 'precio': 75000,
                                                                                                 'costo': 37500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2U201_640x800_0.jpg", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Funcion": "Corrección de imperfecciones", "Cobertura": "Alta", "Acabado": "Mate Natural", "Duración": "15 horas"}}},

        # POLVOS FACIALES
        {'seudocategoria_id': seudo_polvos.id, 'nombre': "Polvo Compacto Translucent", 'defaults': {'descripcion': "Sella tu maquillaje y controla el brillo sobre la marcha. Este polvo compacto translúcido de MAC ofrece un acabado mate natural que fija la base y el corrector sin añadir peso ni color. Es perfecto para retoques durante el día, dejando la piel con un aspecto fresco y pulido.", 'precio': 65000,
                                                                                                    'costo': 32500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2N201_640x800_0.jpg", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Piel": "Normal a Grasa", "Funcion": "Fijar maquillaje, Matificar", "Formato": "Compacto", "Color": "Translúcido"}}},
        {'seudocategoria_id': seudo_polvos.id, 'nombre': "Polvo Suelto Invisible", 'defaults': {'descripcion': "El secreto de los maquilladores para un acabado de alfombra roja. El polvo suelto de Laura Mercier es increíblemente fino y ligero, creando un efecto de 'soft-focus' que difumina imperfecciones y líneas finas. Fija el maquillaje para una duración extrema con un acabado impecable y natural.", 'precio': 75000, 'costo': 37500,
                                                                                                'imagen_url': "https://www.lauramercier.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-laura-mercier-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Laura Mercier", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Piel": "Todo tipo", "Funcion": "Fijar maquillaje, Efecto 'baking'", "Formato": "Suelto", "Color": "Translúcido"}}},

        # ILUMINADORES
        {'seudocategoria_id': seudo_iluminadores.id, 'nombre': "Iluminador Liquid Gold", 'defaults': {'descripcion': "Consigue un brillo de oro líquido. Este iluminador de MAC tiene una fórmula fluida que se funde con la piel para un acabado radiante y metálico. Puede mezclarse con la base para una luminosidad total o aplicarse en puntos altos para un efecto estroboscópico intenso.", 'precio': 85000,
                                                                                                      'costo': 42500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2G201_640x800_0.jpg", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Piel": "Todo tipo", "Funcion": "Iluminar, Efecto estroboscópico", "Formato": "Líquido", "Color": "Dorado"}}},
        {'seudocategoria_id': seudo_iluminadores.id, 'nombre': "Iluminador Polvo Champagne", 'defaults': {'descripcion': "Un toque de luz sofisticada. Este iluminador en polvo de Anastasia Beverly Hills, en un favorecedor tono champán, tiene una textura sedosa que se difumina a la perfección. Sus perlas reflectantes crean un brillo natural y edificable, desde sutil hasta cegador.", 'precio': 75000, 'costo': 37500,
                                                                                                          'imagen_url': "https://www.anastasiabeverlyhills.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-anastasia-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Anastasia Beverly Hills", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Piel": "Todo tipo", "Funcion": "Iluminar", "Formato": "Polvo", "Color": "Champán"}}},

        # RUBORES
        {'seudocategoria_id': seudo_rubores.id, 'nombre': "Rubor Powder Pink", 'defaults': {'descripcion': "Un rubor en polvo sedoso que aporta un toque de color saludable y natural. El tono rosa universal de NARS se difumina fácilmente sobre las mejillas, proporcionando un acabado mate suave y un rubor que dura todo el día. Perfecto para un look fresco y juvenil.", 'precio': 65000, 'costo': 32500,
                                                                                            'imagen_url': "https://www.narscosmetics.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-itemmaster_nars/default/dw3d3c0e2c/0605045020731_main.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "NARS", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Tipo de Piel": "Todo tipo", "Funcion": "Aportar color a las mejillas", "Formato": "Polvo", "Color": "Rosa"}}},
        {'seudocategoria_id': seudo_rubores.id, 'nombre': "Rubor Cream Peach", 'defaults': {'descripcion': "Consigue un rubor jugoso y natural con este rubor en crema de MAC. Su tono melocotón cálido se funde con la piel para un acabado luminoso y saludable. Su fórmula cremosa es fácil de aplicar con los dedos o una brocha, y puede usarse también en los labios.", 'precio': 55000,
                                                                                            'costo': 27500, 'imagen_url': "https://www.maccosmetics.com/media/export/cms/products/640x800/mac_sku_M2P201_640x800_0.jpg", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "MAC", 'estado': "activo", 'especificaciones': {"Genero": "Mujer", "Tipo de Piel": "Normal a Seca", "Funcion": "Aportar color a las mejillas", "Formato": "Crema", "Color": "Melocotón"}}},

        # SHAMPOO HIDRATANTE
        {'seudocategoria_id': seudo_shampoo_hidratante.id, 'nombre': "Shampoo Hidratación Extrema", 'defaults': {'descripcion': "Devuélvele la vida a tu cabello sediento. Este shampoo de Moroccanoil, infusionado con el icónico aceite de argán rico en antioxidantes y vitamina E, limpia suavemente mientras restaura la hidratación y la elasticidad del cabello seco y deshidratado.", 'precio': 45000, 'costo': 22500,
                                                                                                                 'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Seco, Deshidratado", "Funcion": "Hidratación profunda", "Ingrediente Clave": "Aceite de Argán", "Contenido": "250ml"}}},
        {'seudocategoria_id': seudo_shampoo_hidratante.id, 'nombre': "Shampoo Nutritivo", 'defaults': {'descripcion': "Un baño de nutrición para el cabello debilitado. El shampoo nutritivo de Kérastase, formulado con proteína de trigo y otros nutrientes esenciales, fortalece la fibra capilar desde el interior, reparando el daño y devolviendo la suavidad y el brillo al cabello.", 'precio': 38000, 'costo': 19000,
                                                                                                       'imagen_url': "https://www.kerastase.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-kerastase-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Kérastase", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Dañado, Debilitado", "Funcion": "Nutrición y reparación", "Ingrediente Clave": "Proteína de Trigo", "Contenido": "250ml"}}},

        # SHAMPOO ANTICASPA
        {'seudocategoria_id': seudo_shampoo_anticaspa.id, 'nombre': "Shampoo Anticaspa Intenso", 'defaults': {'descripcion': "Combate la caspa severa y la descamación con una fórmula de máxima eficacia. Este shampoo de Head & Shoulders contiene piritiona de zinc, un potente activo que controla el hongo causante de la caspa, aliviando la picazón y dejando el cuero cabelludo limpio y fresco.", 'precio': 42000, 'costo': 21000,
                                                                                                              'imagen_url': "https://www.headandshoulders.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-headandshoulders-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Head & Shoulders", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Con caspa severa", "Funcion": "Control de caspa intensivo", "Ingrediente Clave": "Piritiona de Zinc", "Contenido": "400ml"}}},
        {'seudocategoria_id': seudo_shampoo_anticaspa.id, 'nombre': "Shampoo Anticaspa Suave", 'defaults': {'descripcion': "Una solución suave para un cuero cabelludo sensible y con caspa. Formulado con aceite de árbol de té y otros extractos botánicos, este shampoo de Nioxin purifica y calma el cuero cabelludo, eliminando la caspa de forma delicada sin causar irritación.", 'precio': 45000, 'costo': 22500,
                                                                                                            'imagen_url': "https://www.nioxin.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-nioxin-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Nioxin", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Cuero cabelludo sensible", "Funcion": "Control de caspa suave", "Ingrediente Clave": "Aceite de Árbol de Té", "Contenido": "300ml"}}},

        # SHAMPOO COLOR
        {'seudocategoria_id': seudo_shampoo_color.id, 'nombre': "Shampoo Protección Color", 'defaults': {'descripcion': "Mantén tu color vibrante por más tiempo. Este shampoo sin sulfatos de Redken limpia delicadamente el cabello teñido, evitando el deslave prematuro del color. Su fórmula con pH ácido sella la cutícula capilar, aportando brillo y suavidad.", 'precio': 48000, 'costo': 24000,
                                                                                                         'imagen_url': "https://www.redken.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-redken-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Redken", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Teñido", "Color de Cabello": "Todo color", "Funcion": "Protección del color", "Libre de": "Sulfatos", "Contenido": "300ml"}}},
        {'seudocategoria_id': seudo_shampoo_color.id, 'nombre': "Shampoo Reparador Color", 'defaults': {'descripcion': "Repara, protege y mantiene el color. El shampoo N°4 de Olaplex, con su tecnología patentada de reconstrucción de enlaces, no solo protege el color del cabello teñido, sino que también repara el daño causado por procesos químicos, dejando el cabello más fuerte, sano y brillante.", 'precio': 52000, 'costo': 26000,
                                                                                                        'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Teñido, Dañado", "Color de Cabello": "Todo color", "Funcion": "Reparación y protección del color", "Tecnología": "Olaplex Bond Building", "Contenido": "250ml"}}},

        # SHAMPOO VOLUMEN
        {'seudocategoria_id': seudo_shampoo_volumen.id, 'nombre': "Shampoo Volumen Extremo", 'defaults': {'descripcion': "Transforma el cabello fino y sin vida. Este shampoo de Aveda, formulado con proteínas de trigo y extractos botánicos, aporta cuerpo y volumen desde la raíz hasta las puntas sin apelmazar, dejando el cabello visiblemente más denso y lleno de movimiento.", 'precio': 45000, 'costo': 22500,
                                                                                                          'imagen_url': "https://www.aveda.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-aveda-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Aveda", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Fino, Sin volumen", "Funcion": "Aportar volumen y cuerpo", "Ingrediente Clave": "Proteínas de Trigo", "Contenido": "250ml"}}},
        {'seudocategoria_id': seudo_shampoo_volumen.id, 'nombre': "Shampoo Volumen Ligero", 'defaults': {'descripcion': "Volumen que dura. Gracias a su molécula patentada, este shampoo de Living Proof limpia a fondo y repele la suciedad y la grasa, manteniendo el cabello limpio y con volumen por más tiempo. Ideal para cabello fino que tiende a apelmazarse.", 'precio': 38000, 'costo': 19000,
                                                                                                         'imagen_url': "https://www.livingproof.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-living-proof-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Living Proof", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Fino", "Funcion": "Volumen ligero y duradero", "Tecnología": "Molécula Engrosadora Patentada (PBAE)", "Contenido": "236ml"}}},

        # MASCARILLAS CAPILARES
        {'seudocategoria_id': seudo_mascarillas.id, 'nombre': "Mascarilla Reparadora Intensa", 'defaults': {'descripcion': "Un tratamiento de choque para el cabello más dañado. La mascarilla N°8 de Olaplex utiliza su tecnología patentada para reconstruir los enlaces de disulfuro rotos, reparando el daño químico, térmico y mecánico. Aporta hidratación, cuerpo y un brillo espectacular.", 'precio': 65000, 'costo': 32500,
                                                                                                            'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Dañado, Teñido, Tratado químicamente", "Funcion": "Reparación intensiva de enlaces", "Tecnología": "Olaplex Bond Building", "Contenido": "100ml"}}},
        {'seudocategoria_id': seudo_mascarillas.id, 'nombre': "Mascarilla Hidratante", 'defaults': {'descripcion': "Un oasis de hidratación para el cabello seco. Esta mascarilla de Moroccanoil, enriquecida con manteca de karité y aceite de argán, penetra profundamente en la fibra capilar para reponer la humedad perdida, mejorar la textura y devolver la suavidad y el brillo.", 'precio': 55000, 'costo': 27500,
                                                                                                    'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Seco, Grueso", "Funcion": "Hidratación profunda", "Ingrediente Clave": "Aceite de Argán, Manteca de Karité", "Contenido": "200ml"}}},

        # ACEITES CAPILARES
        {'seudocategoria_id': seudo_aceites.id, 'nombre': "Aceite de Argán Puro", 'defaults': {'descripcion': "Oro líquido para tu cabello y piel. Este aceite de argán 100% puro de Moroccanoil es un tratamiento multiusos que nutre, acondiciona y aporta un brillo increíble. Su fórmula ligera se absorbe rápidamente sin dejar residuos grasos.", 'precio': 85000, 'costo': 42500,
                                                                                               'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 20, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Todo tipo", "Funcion": "Nutrición, Brillo, Acondicionamiento", "Ingrediente Clave": "Aceite de Argán 100% Puro", "Uso": "Cabello y Piel", "Contenido": "100ml"}}},
        {'seudocategoria_id': seudo_aceites.id, 'nombre': "Aceite Nutritivo", 'defaults': {'descripcion': "Un cóctel de lujo para tu cabello. Este aceite de L'Oréal Paris combina 6 extractos de aceites florales para nutrir intensamente el cabello seco y sin vida. Aporta suavidad, brillo y disciplina sin apelmazar, dejando una fragancia exquisita.", 'precio': 75000, 'costo': 37500,
                                                                                           'imagen_url': "https://www.lorealparisusa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-loreal-usa-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 25, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "L'Oréal Paris", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Seco, sin vida", "Funcion": "Nutrición, Brillo, Suavidad", "Ingredientes": "Mezcla de 6 aceites florales", "Contenido": "90ml"}}},

        # ACONDICIONADORES
        {'seudocategoria_id': seudo_acondicionadores.id, 'nombre': "Acondicionador Hidratante", 'defaults': {'descripcion': "Desenreda, suaviza e hidrata en un solo paso. El complemento perfecto para el shampoo hidratante de Moroccanoil, este acondicionador sella la hidratación, combate el frizz y deja el cabello manejable, suave y lleno de brillo gracias al poder del aceite de argán.", 'precio': 38000, 'costo': 19000,
                                                                                                             'imagen_url': "https://www.moroccanoil.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-moroccanoil-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 40, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Moroccanoil", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Seco", "Funcion": "Hidratación y suavidad", "Ingrediente Clave": "Aceite de Argán", "Contenido": "250ml"}}},
        {'seudocategoria_id': seudo_acondicionadores.id, 'nombre': "Acondicionador Reparador", 'defaults': {'descripcion': "El paso esencial para un cabello fuerte y sano. El acondicionador N°5 de Olaplex continúa el trabajo de reparación de enlaces, a la vez que hidrata y elimina el encrespamiento. Fortalece el cabello dañado, dejándolo más resistente, suave y fácil de peinar.", 'precio': 42000, 'costo': 21000,
                                                                                                            'imagen_url': "https://www.olaplex.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-olaplex-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "Olaplex", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Dañado, Teñido", "Funcion": "Reparación y protección", "Tecnología": "Olaplex Bond Building", "Contenido": "250ml"}}},

        # SÉRUMS CAPILARES
        {'seudocategoria_id': seudo_serums_capilares.id, 'nombre': "Sérum Anti-Frizz", 'defaults': {'descripcion': "Domina el encrespamiento y consigue un cabello pulido y brillante. Este sérum icónico de John Frieda crea una barrera contra la humedad, alisando la cutícula capilar para eliminar el frizz al instante. Aporta un brillo espectacular y una suavidad sedosa.", 'precio': 55000, 'costo': 27500,
                                                                                                    'imagen_url': "https://www.johnfrieda.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-john-frieda-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 30, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "John Frieda", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Encrespado, Rebelde", "Funcion": "Control de frizz, Brillo", "Beneficio": "Suavidad y protección contra la humedad", "Contenido": "50ml"}}},
        {'seudocategoria_id': seudo_serums_capilares.id, 'nombre': "Sérum Reparador de Puntas", 'defaults': {'descripcion': "Un tratamiento específico para las puntas abiertas y dañadas. Este sérum de L'Oréal Paris actúa como un 'pegamento' capilar, sellando las puntas abiertas para prevenir que el daño avance. Su fórmula ligera nutre y suaviza, dejando el cabello con un aspecto más sano.", 'precio': 48000, 'costo': 24000,
                                                                                                             'imagen_url': "https://www.lorealparisusa.com/dw/image/v2/AAWX_PRD/on/demandware.static/-/Sites-loreal-usa-master-catalog/default/dw1d5d0b3c/images/product/030/741830455030_1.jpg?sw=500&sh=500", 'existencia': 35, 'stock_minimo': 10, 'stock_maximo': 100, 'marca': "L'Oréal Paris", 'estado': "activo", 'especificaciones': {"Genero": "Unisex", "Tipo de Cabello": "Con puntas abiertas", "Funcion": "Reparación de puntas", "Beneficio": "Sellado de puntas", "Contenido": "40ml"}}},
    ]

    for producto_data in productos_a_crear:
        # El identificador único de un producto es su nombre y la seudocategoría
        identificador = {
            'nombre': producto_data['nombre'], 'seudocategoria_id': producto_data['seudocategoria_id']}
        get_or_create(db.session, Productos,
                      defaults=producto_data['defaults'], **identificador)

    # Commit final para los productos
    db.session.commit()

    print("\nDatos de prueba creados o verificados con éxito. Total de productos:",
          Productos.query.count())
