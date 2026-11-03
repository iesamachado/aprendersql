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

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP, RENAME, etc.)
-- ========================================================
CREATE TABLE IF NOT EXISTS Equipos (id_equipo INT PRIMARY KEY, nombre_equipo VARCHAR(100), ciudad VARCHAR(80));
CREATE TABLE IF NOT EXISTS Partidos (id_partido INT PRIMARY KEY, fecha DATE, goles_totales INT);
CREATE TABLE IF NOT EXISTS Goles (id_gol INT PRIMARY KEY, id_partido INT, minuto INT);
CREATE TABLE IF NOT EXISTS Estadios (id_estadio INT PRIMARY KEY, nombre_estadio VARCHAR(100), aforo INT);
CREATE TABLE IF NOT EXISTS Arbitros (id_arbitro INT PRIMARY KEY, nombre VARCHAR(100));

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Fases (id_fase, nombre_fase, plazas_supervivencia) VALUES 
(1, 'Primera Selección', 100), 
(2, 'Segunda Selección', 35), 
(3, 'Liga Neo Egoist', 11),
(4, 'Torneo Mundial U-20', 23); -- fase sin clasificaciones (ex 505 Var 1, 511 Var 1, 514 Var 1)

INSERT INTO Armas_Especiales (id_arma, descripcion, tipo) VALUES 
(1, 'Tiro Directo', 'Disparo'), 
(2, 'Visión Espacial', 'Mental'), 
(3, 'Regate Explosivo', 'Dribbling'),
(4, 'Aceleración Sobrenatural', 'Físico'); -- arma sin jugadores (ex 505 Var 2, 511)

INSERT INTO Jugadores (id_jugador, nombre, ego_score, id_arma) VALUES 
(1, 'Isagi Yoichi', 85, 2), 
(2, 'Bachira Meguru', 92, 3), 
(3, 'Barou Shouei', 95, 1),
(4, 'Rensuke Kunigami', 85, 1),   -- comparte arma 1 con Barou: media es 90, Barou 95 > 90 (ex 510)
(5, 'Igarashi Gurimu', 70, NULL), -- sin arma y sin clasificaciones (ex 482, 505, 511 Var 2, 514)
(6, 'Seishiro Nagi', 93, 2);

INSERT INTO Clasificaciones (id_jugador, id_fase, ranking_obtenido, superada_bool) VALUES 
(1, 1, 15, TRUE), 
(2, 1, 10, TRUE), 
(3, 1, 1, TRUE),
(4, 1, 12, TRUE),
(1, 2, 3, TRUE),    -- ranking 3
(2, 2, 4, TRUE),    -- ranking 4 (media en fase 2 = (3+4)/2 = 3.5 < 5 para ex 509)
(3, 2, NULL, FALSE); -- ranking_obtenido IS NULL (ex 482 Var 2)
