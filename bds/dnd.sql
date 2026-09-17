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

INSERT INTO Clases (nombre, dado_golpe) VALUES ('Mago', 'd6'), ('Bárbaro', 'd12'), ('Pícaro', 'd8');
INSERT INTO Hechizos (nombre, nivel_hechizo, escuela) VALUES ('Bola de Fuego', 3, 'Evocación'), ('Descarga de Fuego', 0, 'Evocación'), ('Invisibilidad', 2, 'Ilusión');
INSERT INTO Personajes (nombre, nivel, id_clase) VALUES ('Gale', 5, 1), ('Karlach', 5, 2), ('Astarion', 4, 3);
INSERT INTO Libro_Hechizos (id_personaje, id_hechizo) VALUES (1, 1), (1, 2), (1, 3), (2, 1);