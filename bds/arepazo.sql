-- ------------------------------------------------------
-- SCRIPT ÚNICO PARA BASE DE DATOS "AREPAZO"
-- ------------------------------------------------------
  drop database if exists arepazo;
CREATE DATABASE IF NOT EXISTS arepazo;
use arepazo;
-- --- SECCIÓN 1: CREACIÓN DE TABLAS ---

-- 1. Tabla de Ingredientes (Inventario y Costes)
CREATE TABLE Ingredientes (
    ingrediente_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_ingrediente VARCHAR(100) NOT NULL UNIQUE,
    precio_kg DECIMAL(10, 2) NOT NULL,
    unidad_almacen VARCHAR(20) DEFAULT 'Kg'
);

-- 2. Tabla de Platos (La Carta / Menú)
CREATE TABLE Platos (
    plato_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_plato VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    precio_venta DECIMAL(10, 2) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    disponible BOOLEAN DEFAULT TRUE
);

-- 3. Tabla de Recetas (Relación N:N entre Platos e Ingredientes)
CREATE TABLE Recetas (
    receta_id INT AUTO_INCREMENT PRIMARY KEY,
    plato_id INT NOT NULL,
    ingrediente_id INT NOT NULL,
    cantidad_kg DECIMAL(8, 4) NOT NULL,  -- Ej: 0.1500 kg = 150 gramos
    FOREIGN KEY (plato_id) REFERENCES Platos(plato_id) ,
    FOREIGN KEY (ingrediente_id) REFERENCES Ingredientes(ingrediente_id),
    UNIQUE KEY uk_plato_ingrediente (plato_id, ingrediente_id)
);

-- 4. Tabla de Clientes
CREATE TABLE Clientes (
    cliente_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de Pedidos (Cabecera del pedido)
CREATE TABLE Pedidos (
    pedido_id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_pedido VARCHAR(20) NOT NULL, -- 'Mesa', 'Para llevar', 'Delivery'
    estado VARCHAR(20) DEFAULT 'Recibido',
    total_pedido DECIMAL(10, 2) DEFAULT 0.00, 
    FOREIGN KEY (cliente_id) REFERENCES Clientes(cliente_id)
  );

-- 6. Tabla de Líneas de Pedido (Detalle del pedido N:N)
CREATE TABLE Lineas_Pedido (
    linea_id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    plato_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario_snapshot DECIMAL(10, 2) NOT NULL, -- Precio al momento de la venta
    FOREIGN KEY (pedido_id) REFERENCES Pedidos(pedido_id) ,
    FOREIGN KEY (plato_id) REFERENCES Platos(plato_id)  
    -- Se usa RESTRICT en platos para no borrar un plato si ya está en un pedido
);

-- --- SECCIÓN 2: INSERCIÓN DE DATOS ---

-- --- A. DATOS DE INGREDIENTES ---
INSERT INTO Ingredientes (nombre_ingrediente, precio_kg, unidad_almacen) VALUES
('Harina PAN (Maíz Blanco)', 3.50, 'Kg'),
('Pollo (Pechuga)', 7.80, 'Kg'),
('Aguacate', 6.50, 'Kg'),
('Mayonesa', 4.00, 'Kg'),
('Carne de Res (Falda para mechar)', 12.50, 'Kg'),
('Tomate', 2.50, 'Kg'),
('Cebolla', 2.20, 'Kg'),
('Pimentón (Pimiento Rojo)', 3.00, 'Kg'),
('Caraotas Negras (Secas)', 4.00, 'Kg'),
('Arroz Blanco', 2.00, 'Kg'),
('Queso Blanco Duro (Llanero)', 11.00, 'Kg'),
('Plátano Macho (Maduro)', 2.80, 'Kg'),
('Queso de Mano', 13.00, 'Kg'),
('Cachapa (Maíz Tierno)', 5.00, 'Kg'),
('Mantequilla', 8.00, 'Kg'),
('Harina de Trigo (Todo uso)', 1.50, 'Kg'),
('Azúcar', 1.80, 'Kg'),
('Sal', 1.00, 'Kg'),
('Aceite Vegetal', 3.00, 'Litro'),
('Pernil de Cerdo', 9.00, 'Kg'),
('Papelón (Panela)', 4.50, 'Kg'),
('Limón', 2.50, 'Kg'),
('Malta (Botella)', 2.00, 'Unidad'),
('Frescolita (Lata)', 1.80, 'Unidad'),
('Café en Grano', 15.00, 'Kg'),
('Leche Condensada', 4.00, 'Kg'),
('Queso Amarillo (Gouda)', 10.00, 'Kg'),
('Jamón Cocido', 9.50, 'Kg'),
('Huevo', 3.00, 'Docena'),
('Repollo', 2.00, 'Kg');

-- --- B. DATOS DE PLATOS (CARTA - 30 Platos) ---
INSERT INTO Platos (nombre_plato, descripcion, precio_venta, categoria) VALUES
('Arepa Reina Pepiada', 'Rellena de ensalada de pollo, aguacate y mayonesa', 7.50, 'Arepas'),
('Arepa Catira', 'Rellena de pollo mechado guisado y queso amarillo rallado', 7.00, 'Arepas'),
('Arepa Pelúa', 'Rellena de carne mechada y queso amarillo rallado', 7.50, 'Arepas'),
('Arepa Dominó', 'Rellena de caraotas negras y queso blanco rallado', 6.50, 'Arepas'),
('Arepa de Pernil', 'Rellena de pernil de cerdo horneado y tomate', 8.00, 'Arepas'),
('Arepa Sifrina', 'Reina Pepiada con queso amarillo rallado', 8.00, 'Arepas'),
('Arepa Viuda', 'Arepa sola para acompañar', 2.00, 'Arepas'),
('Arepa de Queso de Mano', 'Rellena de queso de mano', 7.00, 'Arepas'),
('Arepa de Queso Amarillo', 'Rellena de queso amarillo rallado', 6.00, 'Arepas'),
('Arepa de Jamón y Queso', 'Rellena de jamón cocido y queso amarillo', 6.50, 'Arepas'),
('Pabellón Criollo', 'Carne mechada, arroz, caraotas negras y tajadas', 14.50, 'Platos Principales'),
('Tequeños (Ración)', '6 palitos de queso fritos', 6.00, 'Entrantes'),
('Empanada de Carne Mechada', 'Masa de maíz frita rellena de carne mechada', 3.50, 'Entrantes'),
('Empanada de Pollo', 'Masa de maíz frita rellena de pollo mechado', 3.50, 'Entrantes'),
('Empanada de Queso', 'Masa de maíz frita rellena de queso blanco', 3.00, 'Entrantes'),
('Empanada Dominó', 'Masa de maíz frita rellena de caraotas y queso', 3.50, 'Entrantes'),
('Cachapa con Queso de Mano', 'Tortita de maíz tierno con mantequilla y queso de mano', 9.00, 'Platos Principales'),
('Patacón Relleno (Carne)', 'Plátano verde frito con carne, ensalada, queso y salsas', 10.00, 'Platos Principales'),
('Patacón Relleno (Pollo)', 'Plátano verde frito con pollo, ensalada, queso y salsas', 10.00, 'Platos Principales'),
('Asado Negro', 'Carne de res en salsa oscura de papelón', 15.00, 'Platos Principales'),
('Pollo en Brasas (1/4)', 'Cuarto de pollo asado con guarnición', 9.00, 'Platos Principales'),
('Tajadas con Queso', 'Plátano maduro frito con queso blanco rallado', 5.00, 'Acompañantes'),
('Yuca Frita', 'Bastones de yuca frita con guasacaca', 4.50, 'Acompañantes'),
('Guasacaca', 'Salsa de aguacate, pimentón y ajo', 1.50, 'Salsas'),
('Picante Criollo', 'Salsa picante a base de ají dulce', 1.00, 'Salsas'),
('Jugo de Parchita (Maracuyá)', 'Jugo natural', 3.50, 'Bebidas'),
('Jugo de Guanábana', 'Jugo natural', 3.50, 'Bebidas'),
('Malta', 'Bebida de malta sin alcohol', 2.50, 'Bebidas'),
('Frescolita', 'Refresco venezolano sabor a kolita', 2.50, 'Bebidas'),
('Quesillo', 'Postre tipo flan venezolano', 4.50, 'Postres');

-- --- C. DATOS DE RECETAS (10 Platos de Ejemplo) ---
-- (IDs de Platos: 1=Reina, 3=Pelúa, 4=Dominó, 11=Pabellón, 12=Tequeños, 13=Emp. Carne, 17=Cachapa, 22=Tajadas, 26=Jugo Parchita, 30=Quesillo)
-- (IDs de Ingredientes: 1=HarinaPAN, 2=Pollo, 3=Aguacate, 4=Mayonesa, 5=Carne Mechada, 9=Caraotas, 11=Queso Blanco, 12=Plátano Maduro, 13=Queso Mano, 14=Cachapa (masa), 15=Mantequilla, 16=Harina Trigo, 19=Aceite, 27=Queso Amarillo, 29=Huevo, 26=Leche Condensada)

-- 1. Arepa Reina Pepiada (Plato 1)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(1, 1, 0.120),  (1, 2, 0.100),  (1, 3, 0.080),  (1, 4, 0.030);
-- 2. Arepa Pelúa (Plato 3)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(3, 1, 0.120),  (3, 5, 0.150),  (3, 27, 0.050);
-- 3. Arepa Dominó (Plato 4)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(4, 1, 0.120),  (4, 9, 0.150),  (4, 11, 0.060);
-- 4. Pabellón Criollo (Plato 11)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(11, 5, 0.200), (11, 10, 0.150), (11, 9, 0.150),  (11, 12, 0.100);
-- 5. Tequeños (Ración) (Plato 12)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(12, 16, 0.100), (12, 11, 0.150), (12, 29, 0.050), (12, 19, 0.050);
-- 6. Empanada de Carne Mechada (Plato 13)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(13, 1, 0.100),  (13, 5, 0.100),  (13, 19, 0.040);
-- 7. Cachapa con Queso de Mano (Plato 17)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(17, 14, 0.250), (17, 13, 0.150), (17, 15, 0.020);
-- 8. Tajadas con Queso (Plato 22)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(22, 12, 0.200), (22, 11, 0.050), (22, 19, 0.030);
-- 9. Jugo de Parchita (Plato 26)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(26, 3, 0.200); -- Asumimos que ID 3 (Aguacate) es ahora ID de Pulpa de Parchita (simplificado)
-- 10. Quesillo (Plato 30)
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(30, 29, 0.100), (30, 26, 0.150);

-- --- D. DATOS DE CLIENTES (50) ---
INSERT INTO Clientes (nombre, apellido, telefono, email) VALUES
('Carlos', 'González', '+34600000001', 'carlos.gonzalez@email.com'),
('María', 'Rodríguez', '+34600000002', 'maria.rodriguez@email.com'),
('Juan', 'Pérez', '+34600000003', 'juan.perez@email.com'),
('Ana', 'Martínez', '+34600000004', 'ana.martinez@email.com'),
('Luis', 'Sánchez', '+34600000005', 'luis.sanchez@email.com'),
('Sofía', 'López', '+34600000006', 'sofia.lopez@email.com'),
('Diego', 'García', '+34600000007', 'diego.garcia@email.com'),
('Lucía', 'Fernández', '+34600000008', 'lucia.fernandez@email.com'),
('Javier', 'Gómez', '+34600000009', 'javier.gomez@email.com'),
('Elena', 'Díaz', '+34600000010', 'elena.diaz@email.com'),
('Miguel', 'Hernández', '+34600000011', 'miguel.hernandez@email.com'),
('Isabel', 'Moreno', '+34600000012', 'isabel.moreno@email.com'),
('David', 'Jiménez', '+34600000013', 'david.jimenez@email.com'),
('Laura', 'Ruiz', '+34600000014', 'laura.ruiz@email.com'),
('Adrián', 'Álvarez', '+34600000015', 'adrian.alvarez@email.com'),
('Carmen', 'Romero', '+34600000016', 'carmen.romero@email.com'),
('Sergio', 'Navarro', '+34600000017', 'sergio.navarro@email.com'),
('Paula', 'Gutiérrez', '+34600000018', 'paula.gutierrez@email.com'),
('Daniel', 'Torres', '+34600000019', 'daniel.torres@email.com'),
('Rosa', 'Domínguez', '+34600000020', 'rosa.dominguez@email.com'),
('Alejandro', 'Vázquez', '+34600000021', 'alejandro.vazquez@email.com'),
('Sara', 'Ramos', '+34600000022', 'sara.ramos@email.com'),
('Pablo', 'Gil', '+34600000023', 'pablo.gil@email.com'),
('Eva', 'Ramírez', '+34600000024', 'eva.ramirez@email.com'),
('Jorge', 'Serrano', '+34600000025', 'jorge.serrano@email.com'),
('Marta', 'Blanco', '+34600000026', 'marta.blanco@email.com'),
('Marcos', 'Molina', '+34600000027', 'marcos.molina@email.com'),
('Beatriz', 'Suárez', '+34600000028', 'beatriz.suarez@email.com'),
('Manuel', 'Ortega', '+34600000029', 'manuel.ortega@email.com'),
('Verónica', 'Delgado', '+34600000030', 'veronica.delgado@email.com'),
('Hugo', 'Castro', '+34600000031', 'hugo.castro@email.com'),
('Raquel', 'Ortiz', '+34600000032', 'raquel.ortiz@email.com'),
('Rubén', 'Marín', '+34600000033', 'ruben.marin@email.com'),
('Nuria', 'Sanz', '+34600000034', 'nuria.sanz@email.com'),
('Iván', 'León', '+34600000035', 'ivan.leon@email.com'),
('Cristina', 'Nuñez', '+34600000036', 'cristina.nunez@email.com'),
('Álvaro', 'Campos', '+34600000037', 'alvaro.campos@email.com'),
('Lorena', 'Vega', '+34600000038', 'lorena.vega@email.com'),
('Francisco', 'Reyes', '+34600000039', 'francisco.reyes@email.com'),
('Silvia', 'Guerrero', '+34600000040', 'silvia.guerrero@email.com'),
('Fernando', 'Cabrera', '+34600000041', 'fernando.cabrera@email.com'),
('Patricia', 'Santos', '+34600000042', 'patricia.santos@email.com'),
('Alberto', 'Castillo', '+34600000043', 'alberto.castillo@email.com'),
('Gloria', 'Méndez', '+34600000044', 'gloria.mendez@email.com'),
('Ricardo', 'Pascual', '+34600000045', 'ricardo.pascual@email.com'),
('Olga', 'Herrera', '+34600000046', 'olga.herrera@email.com'),
('Víctor', 'Peña', '+34600000047', 'victor.pena@email.com'),
('Alicia', 'Calvo', '+34600000048', 'alicia.calvo@email.com'),
('Emilio', 'Vicente', '+34600000049', 'emilio.vicente@email.com'),
('Teresa', 'Arias', '+34600000050', 'teresa.arias@email.com');

-- --- E. DATOS DE PEDIDOS Y LÍNEAS (10 Pedidos de Ejemplo) ---
-- (Platos: 1=Reina, 3=Pelúa, 4=Dominó, 5=Pernil, 11=Pabellón, 12=Tequeños, 13=Emp. Carne, 15=Emp. Queso, 17=Cachapa, 18=Patacón, 26=Jugo Parchita, 28=Malta, 29=Frescolita, 30=Quesillo)

INSERT INTO Pedidos (cliente_id, fecha_hora, tipo_pedido, estado, total_pedido) VALUES
(1, '2025-10-01 20:30:00', 'Mesa', 'Pagado', 21.50),
(2, '2025-10-01 20:35:00', 'Para llevar', 'Pagado', 14.50),
(3, '2025-10-02 13:00:00', 'Delivery', 'Entregado', 12.00),
(4, '2025-10-02 14:10:00', 'Mesa', 'Pagado', 31.00),
(5, '2025-10-03 21:00:00', 'Mesa', 'Pagado', 8.00),
(6, '2025-10-03 21:05:00', 'Mesa', 'Pagado', 20.00),
(7, '2025-10-04 13:15:00', 'Para llevar', 'Pagado', 10.00),
(8, '2025-10-04 20:45:00', 'Delivery', 'Entregado', 24.50),
(9, '2025-10-05 14:00:00', 'Mesa', 'Pagado', 41.00),
(10, '2025-10-05 21:30:00', 'Para llevar', 'Pagado', 16.50),
-- Pedidos para clientes 11-20 (Simulación)
(11, '2025-10-06 20:00:00', 'Mesa', 'Pagado', 10.00),
(12, '2025-10-06 20:10:00', 'Mesa', 'Pagado', 7.50),
(13, '2025-10-06 20:15:00', 'Para llevar', 'Pagado', 6.00),
(14, '2025-10-06 20:20:00', 'Delivery', 'Entregado', 14.50),
(15, '2025-10-06 20:30:00', 'Mesa', 'Pagado', 9.00),
(16, '2025-10-07 13:00:00', 'Mesa', 'Pagado', 17.50),
(17, '2025-10-07 13:30:00', 'Para llevar', 'Pagado', 10.50),
(18, '2025-10-07 21:00:00', 'Delivery', 'Entregado', 23.00),
(19, '2025-10-08 14:00:00', 'Mesa', 'Pagado', 15.00),
(20, '2025-10-08 20:30:00', 'Mesa', 'Pagado', 31.50);


-- Líneas para esos 20 pedidos
INSERT INTO Lineas_Pedido (pedido_id, plato_id, cantidad, precio_unitario_snapshot) VALUES
-- Pedido 1 (Cliente 1)
(1, 1, 2, 7.50), (1, 12, 1, 6.00), (1, 28, 1, 2.50),
-- Pedido 2 (Cliente 2)
(2, 11, 1, 14.50),
-- Pedido 3 (Cliente 3)
(3, 12, 2, 6.00),
-- Pedido 4 (Cliente 4)
(4, 17, 2, 9.00), (4, 26, 2, 3.50), (4, 30, 2, 4.50),
-- Pedido 5 (Cliente 5)
(5, 5, 1, 8.00),
-- Pedido 6 (Cliente 6)
(6, 3, 1, 7.50), (6, 4, 1, 6.50), (6, 29, 2, 2.50),
-- Pedido 7 (Cliente 7)
(7, 13, 1, 3.50), (7, 15, 1, 3.00), (7, 28, 1, 2.50),
-- Pedido 8 (Cliente 8)
(8, 1, 1, 7.50), (8, 11, 1, 14.50), (8, 29, 1, 2.50),
-- Pedido 9 (Cliente 9)
(9, 11, 2, 14.50), (9, 12, 2, 6.00),
-- Pedido 10 (Cliente 10)
(10, 18, 1, 10.00), (10, 26, 1, 3.50), (10, 28, 1, 2.50),
-- Pedido 11 (Cliente 11)
(11, 19, 1, 10.00),
-- Pedido 12 (Cliente 12)
(12, 1, 1, 7.50),
-- Pedido 13 (Cliente 13)
(13, 15, 2, 3.00),
-- Pedido 14 (Cliente 14)
(14, 11, 1, 14.50),
-- Pedido 15 (Cliente 15)
(15, 17, 1, 9.00),
-- Pedido 16 (Cliente 16)
(16, 1, 1, 7.50), (16, 12, 1, 6.00), (16, 28, 1, 2.50), (16, 29, 1, 2.50),
-- Pedido 17 (Cliente 17)
(17, 13, 3, 3.50),
-- Pedido 18 (Cliente 18)
(18, 1, 1, 7.50), (18, 3, 1, 7.50), (18, 28, 2, 2.50), (18, 29, 1, 2.50),
-- Pedido 19 (Cliente 19)
(19, 10, 1, 6.50), (19, 14, 1, 3.50), (19, 30, 1, 4.50),
-- Pedido 20 (Cliente 20)
(20, 11, 1, 14.50), (20, 17, 1, 9.00), (20, 26, 2, 3.50), (20, 28, 1, 2.50);

-- --- SECCIÓN 3: MÁS PEDIDOS (20 Adicionales) ---

-- --- F. DATOS DE PEDIDOS ADICIONALES (21-40) ---
INSERT INTO Pedidos (cliente_id, fecha_hora, tipo_pedido, estado, total_pedido) VALUES
(21, '2025-10-09 13:00:00', 'Mesa', 'Pagado', 21.00),
(22, '2025-10-09 13:10:00', 'Mesa', 'Pagado', 10.00),
(23, '2025-10-09 14:00:00', 'Para llevar', 'Pagado', 13.00),
(24, '2025-10-09 20:00:00', 'Delivery', 'Entregado', 19.50),
(25, '2025-10-09 20:15:00', 'Mesa', 'Pagado', 27.00),
(26, '2025-10-10 13:00:00', 'Para llevar', 'Pagado', 14.50),
(27, '2025-10-10 13:05:00', 'Mesa', 'Pagado', 17.50),
(28, '2025-10-10 20:30:00', 'Mesa', 'Pagado', 41.50),
(29, '2025-10-10 21:00:00', 'Delivery', 'Entregado', 11.00),
(30, '2025-10-11 13:15:00', 'Mesa', 'Pagado', 15.00),
(31, '2025-10-11 13:30:00', 'Mesa', 'Pagado', 9.00),
(32, '2025-10-11 14:10:00', 'Para llevar', 'Pagado', 23.50),
(33, '2025-10-11 20:00:00', 'Mesa', 'Pagado', 18.00),
(34, '2025-10-11 20:05:00', 'Delivery', 'Entregado', 14.00),
(35, '2025-10-12 13:00:00', 'Mesa', 'Pagado', 26.50),
(36, '2025-10-12 13:20:00', 'Para llevar', 'Pagado', 20.00),
(37, '2025-10-12 20:15:00', 'Mesa', 'Pagado', 14.00),
(38, '2025-10-12 20:30:00', 'Mesa', 'Pagado', 20.50),
(39, '2025-10-13 14:00:00', 'Delivery', 'Entregado', 10.00),
(40, '2025-10-13 14:05:00', 'Mesa', 'Pagado', 17.00);

-- --- G. LÍNEAS PARA PEDIDOS ADICIONALES (21-40) ---
INSERT INTO Lineas_Pedido (pedido_id, plato_id, cantidad, precio_unitario_snapshot) VALUES
-- Pedido 21 (Cliente 21)
(21, 1, 1, 7.50), (21, 3, 1, 7.50), (21, 12, 1, 6.00),
-- Pedido 22 (Cliente 22)
(22, 18, 1, 10.00),
-- Pedido 23 (Cliente 23)
(23, 4, 2, 6.50),
-- Pedido 24 (Cliente 24)
(24, 11, 1, 14.50), (24, 22, 1, 5.00),
-- Pedido 25 (Cliente 25)
(25, 17, 3, 9.00),
-- Pedido 26 (Cliente 26)
(26, 11, 1, 14.50),
-- Pedido 27 (Cliente 27)
(27, 13, 1, 3.50), (27, 14, 1, 3.50), (27, 15, 1, 3.00), (27, 16, 1, 3.50), (27, 29, 1, 2.50), (27, 28, 1, 2.50),
-- Pedido 28 (Cliente 28)
(28, 11, 2, 14.50), (28, 12, 1, 6.00), (28, 30, 1, 4.50), (28, 28, 1, 2.50),
-- Pedido 29 (Cliente 29)
(29, 10, 1, 6.50), (29, 26, 1, 3.50), (29, 25, 1, 1.00),
-- Pedido 30 (Cliente 30)
(30, 1, 2, 7.50),
-- Pedido 31 (Cliente 31)
(31, 21, 1, 9.00),
-- Pedido 32 (Cliente 32)
(32, 5, 1, 8.00), (32, 1, 1, 7.50), (32, 29, 2, 2.50), (32, 30, 1, 4.50),
-- Pedido 33 (Cliente 33)
(33, 17, 2, 9.00),
-- Pedido 34 (Cliente 34)
(34, 2, 2, 7.00),
-- Pedido 35 (Cliente 35)
(35, 20, 1, 15.00), (35, 12, 1, 6.00), (35, 22, 1, 5.00), (35, 24, 1, 1.50),
-- Pedido 36 (Cliente 36)
(36, 19, 2, 10.00),
-- Pedido 37 (Cliente 37)
(37, 8, 2, 7.00),
-- Pedido 38 (Cliente 38)
(38, 1, 1, 7.50), (38, 6, 1, 8.00), (38, 28, 2, 2.50),
-- Pedido 39 (Cliente 39)
(39, 22, 2, 5.00),
-- Pedido 40 (Cliente 40)
(40, 10, 1, 6.50), (40, 9, 1, 6.00), (40, 26, 1, 3.50), (40, 25, 1, 1.00);

-- --- FIN DE LA INSERCIÓN ADICIONAL ---


INSERT INTO Pedidos (cliente_id, fecha_hora, tipo_pedido, estado, total_pedido) VALUES
-- Pedidos 41-50 (Clientes 41-50)
(41, '2025-10-13 20:00:00', 'Mesa', 'Pagado', 15.00),
(42, '2025-10-14 13:00:00', 'Para llevar', 'Pagado', 21.00),
(43, '2025-10-14 20:30:00', 'Delivery', 'Entregado', 26.50),
(44, '2025-10-15 14:15:00', 'Mesa', 'Pagado', 12.00),
(45, '2025-10-15 21:00:00', 'Mesa', 'Pagado', 18.00),
(46, '2025-10-16 13:30:00', 'Para llevar', 'Pagado', 7.50),
(47, '2025-10-16 20:10:00', 'Delivery', 'Entregado', 24.50),
(48, '2025-10-17 14:00:00', 'Mesa', 'Pagado', 30.50),
(49, '2025-10-17 21:30:00', 'Mesa', 'Pagado', 14.50),
(50, '2025-10-18 13:00:00', 'Para llevar', 'Pagado', 31.00),
-- Pedidos 51-60 (Recurrencia: Clientes 1-10)
(1, '2025-10-18 20:00:00', 'Mesa', 'Pagado', 15.00),
(2, '2025-10-19 14:30:00', 'Delivery', 'Entregado', 13.00),
(3, '2025-10-19 21:00:00', 'Mesa', 'Pagado', 12.50),
(4, '2025-10-20 13:10:00', 'Para llevar', 'Pagado', 10.00),
(5, '2025-10-20 20:45:00', 'Mesa', 'Pagado', 23.50),
(6, '2025-10-21 14:00:00', 'Delivery', 'Entregado', 21.50),
(7, '2025-10-21 21:15:00', 'Mesa', 'Pagado', 17.00),
(8, '2025-10-22 13:45:00', 'Para llevar', 'Pagado', 14.00),
(9, '2025-10-22 20:00:00', 'Mesa', 'Pagado', 15.50),
(10, '2025-10-23 13:00:00', 'Mesa', 'Pagado', 19.50),
-- Pedidos 61-70 (Recurrencia: Clientes 11-20)
(11, '2025-10-23 21:00:00', 'Delivery', 'Entregado', 19.00),
(12, '2025-10-24 14:00:00', 'Mesa', 'Pagado', 18.00),
(13, '2025-10-24 20:30:00', 'Para llevar', 'Pagado', 15.00),
(14, '2025-10-25 13:15:00', 'Mesa', 'Pagado', 14.50),
(15, '2025-10-25 21:10:00', 'Delivery', 'Entregado', 16.00),
(16, '2025-10-26 14:00:00', 'Mesa', 'Pagado', 21.50),
(17, '2025-10-26 21:30:00', 'Mesa', 'Pagado', 16.50),
(18, '2025-10-27 13:00:00', 'Para llevar', 'Pagado', 10.50),
(19, '2025-10-27 20:45:00', 'Mesa', 'Pagado', 16.00),
(20, '2025-10-28 14:00:00', 'Delivery', 'Entregado', 17.00);

INSERT INTO Lineas_Pedido (pedido_id, plato_id, cantidad, precio_unitario_snapshot) VALUES
-- Pedido 41 (Total: 15.00)
(41, 1, 1, 7.50), (41, 3, 1, 7.50),
-- Pedido 42 (Total: 21.00)
(42, 17, 2, 9.00), (42, 28, 1, 2.50), (42, 29, 1, 2.50),
-- Pedido 43 (Total: 26.50)
(43, 11, 1, 14.50), (43, 12, 2, 6.00),
-- Pedido 44 (Total: 12.00)
(44, 4, 1, 6.50), (44, 9, 1, 6.00),
-- Pedido 45 (Total: 18.00)
(45, 12, 3, 6.00),
-- Pedido 46 (Total: 7.50)
(46, 1, 1, 7.50),
-- Pedido 47 (Total: 24.50)
(47, 11, 1, 14.50), (47, 30, 2, 4.50), (47, 28, 1, 2.50),
-- Pedido 48 (Total: 30.50)
(48, 17, 2, 9.00), (48, 11, 1, 14.50), (48, 29, 2, 2.50),
-- Pedido 49 (Total: 14.50)
(49, 11, 1, 14.50),
-- Pedido 50 (Total: 31.00)
(50, 17, 3, 9.00), (50, 30, 1, 4.00),
-- Pedido 51 (Total: 15.00)
(51, 10, 1, 6.50), (51, 15, 1, 3.00), (51, 12, 1, 6.00),
-- Pedido 52 (Total: 13.00)
(52, 4, 2, 6.50),
-- Pedido 53 (Total: 12.50)
(53, 1, 1, 7.50), (53, 29, 2, 2.50),
-- Pedido 54 (Total: 10.00)
(54, 18, 1, 10.00),
-- Pedido 55 (Total: 23.50)
(55, 3, 2, 7.50), (55, 26, 1, 3.50), (55, 30, 1, 4.50),
-- Pedido 56 (Total: 21.50)
(56, 11, 1, 14.50), (56, 26, 2, 3.50),
-- Pedido 57 (Total: 17.00)
(57, 5, 2, 8.00), (57, 25, 1, 1.00),
-- Pedido 58 (Total: 14.00)
(58, 2, 2, 7.00),
-- Pedido 59 (Total: 15.50)
(59, 1, 2, 7.50), (59, 25, 1, 0.50),
-- Pedido 60 (Total: 19.50)
(60, 12, 3, 6.00), (60, 24, 1, 1.50),
-- Pedido 61 (Total: 19.00)
(61, 17, 2, 9.00), (61, 28, 2, 2.50),
-- Pedido 62 (Total: 18.00)
(62, 3, 2, 7.50), (62, 28, 2, 1.50),
-- Pedido 63 (Total: 15.00)
(63, 13, 2, 3.50), (63, 14, 1, 3.50), (63, 15, 1, 3.00), (63, 16, 1, 3.50),
-- Pedido 64 (Total: 14.50)
(64, 11, 1, 14.50),
-- Pedido 65 (Total: 16.00)
(65, 1, 1, 7.50), (65, 6, 1, 8.00), (65, 24, 1, 0.50),
-- Pedido 66 (Total: 21.50)
(66, 1, 1, 7.50), (66, 12, 1, 6.00), (66, 17, 1, 9.00),
-- Pedido 67 (Total: 16.50)
(67, 18, 1, 10.00), (67, 26, 1, 3.50), (67, 29, 1, 2.50),
-- Pedido 68 (Total: 10.50)
(68, 5, 1, 8.00), (68, 28, 1, 2.50),
-- Pedido 69 (Total: 16.00)
(69, 10, 1, 6.50), (69, 15, 1, 3.00), (69, 30, 1, 4.50), (69, 29, 1, 2.00),
-- Pedido 70 (Total: 17.00)
(70, 17, 1, 9.00), (70, 26, 1, 3.50), (70, 28, 1, 2.50), (70, 29, 1, 2.00);



-- AREPAS
INSERT INTO Recetas (plato_id, ingrediente_id, cantidad_kg) VALUES
(2,1,120),(2,2,5),(2,9,60),(2,5,80),(2,12,10),
(5,1,120),(5,2,5),(5,6,90),(5,12,10),
(6,1,120),(6,2,5),(6,5,60),(6,9,50),(6,12,10),(6,13,20),
(7,1,120),(7,2,5),(7,12,10),
(8,1,120),(8,2,5),(8,8,60),(8,12,10),
(9,1,120),(9,2,5),(9,9,60),(9,12,10),
(10,1,120),(10,2,5),(10,10,40),(10,9,40),(10,12,10),

-- EMPANADAS
(14,1,100),(14,2,5),(14,5,80),(14,12,8),
(15,1,100),(15,2,5),(15,8,70),(15,12,8),
(16,1,100),(16,2,5),(16,7,60),(16,8,40),(16,12,8),

-- PLATOS FUERTES Y PATACONES
(18,3,250),(18,4,10),(18,9,40),(18,13,30),(18,12,10),
(19,3,250),(19,5,80),(19,9,40),(19,13,30),(19,12,10),
(20,4,200),(20,14,50),(20,15,50),(20,16,20),(20,17,20),(20,12,10),
(21,5,200),(21,12,8),(21,15,10),(21,16,10),

-- ACOMPAÑAMIENTOS Y SALSAS
(23,11,150),(23,2,10),(23,12,5),
(24,13,80),(24,14,20),(24,15,10),(24,16,10),(24,18,5),(24,12,3),
(25,16,30),(25,14,10),(25,15,5),(25,12,3),

-- BEBIDAS
(27,19,200),(27,20,200),(27,21,30),(27,12,2),
(28,22,330),
(29,23,330);

update Recetas set cantidad_kg = cantidad_kg/1000 where receta_id>30;
update Recetas set cantidad_kg = cantidad_kg*2 