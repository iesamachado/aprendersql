CREATE DATABASE IF NOT EXISTS refugio;
USE refugio;

CREATE TABLE Trabajos (
    id_trabajo INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100),
    riesgo VARCHAR(50)
);

CREATE TABLE Moradores (
    id_morador INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    atributos_SPECIAL VARCHAR(50),
    id_trabajo INT,
    FOREIGN KEY (id_trabajo) REFERENCES Trabajos(id_trabajo)
);

CREATE TABLE Suministros (
    id_suministro INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50),
    cantidad_kilos INT
);

CREATE TABLE Expediciones (
    id_expedicion INT AUTO_INCREMENT PRIMARY KEY,
    id_morador INT,
    dias_fuera INT,
    botin_recuperado INT,
    FOREIGN KEY (id_morador) REFERENCES Moradores(id_morador)
);

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP, etc.)
-- ========================================================
CREATE TABLE IF NOT EXISTS Radiacion (id_zona INT PRIMARY KEY, nombre_zona VARCHAR(100), nivel_rads INT);
CREATE TABLE IF NOT EXISTS Enemigos (id_enemigo INT PRIMARY KEY, nombre_enemigo VARCHAR(100), nivel_peligro INT);
CREATE TABLE IF NOT EXISTS Alertas (id_alerta INT PRIMARY KEY, mensaje VARCHAR(300));

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Trabajos (id_trabajo, titulo, riesgo) VALUES 
(1, 'Cocinero', 'Bajo'), 
(2, 'Seguridad', 'Medio'), 
(3, 'Explorador', 'Alto');

INSERT INTO Moradores (id_morador, nombre, atributos_SPECIAL, id_trabajo) VALUES 
(1, 'Vault Boy', 'S10P10', 3), 
(2, 'Lucy', 'S4P8', 1), 
(3, 'Maximus', 'S9P5', 2),
(4, 'Thaddeus', 'S6P4', 3),     -- comparte trabajo 3 con Vault Boy (ex 570)
(5, 'El Ghoul', 'S9P9', NULL);   -- sin trabajo asignado (ex 542)

INSERT INTO Suministros (id_suministro, tipo, cantidad_kilos) VALUES 
(1, 'Agua Purificada', 500), 
(2, 'Carne de Mutascorpius', 50), 
(3, 'Estimulantes', 10);

INSERT INTO Expediciones (id_expedicion, id_morador, dias_fuera, botin_recuperado) VALUES 
(1, 1, 5, 200), 
(2, 3, 0, 0), 
(3, 1, 10, 500), -- Vault Boy total botín = 200 + 500 = 700
(4, 4, 3, 100),  -- Thaddeus total botín = 100. Media de trabajo 3 = (700+100)/2 = 400. 700 > 400 (ex 570)
(5, 5, 2, NULL); -- botin_recuperado IS NULL (ex 542 Var 2)
