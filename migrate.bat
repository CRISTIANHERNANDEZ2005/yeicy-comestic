set FLASK_APP=run.py
python -m flask db init
python -m flask db migrate -m "Añadir tablas Pedido y PedidoProducto"
python -m flask db upgrade