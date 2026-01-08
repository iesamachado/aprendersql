DROP DATABASE IF EXISTS laruina_exam;
CREATE DATABASE laruina_exam;
USE laruina_exam;


CREATE TABLE invitados (
    id_invitado TINYINT NOT NULL, 
    nombre VARCHAR(20),
    apellido1 VARCHAR(20),
    apellido2 VARCHAR(20),
    edad VARCHAR(10),     
    CONSTRAINT pk_invitados PRIMARY KEY (id_invitado)
);

CREATE TABLE programas (
    id_programa INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(10), 
    fecha_grabacion DATE,
    fecha_emision DATE,
    ciudad VARCHAR(50),
    teatro VARCHAR(50),
    precio_entrada DECIMAL(3,2), 
    id_invitado TINYINT, 
    CONSTRAINT fk_prog_invitado FOREIGN KEY (id_invitado) REFERENCES invitados(id_invitado)
);


CREATE TABLE ruinas (
    id_ruina INT PRIMARY KEY,
    titulo VARCHAR(50),
    apodo_publico VARCHAR(50),
    descripcion VARCHAR(50),
    edad_publico VARCHAR(10), 
    id_programa INT 
);


CREATE TABLE categorias (
    nombre_categoria VARCHAR(30),
    descripcion VARCHAR(100)
);


CREATE TABLE ruina_categorias (
    id_ruina INT,
    nombre_categoria VARCHAR(30)
);



INSERT INTO invitados VALUES (1, 'Berto', 'Romero', NULL, '48');
INSERT INTO invitados VALUES (2, 'Andreu', 'Buenafuente', 'Moreno', '57');
INSERT INTO invitados VALUES (3, 'Ana', 'Morgade', 'Perez', '43');

INSERT INTO programas (titulo, fecha_grabacion, ciudad, teatro, precio_entrada, id_invitado) 
VALUES ('Especial', '2023-10-12', 'Barcelona', 'Club Capitol', 9.99, 1);

INSERT INTO programas (titulo, fecha_grabacion, ciudad, teatro, precio_entrada, id_invitado) 
VALUES ('Navidad', '2023-12-24', 'Madrid', 'Cofidis', 5.50, 2);

INSERT INTO ruinas VALUES (100, 'Me cagué encima', 'El Caganer', 'Iba corriendo y no llegué al baño...', '25', 1);
INSERT INTO ruinas VALUES (101, 'Perdí el DNI', 'Despistada', 'En el aeropuerto me di cuenta que...', '30', 1);

