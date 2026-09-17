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

INSERT INTO Agencias (nombre_agencia, ciudad) VALUES ('Endeavor Agency', 'Tokio'), ('Fat Gum Agency', 'Osaka'), ('Nighteye Agency', 'Tokio');
INSERT INTO Heroes (alias, don, id_agencia) VALUES ('Endeavor', 'Llamas del Fuego Infernal', 1), ('Hawks', 'Alas Rígidas', NULL), ('Red Riot', 'Endurecimiento', 2);
INSERT INTO Misiones (descripcion, nivel_amenaza) VALUES ('Rescate en el tren', 'Nivel Dragón'), ('Ataque de Nomu', 'Nivel Demonio');
INSERT INTO Registro_Misiones (id_heroe, id_mision, daños_colaterales_euros) VALUES (1, 1, 50000.00), (2, 1, 0.00), (3, 2, 500.00);