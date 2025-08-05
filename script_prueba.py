# script_prueba.py
from app import create_app
from app.extensions import db
from app.models.models import CategoriaPrincipal, Subcategoria, Seudocategoria, Producto

app = create_app()

with app.app_context():
    # Crear categorías principales
    cat_maquillaje = CategoriaPrincipal(
        nombre="Maquillaje", 
        descripcion="Productos de maquillaje para realzar tu belleza", 
        estado="activo"
    )
    cat_cuidado_facial = CategoriaPrincipal(
        nombre="Cuidado Facial", 
        descripcion="Productos para el cuidado y tratamiento de la piel", 
        estado="activo"
    )
    cat_cuidado_cabello = CategoriaPrincipal(
        nombre="Cuidado del Cabello", 
        descripcion="Productos para el cuidado y tratamiento capilar", 
        estado="activo"
    )
    cat_fragancias = CategoriaPrincipal(
        nombre="Fragancias", 
        descripcion="Perfumes y colonias para hombre y mujer", 
        estado="activo"
    )
    
    db.session.add_all([cat_maquillaje, cat_cuidado_facial, cat_cuidado_cabello, cat_fragancias])
    db.session.commit()

    # --- MAQUILLAJE ---
    # Subcategoría: Labios
    sub_labios = Subcategoria(
        nombre="Labios", 
        descripcion="Productos para el maquillaje de labios", 
        categoria_principal_id=cat_maquillaje.id, 
        estado="activo"
    )
    db.session.add(sub_labios)
    db.session.commit()
    
    # Seudocategorías para Labios
    seudo_labiales_mate = Seudocategoria(
        nombre="Labiales Mate", 
        descripcion="Labiales de acabado mate y larga duración", 
        subcategoria_id=sub_labios.id, 
        estado="activo"
    )
    seudo_gloss = Seudocategoria(
        nombre="Gloss Labiales", 
        descripcion="Brillos y gloss para labios con efecto brillante", 
        subcategoria_id=sub_labios.id, 
        estado="activo"
    )
    db.session.add_all([seudo_labiales_mate, seudo_gloss])
    db.session.commit()
    
    # Subcategoría: Ojos
    sub_ojos = Subcategoria(
        nombre="Ojos", 
        descripcion="Productos para el maquillaje de ojos", 
        categoria_principal_id=cat_maquillaje.id, 
        estado="activo"
    )
    db.session.add(sub_ojos)
    db.session.commit()
    
    # Seudocategorías para Ojos
    seudo_mascaras = Seudocategoria(
        nombre="Máscaras de Pestañas", 
        descripcion="Productos para dar volumen y longitud a las pestañas", 
        subcategoria_id=sub_ojos.id, 
        estado="activo"
    )
    seudo_sombras = Seudocategoria(
        nombre="Sombras de Ojos", 
        descripcion="Paletas y sombras individuales para ojos", 
        subcategoria_id=sub_ojos.id, 
        estado="activo"
    )
    db.session.add_all([seudo_mascaras, seudo_sombras])
    db.session.commit()

    # --- CUIDADO FACIAL ---
    # Subcategoría: Limpieza
    sub_limpieza = Subcategoria(
        nombre="Limpieza Facial", 
        descripcion="Productos para la limpieza diaria de la piel", 
        categoria_principal_id=cat_cuidado_facial.id, 
        estado="activo"
    )
    db.session.add(sub_limpieza)
    db.session.commit()
    
    # Seudocategorías para Limpieza
    seudo_geles = Seudocategoria(
        nombre="Geles Limpiadores", 
        descripcion="Geles de limpieza para todo tipo de piel", 
        subcategoria_id=sub_limpieza.id, 
        estado="activo"
    )
    seudo_aguas_micelares = Seudocategoria(
        nombre="Aguas Micelares", 
        descripcion="Soluciones micelares para desmaquillar y limpiar", 
        subcategoria_id=sub_limpieza.id, 
        estado="activo"
    )
    db.session.add_all([seudo_geles, seudo_aguas_micelares])
    db.session.commit()
    
    # Subcategoría: Hidratación
    sub_hidratacion = Subcategoria(
        nombre="Hidratación", 
        descripcion="Productos para hidratar y nutrir la piel", 
        categoria_principal_id=cat_cuidado_facial.id, 
        estado="activo"
    )
    db.session.add(sub_hidratacion)
    db.session.commit()
    
    # Seudocategorías para Hidratación
    seudo_cremas = Seudocategoria(
        nombre="Cremas Hidratantes", 
        descripcion="Cremas faciales para hidratación diaria", 
        subcategoria_id=sub_hidratacion.id, 
        estado="activo"
    )
    seudo_serums = Seudocategoria(
        nombre="Sérums Faciales", 
        descripcion="Sérums concentrados para tratamientos específicos", 
        subcategoria_id=sub_hidratacion.id, 
        estado="activo"
    )
    db.session.add_all([seudo_cremas, seudo_serums])
    db.session.commit()

    # --- CUIDADO DEL CABELLO ---
    # Subcategoría: Shampoo
    sub_shampoo = Subcategoria(
        nombre="Shampoo", 
        descripcion="Shampoos para diferentes tipos de cabello", 
        categoria_principal_id=cat_cuidado_cabello.id, 
        estado="activo"
    )
    db.session.add(sub_shampoo)
    db.session.commit()
    
    # Seudocategorías para Shampoo
    seudo_shampoo_hidratante = Seudocategoria(
        nombre="Shampoo Hidratante", 
        descripcion="Shampoos con propiedades hidratantes", 
        subcategoria_id=sub_shampoo.id, 
        estado="activo"
    )
    seudo_shampoo_anticaspa = Seudocategoria(
        nombre="Shampoo Anticaspa", 
        descripcion="Shampoos para tratamiento de caspa", 
        subcategoria_id=sub_shampoo.id, 
        estado="activo"
    )
    db.session.add_all([seudo_shampoo_hidratante, seudo_shampoo_anticaspa])
    db.session.commit()
    
    # Subcategoría: Tratamientos
    sub_tratamientos = Subcategoria(
        nombre="Tratamientos", 
        descripcion="Productos para tratamientos capilares", 
        categoria_principal_id=cat_cuidado_cabello.id, 
        estado="activo"
    )
    db.session.add(sub_tratamientos)
    db.session.commit()
    
    # Seudocategorías para Tratamientos
    seudo_mascarillas = Seudocategoria(
        nombre="Mascarillas Capilares", 
        descripcion="Mascarillas nutritivas para el cabello", 
        subcategoria_id=sub_tratamientos.id, 
        estado="activo"
    )
    seudo_aceites = Seudocategoria(
        nombre="Aceites Capilares", 
        descripcion="Aceites para tratamiento y brillo del cabello", 
        subcategoria_id=sub_tratamientos.id, 
        estado="activo"
    )
    db.session.add_all([seudo_mascarillas, seudo_aceites])
    db.session.commit()

    # --- FRAGANCIAS ---
    # Subcategoría: Mujer
    sub_fragancias_mujer = Subcategoria(
        nombre="Fragancias para Mujer", 
        descripcion="Perfumes y colonias para mujer", 
        categoria_principal_id=cat_fragancias.id, 
        estado="activo"
    )
    db.session.add(sub_fragancias_mujer)
    db.session.commit()
    
    # Seudocategorías para Fragancias Mujer
    seudo_eau_de_parfum = Seudocategoria(
        nombre="Eau de Parfum", 
        descripcion="Perfumes con alta concentración de esencias", 
        subcategoria_id=sub_fragancias_mujer.id, 
        estado="activo"
    )
    seudo_eau_de_toilette = Seudocategoria(
        nombre="Eau de Toilette", 
        descripcion="Fragancias ligeras para uso diario", 
        subcategoria_id=sub_fragancias_mujer.id, 
        estado="activo"
    )
    db.session.add_all([seudo_eau_de_parfum, seudo_eau_de_toilette])
    db.session.commit()
    
    # Subcategoría: Hombre
    sub_fragancias_hombre = Subcategoria(
        nombre="Fragancias para Hombre", 
        descripcion="Perfumes y colonias para hombre", 
        categoria_principal_id=cat_fragancias.id, 
        estado="activo"
    )
    db.session.add(sub_fragancias_hombre)
    db.session.commit()
    
    # Seudocategorías para Fragancias Hombre
    seudo_parfum_hombre = Seudocategoria(
        nombre="Perfumes para Hombre", 
        descripcion="Fragancias masculinas intensas", 
        subcategoria_id=sub_fragancias_hombre.id, 
        estado="activo"
    )
    seudo_colonias = Seudocategoria(
        nombre="Colonias", 
        descripcion="Fragancias ligeras para hombre", 
        subcategoria_id=sub_fragancias_hombre.id, 
        estado="activo"
    )
    db.session.add_all([seudo_parfum_hombre, seudo_colonias])
    db.session.commit()

    # ========== CREACIÓN DE PRODUCTOS ==========
    # ========== CREACIÓN DE PRODUCTOS ==========

    # --- PRODUCTOS DE MAQUILLAJE ---
    # Labiales Mate
    producto1 = Producto(
        nombre="Labial Mate Rojo Pasión",
        descripcion="Labial mate de larga duración en tono rojo intenso",
        precio=18.99,
        imagen_url="https://tauro.com.co/wp-content/uploads/2021/08/7702433291194.jpg",
        stock=45,
        seudocategoria_id=seudo_labiales_mate.id,
        marca="L'Oréal",
        estado="activo"
    )
    
    producto2 = Producto(
        nombre="Labial Mate Nude Elegante",
        descripcion="Tonos nude mate para un look natural y sofisticado",
        precio=16.50,
        imagen_url="https://beautycreationscol.com/cdn/shop/files/Labial_en_barra_Nudex.png?v=1718324768",
        stock=30,
        seudocategoria_id=seudo_labiales_mate.id,
        marca="Maybelline",
        estado="activo"
    )
    
    # Gloss Labiales
    producto3 = Producto(
        nombre="Gloss Brillante Rosé",
        descripcion="Gloss con efecto brillante y tono rosado",
        precio=12.99,
        imagen_url="https://example.com/gloss-rose.jpg",
        stock=40,
        seudocategoria_id=seudo_gloss.id,
        marca="NYX",
        estado="activo"
    )
    
    # Máscaras de Pestañas
    producto4 = Producto(
        nombre="Máscara Volumen Extremo",
        descripcion="Máscara de pestañas para un volumen impactante",
        precio=22.00,
        imagen_url="https://example.com/mascara-volumen.jpg",
        stock=25,
        seudocategoria_id=seudo_mascaras.id,
        marca="Maybelline",
        estado="activo"
    )
    
    # Sombras de Ojos
    producto5 = Producto(
        nombre="Paleta Sombras Nude",
        descripcion="Paleta con 12 tonos nude para crear diferentes looks",
        precio=29.99,
        imagen_url="https://example.com/paleta-nude.jpg",
        stock=20,
        seudocategoria_id=seudo_sombras.id,
        marca="Urban Decay",
        estado="activo"
    )

    # --- PRODUCTOS DE CUIDADO FACIAL ---
    # Geles Limpiadores
    producto6 = Producto(
        nombre="Gel Limpiador Piel Mixta",
        descripcion="Gel limpiador suave para piel mixta, libre de jabón",
        precio=15.50,
        imagen_url="https://example.com/gel-limpiador.jpg",
        stock=35,
        seudocategoria_id=seudo_geles.id,
        marca="La Roche-Posay",
        estado="activo"
    )
    
    # Aguas Micelares
    producto7 = Producto(
        nombre="Agua Micelar Sensibio",
        descripcion="Agua micelar para pieles sensibles, sin alcohol",
        precio=12.99,
        imagen_url="https://example.com/agua-micelar.jpg",
        stock=40,
        seudocategoria_id=seudo_aguas_micelares.id,
        marca="Bioderma",
        estado="activo"
    )
    
    # Cremas Hidratantes
    producto8 = Producto(
        nombre="Crema Hidratante 24h",
        descripcion="Hidratación intensa durante 24 horas, para todo tipo de piel",
        precio=18.75,
        imagen_url="https://example.com/crema-hidratante.jpg",
        stock=30,
        seudocategoria_id=seudo_cremas.id,
        marca="Neutrogena",
        estado="activo"
    )
    
    # Sérums Faciales
    producto9 = Producto(
        nombre="Sérum Vitamina C",
        descripcion="Sérum antioxidante con vitamina C para un brillo saludable",
        precio=32.99,
        imagen_url="https://example.com/serum-vitc.jpg",
        stock=25,
        seudocategoria_id=seudo_serums.id,
        marca="The Ordinary",
        estado="activo"
    )

    # --- PRODUCTOS DE CUIDADO DEL CABELLO ---
    # Shampoo Hidratante
    producto10 = Producto(
        nombre="Shampoo Hidratación Profunda",
        descripcion="Shampoo con aceite de argán para cabellos secos",
        precio=14.99,
        imagen_url="https://example.com/shampoo-hidratante.jpg",
        stock=40,
        seudocategoria_id=seudo_shampoo_hidratante.id,
        marca="Pantene",
        estado="activo"
    )
    
    # Shampoo Anticaspa
    producto11 = Producto(
        nombre="Shampoo Anticaspa Control",
        descripcion="Controla la caspa y alivia el picor del cuero cabelludo",
        precio=16.50,
        imagen_url="https://example.com/shampoo-anticaspa.jpg",
        stock=35,
        seudocategoria_id=seudo_shampoo_anticaspa.id,
        marca="Head & Shoulders",
        estado="activo"
    )
    
    # Mascarillas Capilares
    producto12 = Producto(
        nombre="Mascarilla Reparadora",
        descripcion="Tratamiento intensivo para cabellos dañados",
        precio=21.99,
        imagen_url="https://example.com/mascarilla-reparadora.jpg",
        stock=25,
        seudocategoria_id=seudo_mascarillas.id,
        marca="Garnier",
        estado="activo"
    )
    
    # Aceites Capilares
    producto13 = Producto(
        nombre="Aceite de Argán Puro",
        descripcion="Aceite 100% puro para nutrición y brillo del cabello",
        precio=19.99,
        imagen_url="https://example.com/aceite-argan.jpg",
        stock=30,
        seudocategoria_id=seudo_aceites.id,
        marca="Moroccanoil",
        estado="activo"
    )

    # --- PRODUCTOS DE FRAGANCIAS ---
    # Eau de Parfum (Mujer)
    producto14 = Producto(
        nombre="Floral Dream EDP",
        descripcion="Fragancia floral con notas de jazmín y vainilla",
        precio=65.00,
        imagen_url="https://example.com/floral-dream.jpg",
        stock=15,
        seudocategoria_id=seudo_eau_de_parfum.id,
        marca="Chanel",
        estado="activo"
    )
    
    # Eau de Toilette (Mujer)
    producto15 = Producto(
        nombre="Fresh Breeze EDT",
        descripcion="Fragancia fresca con notas cítricas y florales",
        precio=45.99,
        imagen_url="https://example.com/fresh-breeze.jpg",
        stock=20,
        seudocategoria_id=seudo_eau_de_toilette.id,
        marca="Dior",
        estado="activo"
    )
    
    # Perfumes para Hombre
    producto16 = Producto(
        nombre="Wood Essence Parfum",
        descripcion="Fragancia masculina con notas amaderadas y especiadas",
        precio=70.00,
        imagen_url="https://example.com/wood-essence.jpg",
        stock=12,
        seudocategoria_id=seudo_parfum_hombre.id,
        marca="Hugo Boss",
        estado="activo"
    )
    
    # Colonias (Hombre)
    producto17 = Producto(
        nombre="Blue Ocean Cologne",
        descripcion="Colonia fresca con notas acuáticas y amaderadas",
        precio=38.50,
        imagen_url="https://example.com/blue-ocean.jpg",
        stock=18,
        seudocategoria_id=seudo_colonias.id,
        marca="Calvin Klein",
        estado="activo"
    )

    # Añadir todos los productos a la sesión
    db.session.add_all([
        producto1, producto2, producto3, producto4, producto5, producto6, producto7,
        producto8, producto9, producto10, producto11, producto12, producto13,
        producto14, producto15, producto16, producto17
    ])
    db.session.commit()


    print("Datos de prueba creados con éxito. Total de productos:", Producto.query.count())