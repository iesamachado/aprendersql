CREATE DATABASE IF NOT EXISTS cosmere;
USE cosmere;

CREATE TABLE Planetas (
    id_planeta INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    esquirla_residente VARCHAR(100)
);

CREATE TABLE Sistemas_Magia (
    id_magia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    id_planeta_origen INT,
    FOREIGN KEY (id_planeta_origen) REFERENCES Planetas(id_planeta)
);

CREATE TABLE Personajes (
    id_personaje INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    id_planeta_natal INT,
    FOREIGN KEY (id_planeta_natal) REFERENCES Planetas(id_planeta)
);

CREATE TABLE Habilidades (
    id_personaje INT,
    id_magia INT,
    nivel_poder INT,
    PRIMARY KEY(id_personaje, id_magia),
    FOREIGN KEY (id_personaje) REFERENCES Personajes(id_personaje),
    FOREIGN KEY (id_magia) REFERENCES Sistemas_Magia(id_magia)
);

INSERT INTO Planetas (nombre, esquirla_residente) VALUES ('Scadrial', 'Ruina'), ('Roshar', 'Honor'), ('Nalthis', 'Dotación');
INSERT INTO Sistemas_Magia (nombre, id_planeta_origen) VALUES ('Alomancia', 1), ('Potenciación', 2), ('Despertar', 3), ('Feruquimia', 1);
INSERT INTO Personajes (nombre, id_planeta_natal) VALUES ('Kelsier', 1), ('Kaladin', 2), ('Vasher', 3), ('Hoid', NULL);
INSERT INTO Habilidades (id_personaje, id_magia, nivel_poder) VALUES (1, 1, 100), (2, 2, 95), (3, 3, 90), (4, 1, 50), (4, 3, 80);