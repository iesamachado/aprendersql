CREATE DATABASE IF NOT EXISTS mmorpg;
USE mmorpg;

CREATE TABLE Gremios (
    id_gremio INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    nivel_gremio INT DEFAULT 1
);

CREATE TABLE Jugadores (
    id_jugador INT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50),
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

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Gremios (id_gremio, nombre, nivel_gremio) VALUES 
(1, 'Los Iluminados', 10), 
(2, 'Horda de Sangre', 5), 
(3, 'Comerciantes', 2),
(4, 'Novatos de Rune', 1),   -- nivel_gremio = 1 (ex 239)
(5, 'Orden del Fénix', 15), -- nivel_gremio > 10 (ex 239)
(6, 'Gremio Fantasma', 3);  -- sin jugadores (ex 265, 270 Var 1, 278)

INSERT INTO Jugadores (id_jugador, nickname, nivel, id_gremio) VALUES 
(1, 'ShadowHunter', 55, 1), 
(2, 'MagePro', 49, 1), 
(3, 'NoobSlayer', 10, 2), 
(4, 'ElRichMC', 99, 3),
(5, 'PaladinSun', 25, 1),      -- nivel BETWEEN 20 AND 40 (ex 241), gremio 1 tiene > 2 jugadores (ex 256 Var 1)
(6, 'RangerElf', 35, 2),       -- nivel BETWEEN 20 AND 40 (ex 241)
(7, 'ClericMoon', 1, NULL),    -- nivel = 1 (ex 239 Var 1), id_gremio IS NULL (ex 243, 265 Var 2)
(8, NULL, 65, 3),              -- nickname IS NULL (ex 243 Var 2)
(9, 'LoboSolitario', 70, NULL); -- sin objetos en inventario (ex 270 Var 2, 278 Var 2)

INSERT INTO Objetos (id_objeto, nombre_objeto, rareza, daño) VALUES 
(1, 'Espada del Caos', 'Legendaria', 150), 
(2, 'Poción de Vida', 'Común', 0),          -- daño = 0 (ex 239 Var 2)
(3, 'Arco Largo', 'Rara', 45),
(4, 'Daga Sombría', 'Rara', 30),            -- rareza 'Rara' repetida -> COUNT(*) > 1 (ex 256)
(5, 'Martillo Titánico', 'Legendaria', 250), -- daño > 200 (ex 239 Var 2)
(6, 'Piedra Misteriosa', NULL, 0),          -- rareza IS NULL (ex 243 Var 1)
(7, 'Anillo Antiguo', 'Épico', 10);         -- no está en ningún inventario (ex 270, 265 Var 1, 278 Var 1)

INSERT INTO Inventarios (id_jugador, id_objeto, cantidad) VALUES 
-- Jugador 1 tiene 4 objetos distintos: COUNT(*) > 3 (ex 256 Var 2)
(1, 1, 1), 
(1, 2, 5), 
(1, 3, 1),
(1, 4, 2),
(2, 2, 10), 
(4, 1, 2), 
(3, 3, 1),
(5, 4, 1),
(6, 5, 1);
