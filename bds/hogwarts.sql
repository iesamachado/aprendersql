CREATE DATABASE IF NOT EXISTS hogwarts;
USE hogwarts;

CREATE TABLE Casas (
    id_casa INT AUTO_INCREMENT PRIMARY KEY,
    nombre_casa VARCHAR(50),
    fundador VARCHAR(100)
);

CREATE TABLE Asignaturas (
    id_asignatura INT AUTO_INCREMENT PRIMARY KEY,
    nombre_asig VARCHAR(100),
    profesor VARCHAR(100)
);

CREATE TABLE Alumnos (
    id_alumno INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    curso INT,
    id_casa INT,
    FOREIGN KEY (id_casa) REFERENCES Casas(id_casa)
);

CREATE TABLE Matriculas (
    id_alumno INT,
    id_asignatura INT,
    nota_timos DECIMAL(4,2),
    PRIMARY KEY(id_alumno, id_asignatura),
    FOREIGN KEY (id_alumno) REFERENCES Alumnos(id_alumno),
    FOREIGN KEY (id_asignatura) REFERENCES Asignaturas(id_asignatura)
);

-- ========================================================
-- DATOS INICIALES
-- ========================================================
INSERT INTO Casas (id_casa, nombre_casa, fundador) VALUES 
(1, 'Gryffindor', 'Godric Gryffindor'), 
(2, 'Slytherin', 'Salazar Slytherin'), 
(3, 'Ravenclaw', 'Rowena Ravenclaw'), 
(4, 'Hufflepuff', 'Helga Hufflepuff');

-- Profesores registrados con apellido exacto para coincidir con enunciados y soluciones (ex 658, 661)
INSERT INTO Asignaturas (id_asignatura, nombre_asig, profesor) VALUES 
(1, 'Pociones', 'Snape'), 
(2, 'Defensa Contra las Artes Oscuras', 'Lupin'), 
(3, 'Transformaciones', 'McGonagall'),
(4, 'Historia de la Magia', 'Binns'),
(5, 'Vuelo', NULL); -- profesor NULL (ex 668 Var 1)

INSERT INTO Alumnos (id_alumno, nombre, curso, id_casa) VALUES 
(1, 'Harry Potter', 5, 1), 
(2, 'Draco Malfoy', 5, 2), 
(3, 'Hermione Granger', 5, 1), 
(4, 'Luna Lovegood', 4, 3),
(5, 'Argus Filch', NULL, NULL), -- id_casa NULL (ex 668)
(6, 'Ron Weasley', 3, 1);       -- curso 3 (cumple BETWEEN 2 AND 4 para ex 663 Var 1)

INSERT INTO Matriculas (id_alumno, id_asignatura, nota_timos) VALUES 
(1, 1, 6.50), -- 6.50 está BETWEEN 5 AND 8 (ex 663)
(1, 2, 9.50), 
(2, 1, 8.50),
(3, 1, 10.00), 
(3, 2, 9.80), 
(3, 3, 9.50), -- Hermione matriculada en 3 asignaturas -> COUNT > 2 (ex 690 Var 2)
(4, 4, 3.50), -- Historia de la Magia
(6, 4, 4.00), -- Historia de la Magia media = (3.5 + 4.0)/2 = 3.75 < 5 (ex 690)
(6, 5, NULL); -- nota_timos NULL (ex 668 Var 2)
