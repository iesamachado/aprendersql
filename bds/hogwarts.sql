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

INSERT INTO Casas (nombre_casa, fundador) VALUES ('Gryffindor', 'Godric Gryffindor'), ('Slytherin', 'Salazar Slytherin'), ('Ravenclaw', 'Rowena Ravenclaw'), ('Hufflepuff', 'Helga Hufflepuff');
INSERT INTO Asignaturas (nombre_asig, profesor) VALUES ('Pociones', 'Severus Snape'), ('Defensa Contra las Artes Oscuras', 'Remus Lupin'), ('Transformaciones', 'Minerva McGonagall');
INSERT INTO Alumnos (nombre, curso, id_casa) VALUES ('Harry Potter', 5, 1), ('Draco Malfoy', 5, 2), ('Hermione Granger', 5, 1), ('Luna Lovegood', 4, 3);
INSERT INTO Matriculas (id_alumno, id_asignatura, nota_timos) VALUES (1, 2, 9.5), (3, 1, 10.0), (3, 2, 9.8), (2, 1, 8.5);