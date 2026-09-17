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

INSERT INTO Celdas (bloque, nivel_seguridad) VALUES ('A', 1), ('B', 3), ('C', 5);
INSERT INTO Villanos (alias, diagnostico, id_celda) VALUES ('Joker', 'Psicopatía Severa', 3), ('Dos Caras', 'Trastorno de Identidad Disociativo', 2), ('El Pingüino', 'Megalomanía', 1);
INSERT INTO Guardias (nombre, turno) VALUES ('Aaron Cash', 'Mañana'), ('Frank Boles', 'Noche');
INSERT INTO Incidentes (id_villano, id_guardia, fecha, descripcion) VALUES (1, 1, '2026-06-01', 'Intento de envenenamiento de la comida'), (1, 2, '2026-06-15', 'Agresión al guardia');