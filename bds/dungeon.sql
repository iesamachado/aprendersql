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

INSERT INTO Niveles (numero_planta, bioma, jefe_final) VALUES (1, 'Cueva Oscura', 'Troll Gigante'), (2, 'Jungla Venenosa', 'Reina Araña'), (3, 'Tundra', 'Gusano de Hielo');
INSERT INTO Patrocinadores (nombre_raza, presupuesto) VALUES ('Zeta-Reticulanos', 50000), ('Pleyadianos', 120000), ('Reptilianos', 5000);
INSERT INTO Crawlers (nombre, clase, id_nivel_actual) VALUES ('DungeonMaster', 'Mago de Combate', 2), ('LootGoblin', 'Pícaro', 1), ('TankyBoy', 'Guerrero', 3);
INSERT INTO Cajas_Botin (id_crawler, id_patrocinador, contenido, valor) VALUES (1, 2, 'Bastón de Luz', 1500), (2, 1, 'Daga Oxidada', 50), (1, 1, 'Poción Mágica', 300), (3, 3, 'Escudo Espacial', 2500);