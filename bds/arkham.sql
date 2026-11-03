CREATE DATABASE IF NOT EXISTS arkham;
USE arkham;

CREATE TABLE Celdas (
    id_celda INT AUTO_INCREMENT PRIMARY KEY,
    bloque VARCHAR(10),
    nivel_seguridad INT
);

CREATE TABLE Villanos (
    id_villano INT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(100),
    diagnostico VARCHAR(200),
    id_celda INT,
    FOREIGN KEY (id_celda) REFERENCES Celdas(id_celda)
);

CREATE TABLE Guardias (
    id_guardia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    turno VARCHAR(50)
);

CREATE TABLE Incidentes (
    id_incidente INT AUTO_INCREMENT PRIMARY KEY,
    id_villano INT,
    id_guardia INT,
    fecha DATE,
    descripcion TEXT,
    FOREIGN KEY (id_villano) REFERENCES Villanos(id_villano),
    FOREIGN KEY (id_guardia) REFERENCES Guardias(id_guardia)
);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Celdas (id_celda, bloque, nivel_seguridad) VALUES 
(1, 'A', 1), 
(2, 'B', 3), 
(3, 'C', 5),
(4, 'D', 3), -- nivel_seguridad = 3 repetido (ex 758 Var 2), nivel BETWEEN 2 AND 4 (ex 722 Var 1), celda vacía (ex 745)
(5, 'E', 4);

INSERT INTO Villanos (id_villano, alias, diagnostico, id_celda) VALUES 
(1, 'Joker', 'Psicopatía Severa', 3), 
(2, 'Dos Caras', 'Trastorno de Identidad Disociativo', 2), 
(3, 'El Pingüino', 'Megalomanía', 1),
(4, 'Harley Quinn', 'Delirio Compartido', 3), -- comparte celda 3 con Joker (ex 737 Var 1, ex 758 Var 1)
(5, 'Hiedra Venenosa', NULL, NULL),          -- id_celda IS NULL (ex 724), diagnostico IS NULL (ex 724 Var 1)
(6, 'Enigma', 'Obsesión Compulsiva', 2);     -- villano sin incidentes (ex 745 Var 2)

INSERT INTO Guardias (id_guardia, nombre, turno) VALUES 
(1, 'Aaron Cash', 'Mañana'), 
(2, 'Frank Boles', 'Noche'),
(3, 'Stan Merket', 'Noche'),   -- turno 'Noche' repetido -> COUNT > 1 (ex 737), compañeros de turno (ex 758)
(4, 'Zachary Baker', 'Tarde'); -- guardia sin incidentes (ex 745 Var 1)

INSERT INTO Incidentes (id_incidente, id_villano, id_guardia, fecha, descripcion) VALUES 
(1, 1, 1, '2023-05-10', 'Intento de envenenamiento de la comida'), -- fecha en 2023 (ex 722)
(2, 1, 1, '2024-01-15', 'Agresión al guardia'),                     -- fecha en enero 2024 (ex 722 Var 2)
(3, 1, 1, '2026-06-01', 'Motín en el bloque C'),                   -- Aaron Cash tiene 3 incidentes: COUNT > 2 (ex 748); Joker tiene 3 incidentes: COUNT >= 3 (ex 737 Var 2, ex 748 Var 2)
(4, 2, 2, '2026-06-15', NULL);                                      -- descripcion IS NULL (ex 724 Var 2)
