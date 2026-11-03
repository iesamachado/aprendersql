CREATE DATABASE IF NOT EXISTS dungeon;
USE dungeon;

CREATE TABLE Niveles (
    id_nivel INT AUTO_INCREMENT PRIMARY KEY,
    numero_planta INT NOT NULL,
    bioma VARCHAR(100),
    jefe_final VARCHAR(100)
);

CREATE TABLE Patrocinadores (
    id_patrocinador INT AUTO_INCREMENT PRIMARY KEY,
    nombre_raza VARCHAR(100),
    presupuesto INT
);

CREATE TABLE Crawlers (
    id_crawler INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    clase VARCHAR(50),
    id_nivel_actual INT,
    FOREIGN KEY (id_nivel_actual) REFERENCES Niveles(id_nivel)
);

CREATE TABLE Cajas_Botin (
    id_caja INT AUTO_INCREMENT PRIMARY KEY,
    id_crawler INT,
    id_patrocinador INT,
    contenido VARCHAR(200),
    valor INT,
    FOREIGN KEY (id_crawler) REFERENCES Crawlers(id_crawler),
    FOREIGN KEY (id_patrocinador) REFERENCES Patrocinadores(id_patrocinador)
);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Niveles (id_nivel, numero_planta, bioma, jefe_final) VALUES 
(1, 1, 'Cueva Oscura', 'Troll Gigante'), 
(2, 2, 'Jungla Venenosa', 'Reina Araña'), 
(3, 3, 'Tundra', 'Gusano de Hielo'),
(4, 11, 'Desierto', 'Escorpión Rey'), -- numero_planta > 10 (ex 297), bioma 'Desierto' (ex 300)
(5, 15, 'Océano', NULL);              -- numero_planta > 10 (ex 297), bioma 'Océano' (ex 300), jefe_final NULL (ex 303 Var 2), nivel sin crawlers (ex 325, 330 Var 2, 338 Var 1)

INSERT INTO Patrocinadores (id_patrocinador, nombre_raza, presupuesto) VALUES 
(1, 'Zeta-Reticulanos', 50000), 
(2, 'Pleyadianos', 120000), 
(3, 'Reptilianos', 5000),
(4, 'Anunnaki', 30000); -- patrocinador tacaño/pasivo sin cajas de botín (ex 325 Var 1, 330, 338)

INSERT INTO Crawlers (id_crawler, nombre, clase, id_nivel_actual) VALUES 
(1, 'DungeonMaster', 'Mago', 2),           -- clase 'Mago' exacta para ex 321
(2, 'LootGoblin', 'Pícaro', 1), 
(3, 'TankyBoy', 'Guerrero', 3),
(4, 'SirGalahad', 'Paladín', 4),           -- clase 'Paladín' para ex 300 Var 1
(5, 'BrotherTuck', 'Clérigo', 1),          -- clase 'Clérigo' para ex 300 Var 1
(6, 'Conan', 'Guerrero', 3),               -- clase repetida 'Guerrero' -> COUNT(*) > 1 (ex 316 Var 1)
(7, 'LostSoul', 'Explorador', NULL),       -- id_nivel_actual IS NULL (ex 303)
(8, 'NoLootGuy', 'Mago', 2);               -- crawler sin cajas de botín (ex 325 Var 2, 330 Var 1, 338 Var 2)

INSERT INTO Cajas_Botin (id_caja, id_crawler, id_patrocinador, contenido, valor) VALUES 
(1, 1, 2, 'Bastón de Luz', 1500), 
(2, 2, 1, 'Daga Oxidada', 50), 
(3, 1, 1, 'Poción Mágica', 300), 
(4, 1, 2, 'Tomo Legendario', 2000),        -- crawler 1 tiene 3 cajas: COUNT(*) > 2 (ex 316). En nivel 2, crawler 1 tiene 1500+300+2000 = 3800 > 3000 (ex 332)
(5, 3, 3, 'Escudo Espacial', 2500),        -- patrocinador 2 y 3 tienen SUM(valor) > 2000 (ex 316 Var 2)
(6, 4, NULL, 'Cofre Misterioso', 500);     -- id_patrocinador IS NULL (ex 303 Var 1)
