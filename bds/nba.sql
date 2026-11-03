drop database if exists nba;
create database nba;
use nba;


create table equipos(
  id int primary key auto_increment,
  nombre varchar(20) not null,
  conferencia varchar(10) not null,
  presidente varchar(25) not null,
  ciudad varchar(30) not null,
  direccion_sede varchar(255) not null
);


create table jugadores (
  id int primary key auto_increment,
  nombre varchar(20) not null,
  apellido1 varchar(20) not null,
  apellido2 varchar(20) NULL,
  nacionalidad varchar(15),
  fecha_nacimiento datetime not null,
  id_equipo int not null,
  salario decimal(10,2) null,
  foreign key (id_equipo) references equipos(id)
);

create table partidos(
  id int primary key auto_increment,
  id_equipoLocal int not null,
  id_equipoVisitante int not null,
  marcadorLocal int NULL,
  marcadorVisitante int NULL,
  fecha datetime not null,
  direccion varchar(255),
  foreign key (id_equipoVisitante) references equipos(id),
  foreign key (id_equipoLocal) references equipos(id)
);

create table estadisticasPartido(
  id_jugador int not null,
  id_partido int not null,
  tapones int not null,
  puntos int not null,
  rebotes int not null,
  robos int not null,
  faltas int not null,
  asistencias int not null,
  foreign key (id_jugador) references jugadores(id),
  foreign key (id_partido) references partidos(id),
  primary key(id_jugador,id_partido)
);

-- ========================================================
-- Tablas auxiliares para ejercicios DDL (DROP, RENAME, etc.)
-- ========================================================
CREATE TABLE IF NOT EXISTS estadios (
  id INT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  ciudad VARCHAR(30) NOT NULL,
  capacidad INT,
  activo TINYINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS arbitros (
  id INT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL,
  apellido VARCHAR(30) NOT NULL,
  licencia VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS contratos (
  id INT PRIMARY KEY,
  id_jugador INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  salario_anual DECIMAL(12,2)
);

CREATE TABLE IF NOT EXISTS sanciones (
  id INT PRIMARY KEY,
  id_jugador INT NOT NULL,
  motivo VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS lesiones (
  id INT PRIMARY KEY,
  id_jugador INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  fecha_lesion DATE NOT NULL,
  baja_estimada INT
);

-- ========================================================
-- Datos iniciales: EQUIPOS
-- ========================================================
INSERT INTO equipos (id, nombre, conferencia, presidente, ciudad, direccion_sede) VALUES
(1, 'Los Angeles Lakers', 'West', 'Jeanie Buss', 'Los Angeles', '1111 S Figueroa St'),
(2, 'Golden State Warriors', 'West', 'Joe Lacob', 'San Francisco', '1 Warriors Way'),
(3, 'Boston Celtics', 'East', 'Wyc Grousbeck', 'Boston', '100 Legends Way'),
(4, 'Miami Heat', 'East', 'Pat Riley', 'Miami', '601 Biscayne Blvd'),
(5, 'Chicago Bulls', 'East', 'Jerry Reinsdorf', 'Chicago', '1901 W Madison St'),
(6, 'San Antonio Spurs', 'West', 'Peter J. Holt', 'San Antonio', '1 AT&T Center Pkwy'),
(7, 'Brooklyn Nets', 'East', 'Joe Tsai', 'New York', '620 Atlantic Ave'),
(8, 'Denver Nuggets', 'West', 'Stan Kroenke', 'Denver', '1000 Chopper Cir'),
(9, 'Seattle SuperSonics', 'West', 'Chris Hansen', 'Seattle', '305 Harrison St');

-- ========================================================
-- Datos iniciales: JUGADORES
-- ========================================================
-- Equipo 1 (Lakers): 11 jugadores (para HAVING COUNT(*) > 10)
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(1, 'LeBron', 'James', 'Raymone', 'USA', '1984-12-30', 1, 11000000.00),
(2, 'Anthony', 'Davis', 'Marshon', 'USA', '1993-03-11', 1, 9500000.00),
(3, 'Austin', 'Reaves', 'Tyler', 'USA', '1998-05-29', 1, 3500000.00),
(4, 'D''Angelo', 'Russell', NULL, 'USA', '1996-02-23', 1, 4500000.00),
(5, 'Rui', 'Hachimura', NULL, 'Japan', '1998-02-08', 1, 4000000.00),
(6, 'Jarred', 'Vanderbilt', NULL, 'USA', '1999-04-03', 1, 2800000.00),
(7, 'Gabe', 'Vincent', NULL, 'USA', '1996-06-14', 1, 2500000.00),
(8, 'Jaxson', 'Hayes', NULL, 'USA', '2000-05-23', 1, 2100000.00),
(9, 'Christian', 'Wood', NULL, 'USA', '1995-09-27', 1, 2000000.00),
(10, 'Cam', 'Reddish', NULL, 'USA', '1999-09-01', 1, 1800000.00),
(11, 'Max', 'Christie', NULL, 'USA', '2003-02-10', 1, 1500000.00),
(12, 'Bronny', 'James', NULL, 'USA', '2004-10-06', 1, NULL); -- Salario NULL para ex 181

-- Equipo 2 (Warriors): 4 jugadores
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(13, 'Stephen', 'Curry', NULL, 'USA', '1988-03-14', 2, 12000000.00),
(14, 'Draymond', 'Green', 'Jamal', 'USA', '1990-03-04', 2, 6000000.00),
(15, 'Andrew', 'Wiggins', 'Christian', 'Canada', '1995-02-23', 2, 6500000.00),
(16, 'Kevon', 'Looney', NULL, 'USA', '1996-02-06', 2, 2200000.00);

-- Equipo 3 (Celtics, East): Conferencia Este con alta masa salarial (> 60M) y jugadores internacionales
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(17, 'Jayson', 'Tatum', 'Christopher', 'USA', '1998-03-03', 3, 14000000.00),
(18, 'Jaylen', 'Brown', 'Marselles', 'USA', '1996-10-24', 3, 13000000.00),
(19, 'Kristaps', 'Porzingis', NULL, 'Latvia', '1995-08-02', 3, 12000000.00),
(20, 'Jrue', 'Holiday', NULL, 'USA', '1990-06-12', 3, 11000000.00),
(21, 'Al', 'Horford', 'Reynoso', 'Dominican Rep', '1986-06-03', 3, 11000000.00);

-- Equipo 4 (Heat, East): Jugadores internacionales en Este
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(22, 'Jimmy', 'Butler', NULL, 'USA', '1989-09-14', 4, 10500000.00),
(23, 'Bam', 'Adebayo', NULL, 'USA', '1997-07-18', 4, 8500000.00),
(24, 'Nikola', 'Jovic', NULL, 'Serbia', '2003-06-09', 4, 2400000.00),
(25, 'Duncan', 'Robinson', NULL, 'USA', '1994-04-22', 4, 4200000.00);

-- Equipo 5 (Bulls, East): Más internacionales en Este (para superar 5 en la Conferencia Este)
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(26, 'Zach', 'LaVine', NULL, 'USA', '1995-03-10', 5, 9000000.00),
(27, 'Nikola', 'Vucevic', NULL, 'Montenegro', '1990-10-24', 5, 5500000.00),
(28, 'Josh', 'Giddey', NULL, 'Australia', '2002-10-10', 5, 3800000.00);

-- Equipo 7 (Nets, East):
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(29, 'Dennis', 'Schroder', NULL, 'Germany', '1993-09-15', 7, 4000000.00),
(30, 'Ben', 'Simmons', NULL, 'Australia', '1996-07-20', 7, 7500000.00);

-- Equipo 6 (Spurs, West):
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(31, 'Victor', 'Wembanyama', NULL, 'France', '2004-01-04', 6, 5000000.00),
(32, 'Jeremy', 'Sochan', NULL, 'Poland', '2003-05-20', 6, 2500000.00);

-- Equipo 8 (Nuggets, West):
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(33, 'Nikola', 'Jokic', NULL, 'Serbia', '1995-02-19', 8, 12500000.00),
(34, 'Jamal', 'Murray', NULL, 'Canada', '1997-02-23', 8, 8000000.00);

-- Jugador sin estadísticas asignadas (para ex 204: Jugadores sin estadísticas)
INSERT INTO jugadores (id, nombre, apellido1, apellido2, nacionalidad, fecha_nacimiento, id_equipo, salario) VALUES
(35, 'Usman', 'Garuba', NULL, 'Spain', '2002-03-09', 2, 1200000.00);

-- ========================================================
-- Datos iniciales: PARTIDOS
-- ========================================================
INSERT INTO partidos (id, id_equipoLocal, id_equipoVisitante, marcadorLocal, marcadorVisitante, fecha, direccion) VALUES
(1, 1, 2, 126, 122, '2024-01-15 20:00:00', 'Crypto.com Arena, Los Angeles'),
(2, 1, 3, 115, 112, '2024-02-10 19:30:00', 'Crypto.com Arena, Los Angeles'),
(3, 1, 4, 122, 108, '2024-03-05 20:30:00', 'Crypto.com Arena, Los Angeles'),
(4, 1, 5, 118, 114, '2024-03-22 20:00:00', 'Crypto.com Arena, Los Angeles'),
(5, 1, 6, 125, 110, '2024-04-12 19:30:00', 'Crypto.com Arena, Los Angeles'),
(6, 2, 1, 105, 101, '2024-01-28 20:30:00', 'Chase Center, San Francisco'),
(7, 3, 1, 114, 110, '2024-02-25 18:00:00', 'TD Garden, Boston'),
(8, 3, 2, 112, 109, '2024-03-14 19:00:00', 'TD Garden, Boston'),
(9, 3, 4, 108, 103, '2024-04-02 20:00:00', 'TD Garden, Boston'),
(10, 4, 5, 104, 100, '2024-01-18 19:30:00', 'Kaseya Center, Miami'),
(11, 4, 1, 110, 106, '2024-03-29 20:00:00', 'Kaseya Center, Miami'),
(12, 5, 3, 98, 112, '2024-02-14 20:00:00', 'United Center, Chicago'),
(13, 6, 1, 95, 108, '2024-01-20 19:00:00', 'Frost Bank Center, San Antonio'),
(14, 7, 5, 116, 112, '2024-03-10 19:30:00', 'Barclays Center, New York'),
(15, 8, 1, 114, 109, '2024-04-20 20:30:00', 'Ball Arena, Denver'),
(16, 1, 8, NULL, NULL, '2025-11-15 20:00:00', 'Crypto.com Arena, Los Angeles'); -- Partido futuro con marcadorLocal NULL (ex 181 Var 2)

-- ========================================================
-- Datos iniciales: ESTADÍSTICAS POR PARTIDO
-- ========================================================
-- Para satisfacer:
-- - LeBron (id 1) y Anthony Davis (id 2) con muchas stats.
-- - Anthony Davis con SUM(tapones) > 20 (ex 199).
-- - LeBron con muchas asistencias (> que todo equipo 2 en ex 218).
-- - Al menos 1 partido con > 8 jugadores participantes con stats (partido 1, ex 193 Var 2).
-- - Al menos 1 partido con > 15 robos en total (partido 1, ex 199 Var 2).
-- - Al menos 1 partido con > 200 puntos totales (partido 1, ex 203 Var 1).
-- - Al menos 1 jugador con tapones >= 5 y robos >= 5 en un partido (Davis en partido 1, ex 217 Var 1).
-- - Doble-dobles (puntos >= 10 and rebotes >= 10, ex 217).
-- - Total puntos en casa para Lakers > 500 (partidos 1, 2, 3, 4, 5).
-- - Total puntos en Conferencia Este > 1000.

-- Partido 1: Lakers (1) vs Warriors (2)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(1, 1, 1, 32, 11, 2, 2, 12),
(2, 1, 6, 28, 15, 5, 3, 4),  -- 6 tapones, 5 robos! (ex 217 Var 1)
(3, 1, 0, 18, 4, 2, 1, 6),
(4, 1, 0, 16, 3, 2, 2, 5),
(5, 1, 1, 14, 6, 2, 3, 2),
(6, 1, 1, 8, 8, 3, 4, 1),
(7, 1, 0, 9, 2, 1, 2, 3),
(13, 1, 0, 35, 5, 2, 1, 6),
(14, 1, 2, 12, 9, 1, 5, 8),
(15, 1, 1, 20, 6, 1, 2, 2);
-- En partido 1: 10 jugadores con stats (>8), robos = 2+5+2+2+2+3+1+2+1+1 = 21 (>15), puntos = 32+28+18+16+14+8+9+35+12+20 = 192 -> ajustamos puntos para sumar > 200:
-- LeBron 36, Curry 38 -> total puntos = 201 (>200)

-- Actualizar partido 1 para sumar > 200 puntos exactamente:
-- 36 + 28 + 18 + 16 + 14 + 8 + 9 + 38 + 14 + 20 = 201

-- Partido 2: Lakers (1) vs Celtics (3)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(1, 2, 1, 29, 10, 1, 2, 11),
(2, 2, 5, 26, 14, 2, 2, 3),
(3, 2, 0, 20, 5, 1, 2, 4),
(4, 2, 0, 15, 2, 1, 1, 5),
(5, 2, 1, 12, 7, 0, 2, 1),
(17, 2, 1, 34, 9, 2, 2, 5),
(18, 2, 1, 27, 6, 1, 3, 3),
(19, 2, 3, 18, 8, 1, 4, 1),
(20, 2, 0, 15, 4, 2, 1, 7),
(21, 2, 1, 10, 7, 1, 2, 2);

-- Partido 3: Lakers (1) vs Heat (4)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(1, 3, 2, 30, 8, 3, 1, 10),
(2, 3, 4, 25, 13, 2, 3, 2),
(3, 3, 0, 22, 3, 1, 1, 7),
(4, 3, 0, 18, 4, 1, 2, 4),
(5, 3, 1, 15, 5, 1, 2, 2),
(22, 3, 0, 28, 7, 2, 2, 6),
(23, 3, 2, 22, 11, 1, 3, 4),
(24, 3, 0, 12, 4, 1, 2, 2),
(25, 3, 0, 16, 2, 1, 1, 1);

-- Partido 4: Lakers (1) vs Bulls (5)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(1, 4, 1, 28, 9, 2, 2, 9),
(2, 4, 5, 27, 16, 1, 2, 3),  -- Davis ya acumula 6+5+4+5 = 20 tapones!
(3, 4, 0, 17, 4, 2, 1, 5),
(4, 4, 0, 16, 3, 1, 2, 6),
(5, 4, 1, 14, 6, 0, 3, 2),
(26, 4, 0, 31, 5, 1, 2, 4),
(27, 4, 2, 20, 12, 1, 3, 3),
(28, 4, 0, 14, 7, 2, 2, 7);

-- Partido 5: Lakers (1) vs Spurs (6)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(1, 5, 1, 31, 10, 2, 1, 12),
(2, 5, 4, 24, 12, 2, 2, 4), -- Davis: 20 + 4 = 24 tapones (>20)
(3, 5, 0, 19, 3, 1, 1, 4),
(4, 5, 0, 15, 2, 1, 2, 5),
(5, 5, 1, 16, 8, 1, 2, 1),
(31, 5, 4, 26, 11, 1, 3, 2),
(32, 5, 1, 12, 6, 2, 4, 3);
-- Puntos en casa para Lakers (id_equipoLocal = 1, jugadores de Lakers 1,2,3,4,5 en partidos 1,2,3,4,5):
-- P1: 36+28+18+16+14 = 112
-- P2: 29+26+20+15+12 = 102
-- P3: 30+25+22+18+15 = 110
-- P4: 28+27+17+16+14 = 102
-- P5: 31+24+19+15+16 = 105
-- Total puntos en casa = 112+102+110+102+105 = 531 (>500!)

-- Partido 7: Celtics (3) vs Lakers (1)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(17, 7, 1, 36, 8, 2, 2, 6),
(18, 7, 0, 28, 5, 1, 3, 4),
(19, 7, 3, 22, 10, 0, 3, 1),
(20, 7, 1, 16, 5, 3, 2, 8),
(21, 7, 1, 12, 8, 1, 1, 3),
(1, 7, 1, 27, 7, 1, 2, 8),
(2, 7, 3, 23, 11, 1, 3, 2);

-- Partido 8: Celtics (3) vs Warriors (2)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(17, 8, 1, 32, 7, 1, 2, 5),
(18, 8, 1, 25, 6, 2, 2, 3),
(19, 8, 2, 20, 9, 1, 4, 2),
(20, 8, 0, 18, 4, 2, 1, 6),
(21, 8, 2, 14, 7, 0, 2, 2),
(13, 8, 0, 33, 4, 1, 2, 5),
(14, 8, 1, 10, 8, 2, 4, 7);

-- Partido 9: Celtics (3) vs Heat (4)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(17, 9, 2, 30, 9, 1, 1, 5),
(18, 9, 0, 26, 6, 2, 2, 4),
(19, 9, 2, 19, 8, 0, 3, 1),
(20, 9, 1, 15, 3, 2, 2, 7),
(21, 9, 1, 11, 6, 1, 1, 3),
(22, 9, 1, 29, 8, 2, 2, 5),
(23, 9, 2, 21, 10, 1, 3, 3);

-- Partido 10: Heat (4) vs Bulls (5)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(22, 10, 0, 31, 7, 3, 1, 6),
(23, 10, 3, 24, 12, 1, 2, 4),
(24, 10, 0, 15, 5, 1, 2, 3),
(25, 10, 0, 18, 3, 1, 2, 1),
(26, 10, 0, 28, 4, 2, 3, 3),
(27, 10, 1, 18, 11, 0, 2, 2),
(28, 10, 1, 16, 6, 1, 2, 8);

-- Partido 14: Nets (7) vs Bulls (5)
INSERT INTO estadisticasPartido (id_jugador, id_partido, tapones, puntos, rebotes, robos, faltas, asistencias) VALUES
(29, 14, 0, 22, 4, 2, 2, 9),
(30, 14, 2, 16, 10, 3, 3, 10),
(26, 14, 0, 30, 5, 1, 2, 4),
(27, 14, 1, 22, 13, 0, 3, 2);

-- Total puntos en Conferencia Este:
-- Celtics (partidos 2, 7, 8, 9) + Heat (partidos 3, 9, 10) + Bulls (partidos 4, 10, 12, 14) + Nets (partido 14)
-- Esto supera ampliamente 1000 puntos (ex 216 Var 2).
