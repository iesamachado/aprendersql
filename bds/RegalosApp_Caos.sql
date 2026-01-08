DROP DATABASE IF EXISTS RegalosApp_Caos;
CREATE DATABASE RegalosApp_Caos;
USE RegalosApp_Caos;


CREATE TABLE categorias (
    id_categoria INT,
    nombre VARCHAR(50),
    descripcion TEXT
);

CREATE TABLE productos (
    id_producto INT,
    id_categoria INT,
    codigo_sku VARCHAR(20),
    nombre VARCHAR(150),
    descripcion TEXT, 
    precio DECIMAL(10,2),
    stock INT,
    activo TINYINT
);

CREATE TABLE usuarios (
    id_usuario INT,
    nombre VARCHAR(50),
    apellido VARCHAR(50),
    email VARCHAR(100),
    pais VARCHAR(50),
    ciudad VARCHAR(50),
    direccion VARCHAR(200),
    fecha_registro DATETIME
);

CREATE TABLE pedidos (
    id_pedido INT,
    id_usuario INT,
    fecha_pedido DATETIME,
    estado VARCHAR(20), 
    total DECIMAL(12,2),
    metodo_envio VARCHAR(50)
);

CREATE TABLE detalles_pedido (
    id_detalle INT,
    id_pedido INT,
    id_producto INT,
    cantidad INT,
    precio_unitario DECIMAL(10,2)
);

CREATE TABLE pagos (
    id_pago INT,
    id_pedido INT,
    fecha_pago DATETIME,
    monto DECIMAL(12,2),
    metodo_pago VARCHAR(50),
    referencia_transaccion VARCHAR(100)
);

CREATE TABLE historial_busquedas (
    id_log INT,
    id_usuario INT,
    termino_busqueda VARCHAR(100),
    fecha_busqueda DATETIME
);


CREATE INDEX idx_log_user ON historial_busquedas(id_usuario);
CREATE INDEX idx_log_term ON historial_busquedas(termino_busqueda);
CREATE INDEX idx_log_date ON historial_busquedas(fecha_busqueda);
CREATE INDEX idx_log_all ON historial_busquedas(id_usuario, termino_busqueda, fecha_busqueda);
DELIMITER $$

CREATE PROCEDURE LlenarBaseDeDatos()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE j INT DEFAULT 1;
    DECLARE usuario_random INT;
    DECLARE producto_random INT;
    DECLARE pedido_id INT;
    
    INSERT INTO categorias VALUES 
    (1, 'Electrónica', 'Gadgets y dispositivos'), (2, 'Juguetes', 'Para todas las edades'),
    (3, 'Hogar', 'Decoración y útiles'), (4, 'Libros', 'Lectura y educación'),
    (5, 'Ropa', 'Moda y accesorios'), (6, 'Deportes', 'Equipamiento'),
    (7, 'Belleza', 'Cuidado personal'), (8, 'Jardín', 'Exteriores'),
    (9, 'Mascotas', 'Accesorios animales'), (10, 'Arte', 'Pinturas y manualidades');

    SET i = 1;
    WHILE i <= 1000 DO
        INSERT INTO productos VALUES (
            i, 
            FLOOR(1 + RAND() * 10), 
            CONCAT('SKU-', i), 
            CONCAT('Producto Maravilloso ', i), 
            'Esta es una descripción larga para ocupar espacio en disco y hacer que las consultas sean más lentas si se hace SELECT * sin necesidad.',
            ROUND(RAND() * 100, 2),
            FLOOR(RAND() * 500),
            1
        );
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 5000 DO
        INSERT INTO usuarios VALUES (
            i, 
            CONCAT('Usuario', i), 
            CONCAT('Apellido', i), 
            CONCAT('user', i, '@regalosapp.com'), 
            ELT(FLOOR(1 + RAND() * 4), 'España', 'Mexico', 'Argentina', 'Colombia'),
            ELT(FLOOR(1 + RAND() * 4), 'Madrid', 'CDMX', 'Buenos Aires', 'Bogota'),
            CONCAT('Calle Falsa ', i),
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 3650) DAY)
        );
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 10000 DO
        SET usuario_random = FLOOR(1 + RAND() * 5000);
        
        INSERT INTO pedidos VALUES (
            i, 
            usuario_random, 
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 365) DAY),
            ELT(FLOOR(1 + RAND() * 4), 'Pendiente', 'Enviado', 'Entregado', 'Cancelado'),
            0, 
            ELT(FLOOR(1 + RAND() * 3), 'Express', 'Standard', 'Recogida')
        );
        
        SET j = 1;
        WHILE j <= FLOOR(1 + RAND() * 3) DO
            SET producto_random = FLOOR(1 + RAND() * 1000);
            INSERT INTO detalles_pedido VALUES (
                NULL, 
                i, 
                producto_random, 
                FLOOR(1 + RAND() * 5),
                ROUND(RAND() * 100, 2)
            );
            SET j = j + 1;
        END WHILE;

        IF RAND() > 0.2 THEN
            INSERT INTO pagos VALUES (
                i, 
                i, 
                NOW(),
                ROUND(RAND() * 500, 2),
                ELT(FLOOR(1 + RAND() * 3), 'Tarjeta', 'Paypal', 'Transferencia'),
                UUID()
            );
        END IF;

        SET i = i + 1;
    END WHILE;
    
    SET i = 1;
    WHILE i <= 20000 DO
        INSERT INTO historial_busquedas VALUES (
            i,
            FLOOR(1 + RAND() * 5000),
            ELT(FLOOR(1 + RAND() * 5), 'Regalo Navidad', 'Juguete', 'Libro cocina', 'Zapatillas', 'Movil'),
            NOW()
        );
        SET i = i + 1;
    END WHILE;

END$$

DELIMITER ;

CALL LlenarBaseDeDatos();

SELECT 'Base de datos RegalosApp_Caos creada y poblada.' AS Estado, 
       (SELECT COUNT(1) FROM usuarios) AS Usuarios,
       (SELECT COUNT(1) FROM pedidos) AS Pedidos;

