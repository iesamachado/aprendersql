DROP DATABASE IF EXISTS turnos_sas_exam;
CREATE DATABASE turnos_sas_exam;
USE turnos_sas_exam;

CREATE TABLE hospitales (
    id_hospital INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(10), 
    telefono INT, 
    provincia VARCHAR(50)
);


CREATE TABLE pacientes (
    id_paciente TINYINT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellidos VARCHAR(50) NOT NULL,
    nuhsa VARCHAR(50) NOT NULL,
    direccion_completa VARCHAR(200),
    edad INT 
);


CREATE TABLE tickets (
    id_ticket INT AUTO_INCREMENT PRIMARY KEY,
    codigo CHAR(2), 
    fecha_emision VARCHAR(20), 
    id_paciente TINYINT,
    CONSTRAINT fk_ticket_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)
);


CREATE TABLE llamadas_pantalla (
    id_llamada INT AUTO_INCREMENT PRIMARY KEY,
    id_ticket INT,
    hora_llamada VARCHAR(10),
    prioridad VARCHAR(50), 
    FOREIGN KEY (id_ticket) REFERENCES tickets(id_ticket)
);



INSERT INTO hospitales (nombre, telefono, provincia) VALUES 
('Hosp. Maca', 955010101, 'Sevilla'), 
('Hosp. Roci', 955020202, 'Sevilla'), 
('Reina Sofi', 957010101, 'Córdoba');

INSERT INTO pacientes (id_paciente, nombre, apellidos, nuhsa, edad) VALUES 
(1, 'Juan', 'Pérez', 'AN123456', 75),
(2, 'Ana', 'García', 'AN987654', 34),
(125, 'Luis', 'Sánchez', 'AN555555', 12); 

INSERT INTO tickets (codigo, fecha_emision, id_paciente) VALUES 
('A1', '2025-12-14', 1),
('B9', '2025-12-14', 2),
('C3', '2025-12-15', 125);

INSERT INTO llamadas_pantalla (id_ticket, hora_llamada, prioridad) VALUES 
(1, '10:00', '1'),
(2, '10:05', '2');