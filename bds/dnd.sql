CREATE DATABASE IF NOT EXISTS dnd;
USE dnd;

CREATE TABLE Clases (
    id_clase INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50),
    dado_golpe VARCHAR(10)
);

CREATE TABLE Hechizos (
    id_hechizo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    nivel_hechizo INT,
    escuela VARCHAR(50)
);

CREATE TABLE Personajes (
    id_personaje INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    nivel INT,
    id_clase INT,
    FOREIGN KEY (id_clase) REFERENCES Clases(id_clase)
);

CREATE TABLE Libro_Hechizos (
    id_personaje INT,
    id_hechizo INT,
    PRIMARY KEY(id_personaje, id_hechizo),
    FOREIGN KEY (id_personaje) REFERENCES Personajes(id_personaje),
    FOREIGN KEY (id_hechizo) REFERENCES Hechizos(id_hechizo)
);

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP TABLE, FK, etc.)
-- ========================================================
CREATE TABLE IF NOT EXISTS Monstruos (id_monstruo INT PRIMARY KEY, nombre VARCHAR(100));
CREATE TABLE IF NOT EXISTS Facciones (id_faccion INT PRIMARY KEY, descripcion VARCHAR(200));
CREATE TABLE IF NOT EXISTS Ubicaciones (id_ubicacion INT PRIMARY KEY, nombre VARCHAR(150));
CREATE TABLE IF NOT EXISTS Monstruo_Ubicacion (id_monstruo INT, id_ubicacion INT);
CREATE TABLE IF NOT EXISTS Inventario (id_personaje INT, id_objeto INT);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Clases (id_clase, nombre, dado_golpe) VALUES 
(1, 'Mago', 'd6'), 
(2, 'Bárbaro', 'd12'), 
(3, 'Pícaro', 'd8'),
(4, 'Bardo', 'd8'); -- clase sin personajes (ex 805, 808 Var 1, 811 Var 1)

INSERT INTO Hechizos (id_hechizo, nombre, nivel_hechizo, escuela) VALUES 
(1, 'Bola de Fuego', 3, 'Evocación'), 
(2, 'Descarga de Fuego', 0, 'Evocación'), 
(3, 'Invisibilidad', 2, 'Ilusión'),
(4, 'Deseo', 9, 'Conjuración'); -- hechizo sin dueño en Libro_Hechizos (ex 808, 811, 805 Var 2)

INSERT INTO Personajes (id_personaje, nombre, nivel, id_clase) VALUES 
(1, 'Gale', 5, 1), 
(2, 'Karlach', 5, 2), 
(3, 'Astarion', 4, 3); -- Astarion no tiene hechizos (ex 805 Var 1, 808 Var 2, 811 Var 2)

INSERT INTO Libro_Hechizos (id_personaje, id_hechizo) VALUES 
(1, 1), 
(1, 2), 
(1, 3), 
(2, 1);
