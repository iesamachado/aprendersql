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

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP TABLE)
-- ========================================================
CREATE TABLE IF NOT EXISTS Estadios (id_estadio INT PRIMARY KEY, nombre VARCHAR(100), capacidad INT);
CREATE TABLE IF NOT EXISTS Arbitros (id_arbitro INT PRIMARY KEY, nombre VARCHAR(50));
CREATE TABLE IF NOT EXISTS Medicos (id_medico INT PRIMARY KEY, nombre VARCHAR(50));
CREATE TABLE IF NOT EXISTS Sanciones (id_sancion INT PRIMARY KEY, id_jugador INT);
CREATE TABLE IF NOT EXISTS Premios (id_premio INT PRIMARY KEY, id_jugador INT);
CREATE TABLE IF NOT EXISTS Contratos (id_contrato INT PRIMARY KEY, id_jugador INT);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Categorias (id_categoria, nombre_categoria, edad_maxima) VALUES 
(1, 'Pre-benjamín', 8), 
(2, 'Alevín', 10), 
(3, 'Infantil', 12);

INSERT INTO Jugadores (id_jugador, nombre, dorsal, id_categoria) VALUES 
(1, 'Pau Gasol Jr.', 16, 3), 
(2, 'Ricky Rubio Jr.', 9, 2), 
(3, 'Juan Carlos Navarro Jr.', 7, 3),
(4, 'Marc Gasol Jr.', NULL, 3), -- dorsal NULL para ex 363
(5, 'Rudy Fernandez Jr.', 5, 2); -- con estadísticas de 0 faltas/rebotes/puntos para ex 389

INSERT INTO Partidos (id_partido, rival, fecha, puntos_local, puntos_visitante) VALUES 
(1, 'Real Madrid', '2026-03-15', 85, 80), 
(2, 'Barcelona', '2026-03-22', 70, 90), 
(3, 'Joventut', '2026-04-10', 65, 60),
(4, 'Baskonia', NULL, 75, 72); -- fecha NULL para ex 363 Var 1

-- Estadísticas:
-- Nota: Para que el ex 398 ("Todos los partidos") funcione, el jugador 1 (Pau Gasol Jr.) debe jugar en los 4 partidos.
-- Para que el ex 398 Var 2 ("Todos los jugadores en un partido") funcione, el partido 1 debe tener a los 5 jugadores.
-- Para que el ex 389 funcione, el jugador 5 tiene 0 puntos, 0 rebotes, 0 faltas.
-- Para que el ex 363 Var 2 funcione, al menos un registro debe tener faltas IS NULL.
-- Para que el ex 391 funcione (Barcelona: SUM(puntos) > 20): Pau tiene 25 puntos en partido 2.
-- Para que el ex 391 Var 1 funcione (Real Madrid: SUM(rebotes) > 10): Pau tiene 12 rebotes en partido 1.
-- Para que el ex 391 Var 2 funcione (Joventut: SUM(faltas) > 5): Pau tiene 6 faltas en partido 3.
-- Para que el ex 397 funcione (id_partido con SUM(faltas) > 10): partido 3 tiene 6 + 3 + 4 = 13 faltas.
-- Para que el ex 399 funcione (el peor en puntos_local es partido 3 con 65 puntos): tiene stats de jugadores.

INSERT INTO Estadisticas (id_jugador, id_partido, puntos, rebotes, faltas) VALUES 
-- Partido 1 (contra Real Madrid - juegan los 5 jugadores para ex 398 Var 2)
(1, 1, 25, 12, 2),
(2, 1, 10, 5, 4),
(3, 1, 15, 3, 2),
(4, 1, 8, 4, NULL), -- faltas NULL para ex 363 Var 2
(5, 1, 0, 0, 0),    -- 0 puntos, 0 rebotes, 0 faltas para ex 389

-- Partido 2 (contra Barcelona)
(1, 2, 25, 10, 3),  -- > 20 puntos contra Barcelona (ex 391)
(2, 2, 12, 4, 2),
(3, 2, 15, 2, 1),

-- Partido 3 (contra Joventut - puntos_local más bajo: 65, para ex 399)
(1, 3, 22, 11, 6),  -- > 5 faltas contra Joventut (ex 391 Var 2)
(2, 3, 14, 6, 3),
(3, 3, 18, 5, 4),   -- total faltas en P3 = 6 + 3 + 4 = 13 (> 10 para ex 397)

-- Partido 4 (contra Baskonia - Pau juega para completar todos los partidos, ex 398)
(1, 4, 20, 8, 2),
(2, 4, 11, 3, 1);
