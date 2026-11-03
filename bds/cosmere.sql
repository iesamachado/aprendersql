CREATE DATABASE IF NOT EXISTS cosmere;
USE cosmere;

CREATE TABLE Planetas (
    id_planeta INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    esquirla_residente VARCHAR(100)
);

CREATE TABLE Sistemas_Magia (
    id_magia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    id_planeta_origen INT,
    FOREIGN KEY (id_planeta_origen) REFERENCES Planetas(id_planeta)
);

CREATE TABLE Personajes (
    id_personaje INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    id_planeta_natal INT,
    FOREIGN KEY (id_planeta_natal) REFERENCES Planetas(id_planeta)
);

CREATE TABLE Habilidades (
    id_personaje INT,
    id_magia INT,
    nivel_poder INT,
    PRIMARY KEY(id_personaje, id_magia),
    FOREIGN KEY (id_personaje) REFERENCES Personajes(id_personaje),
    FOREIGN KEY (id_magia) REFERENCES Sistemas_Magia(id_magia)
);

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP, RENAME, etc.)
-- ========================================================
CREATE TABLE IF NOT EXISTS Eventos_Historicos (id_evento INT PRIMARY KEY, descripcion VARCHAR(200), anio INT);
CREATE TABLE IF NOT EXISTS Guerras (id_guerra INT PRIMARY KEY, nombre VARCHAR(100), duracion INT);
CREATE TABLE IF NOT EXISTS Eras (id_era INT PRIMARY KEY, nombre VARCHAR(100), siglo INT);
CREATE TABLE IF NOT EXISTS Shard_Holders (id_holder INT PRIMARY KEY, nombre VARCHAR(100) UNIQUE);
CREATE TABLE IF NOT EXISTS Libros (id_libro INT PRIMARY KEY, titulo VARCHAR(100));
CREATE TABLE IF NOT EXISTS Ediciones (id_edicion INT PRIMARY KEY, año INT);
CREATE TABLE IF NOT EXISTS Autores (id_autor INT PRIMARY KEY, nombre VARCHAR(100));

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Planetas (id_planeta, nombre, esquirla_residente) VALUES 
(1, 'Scadrial', 'Ruina'), 
(2, 'Roshar', 'Honor'), 
(3, 'Nalthis', 'Dotación'),
(4, 'Taldain', 'Autonomía'); -- planeta sin personajes (ex 445)

INSERT INTO Sistemas_Magia (id_magia, nombre, id_planeta_origen) VALUES 
(1, 'Alomancia', 1), 
(2, 'Potenciación', 2), 
(3, 'Despertar', 3), 
(4, 'Feruquimia', 1);

INSERT INTO Personajes (id_personaje, nombre, id_planeta_natal) VALUES 
(1, 'Kelsier', 1), 
(2, 'Kaladin', 2), 
(3, 'Vasher', 3), 
(4, 'Hoid', NULL),
(5, 'Adolin', 2), -- personaje sin habilidades (ex 449)
(6, 'Vin', 1);

INSERT INTO Habilidades (id_personaje, id_magia, nivel_poder) VALUES 
(1, 1, 100), 
(1, 4, 85),  -- Kelsier tiene Alomancia (1) y Feruquimia (4), ambas del planeta 1 -> COUNT > 1 (ex 452)
(2, 2, 95), 
(3, 3, 90), 
-- Hoid tiene todas las magias (1, 2, 3, 4) -> omnipotencia (ex 459)
(4, 1, 99), 
(4, 2, 90),
(4, 3, 45), -- nivel_poder = 45 (cumple BETWEEN 10 AND 50 para ex 421)
(4, 4, 85),
-- Vin tiene Alomancia -> Alomancia tiene 3 personajes (1, 4, 6) -> COUNT > 2 (ex 458)
(6, 1, 95);
