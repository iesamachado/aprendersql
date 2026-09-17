CREATE DATABASE IF NOT EXISTS refugio;
USE refugio;

CREATE TABLE Trabajos (
    id_trabajo INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100),
    riesgo VARCHAR(50)
);

CREATE TABLE Moradores (
    id_morador INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    atributos_SPECIAL VARCHAR(50),
    id_trabajo INT,
    FOREIGN KEY (id_trabajo) REFERENCES Trabajos(id_trabajo)
);

CREATE TABLE Suministros (
    id_suministro INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50),
    cantidad_kilos INT
);

CREATE TABLE Expediciones (
    id_expedicion INT AUTO_INCREMENT PRIMARY KEY,
    id_morador INT,
    dias_fuera INT,
    botin_recuperado INT,
    FOREIGN KEY (id_morador) REFERENCES Moradores(id_morador)
);

INSERT INTO Trabajos (titulo, riesgo) VALUES ('Cocinero', 'Bajo'), ('Seguridad', 'Medio'), ('Explorador', 'Alto');
INSERT INTO Moradores (nombre, atributos_SPECIAL, id_trabajo) VALUES ('Vault Boy', 'S10P10', 3), ('Lucy', 'S4P8', 1), ('Maximus', 'S9P5', 2);
INSERT INTO Suministros (tipo, cantidad_kilos) VALUES ('Agua Purificada', 500), ('Carne de Mutascorpius', 50), ('Estimulantes', 10);
INSERT INTO Expediciones (id_morador, dias_fuera, botin_recuperado) VALUES (1, 5, 200), (3, 0, 0), (1, 10, 500);