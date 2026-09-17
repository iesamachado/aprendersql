CREATE DATABASE IF NOT EXISTS mmorpg;
USE mmorpg;

CREATE TABLE Gremios (
    id_gremio INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    nivel_gremio INT DEFAULT 1
);

CREATE TABLE Jugadores (
    id_jugador INT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    nivel INT DEFAULT 1,
    id_gremio INT,
    FOREIGN KEY (id_gremio) REFERENCES Gremios(id_gremio)
);

CREATE TABLE Objetos (
    id_objeto INT AUTO_INCREMENT PRIMARY KEY,
    nombre_objeto VARCHAR(100) NOT NULL,
    rareza VARCHAR(50),
    daño INT DEFAULT 0
);

CREATE TABLE Inventarios (
    id_jugador INT,
    id_objeto INT,
    cantidad INT DEFAULT 1,
    PRIMARY KEY(id_jugador, id_objeto),
    FOREIGN KEY (id_jugador) REFERENCES Jugadores(id_jugador),
    FOREIGN KEY (id_objeto) REFERENCES Objetos(id_objeto)
);

INSERT INTO Gremios (nombre, nivel_gremio) VALUES ('Los Iluminados', 10), ('Horda de Sangre', 5), ('Comerciantes', 2);
INSERT INTO Jugadores (nickname, nivel, id_gremio) VALUES ('ShadowHunter', 55, 1), ('MagePro', 49, 1), ('NoobSlayer', 10, 2), ('ElRichMC', 99, 3);
INSERT INTO Objetos (nombre_objeto, rareza, daño) VALUES ('Espada del Caos', 'Legendaria', 150), ('Poción de Vida', 'Común', 0), ('Arco Largo', 'Rara', 45);
INSERT INTO Inventarios (id_jugador, id_objeto, cantidad) VALUES (1, 1, 1), (1, 2, 5), (2, 2, 10), (4, 1, 2), (3, 3, 1);