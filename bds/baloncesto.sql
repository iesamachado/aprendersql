CREATE DATABASE IF NOT EXISTS baloncesto;
USE baloncesto;

CREATE TABLE Categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(50),
    edad_maxima INT
);

CREATE TABLE Jugadores (
    id_jugador INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    dorsal INT,
    id_categoria INT,
    FOREIGN KEY (id_categoria) REFERENCES Categorias(id_categoria)
);

CREATE TABLE Partidos (
    id_partido INT AUTO_INCREMENT PRIMARY KEY,
    rival VARCHAR(100),
    fecha DATE,
    puntos_local INT,
    puntos_visitante INT
);

CREATE TABLE Estadisticas (
    id_jugador INT,
    id_partido INT,
    puntos INT,
    rebotes INT,
    faltas INT,
    PRIMARY KEY(id_jugador, id_partido),
    FOREIGN KEY (id_jugador) REFERENCES Jugadores(id_jugador),
    FOREIGN KEY (id_partido) REFERENCES Partidos(id_partido)
);

INSERT INTO Categorias (nombre_categoria, edad_maxima) VALUES ('Pre-benjamín', 8), ('Alevín', 10), ('Infantil', 12);
INSERT INTO Jugadores (nombre, dorsal, id_categoria) VALUES ('Pau Gasol Jr.', 16, 3), ('Ricky Rubio Jr.', 9, 2), ('Juan Carlos Navarro Jr.', 7, 3);
INSERT INTO Partidos (rival, fecha, puntos_local, puntos_visitante) VALUES ('Real Madrid', '2026-03-15', 85, 80), ('Barcelona', '2026-03-22', 70, 90), ('Joventut', '2026-04-10', 65, 60);
INSERT INTO Estadisticas (id_jugador, id_partido, puntos, rebotes, faltas) VALUES (1, 1, 25, 12, 2), (2, 1, 10, 5, 4), (1, 2, 20, 10, 3), (3, 2, 15, 2, 1);