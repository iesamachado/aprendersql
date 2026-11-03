CREATE DATABASE IF NOT EXISTS heroes;
USE heroes;

CREATE TABLE Agencias (
    id_agencia INT AUTO_INCREMENT PRIMARY KEY,
    nombre_agencia VARCHAR(100),
    ciudad VARCHAR(100)
);

CREATE TABLE Heroes (
    id_heroe INT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(100),
    don VARCHAR(100),
    id_agencia INT,
    FOREIGN KEY (id_agencia) REFERENCES Agencias(id_agencia)
);

CREATE TABLE Misiones (
    id_mision INT AUTO_INCREMENT PRIMARY KEY,
    descripcion TEXT,
    nivel_amenaza VARCHAR(50)
);

CREATE TABLE Registro_Misiones (
    id_heroe INT,
    id_mision INT,
    daños_colaterales_euros DECIMAL(10,2),
    PRIMARY KEY(id_heroe, id_mision),
    FOREIGN KEY (id_heroe) REFERENCES Heroes(id_heroe),
    FOREIGN KEY (id_mision) REFERENCES Misiones(id_mision)
);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Agencias (id_agencia, nombre_agencia, ciudad) VALUES 
(1, 'Endeavor Agency', 'Tokio'), 
(2, 'Fat Gum Agency', 'Osaka'), 
(3, 'Nighteye Agency', 'Tokio'), -- comparte 'Tokio' con agencia 1 (ex 637 Var 1)
(4, 'Best Jeanist Agency', 'Fukuoka'); -- agencia sin héroes (ex 633 Var 1)

INSERT INTO Heroes (id_heroe, alias, don, id_agencia) VALUES 
(1, 'Endeavor', 'Llamas del Fuego Infernal', 1), 
(2, 'Hawks', 'Alas Rígidas', NULL), 
(3, 'Red Riot', 'Endurecimiento', 2),
(4, 'Deku', 'One For All', 3),
(5, 'Recovery Girl', 'Curación', NULL),     -- heroína pacifista sin misiones (ex 633)
(6, 'Shoto', 'Mitad Frío Mitad Caliente', 1); -- misma agencia 1 que Endeavor (ex 637)

INSERT INTO Misiones (id_mision, descripcion, nivel_amenaza) VALUES 
(1, 'Rescate en el tren', 'Nivel Dragón'), 
(2, 'Ataque de Nomu', 'Nivel Demonio'),
(3, 'Patrulla de barrio', 'Nivel Lobo'),      -- misión sin registros (ex 633 Var 2)
(4, 'Asalto a la fortaleza', 'Nivel Dragón'); -- mismo nivel_amenaza que misión 1 (ex 637 Var 2)

INSERT INTO Registro_Misiones (id_heroe, id_mision, daños_colaterales_euros) VALUES 
(1, 1, 50000.00), -- 50000 está BETWEEN 10000 AND 50000 (ex 601 Var 2)
(1, 2, 200.00),   -- id_heroe 1 con < 500 (ex 599 Var 2)
(2, 1, 0.00),
(3, 2, 1200.00),  -- 1200 está BETWEEN 500 AND 1500 (ex 601 Var 1), y BETWEEN 1000 AND 5000 (ex 601)
(4, 2, 3500.00);  -- id_mision 2 con 3500 > 2000 (ex 599), y BETWEEN 1000 AND 5000 (ex 601)
