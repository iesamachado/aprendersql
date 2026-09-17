CREATE DATABASE IF NOT EXISTS futbol;
USE futbol;

CREATE TABLE Fases (
    id_fase INT AUTO_INCREMENT PRIMARY KEY,
    nombre_fase VARCHAR(100),
    plazas_supervivencia INT
);

CREATE TABLE Armas_Especiales (
    id_arma INT AUTO_INCREMENT PRIMARY KEY,
    descripcion VARCHAR(200),
    tipo VARCHAR(50)
);

CREATE TABLE Jugadores (
    id_jugador INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    ego_score INT,
    id_arma INT,
    FOREIGN KEY (id_arma) REFERENCES Armas_Especiales(id_arma)
);

CREATE TABLE Clasificaciones (
    id_jugador INT,
    id_fase INT,
    ranking_obtenido INT,
    superada_bool BOOLEAN,
    PRIMARY KEY(id_jugador, id_fase),
    FOREIGN KEY (id_jugador) REFERENCES Jugadores(id_jugador),
    FOREIGN KEY (id_fase) REFERENCES Fases(id_fase)
);

INSERT INTO Fases (nombre_fase, plazas_supervivencia) VALUES ('Primera Selección', 100), ('Segunda Selección', 35), ('Liga Neo Egoist', 11);
INSERT INTO Armas_Especiales (descripcion, tipo) VALUES ('Tiro Directo', 'Disparo'), ('Visión Espacial', 'Mental'), ('Regate Explosivo', 'Dribbling');
INSERT INTO Jugadores (nombre, ego_score, id_arma) VALUES ('Isagi Yoichi', 85, 2), ('Bachira Meguru', 92, 3), ('Barou Shouei', 95, 1);
INSERT INTO Clasificaciones (id_jugador, id_fase, ranking_obtenido, superada_bool) VALUES (1, 1, 15, TRUE), (2, 1, 10, TRUE), (3, 1, 1, TRUE), (1, 2, 5, TRUE);