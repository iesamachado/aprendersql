drop database if exists nba;
create database nba;
use nba;


create table equipos(
  id int primary key auto_increment,
  nombre varchar(20) not null,
  conferencia varchar(10) not null,
  presidente varchar(25) not null,
  ciudad varchar(30) not null,
  direccion_sede varchar(255) not null
);


create table jugadores (
  id int primary key auto_increment,
  nombre varchar(20) not null,
  apellido1 varchar(20) not null,
  apellido2 varchar(20) NULL,
  nacionalidad varchar(15),
  fecha_nacimiento datetime not null,
  id_equipo int not null,
  salario decimal(10,2) null,
  foreign key (id_equipo) references equipos(id)
);

create table partidos(
  id int primary key auto_increment,
  id_equipoLocal int not null,
  id_equipoVisitante int not null,
  marcadorLocal int NULL,
  marcadorVisitante int NULL,
  fecha datetime not null,
  direccion varchar(255),
  foreign key (id_equipoVisitante) references equipos(id),
  foreign key (id_equipoLocal) references equipos(id)
);

create table estadisticasPartido(
  id_jugador int not null,
  id_partido int not null,
  tapones int not null,
  puntos int not null,
  rebotes int not null,
  robos int not null,
  faltas int not null,
  asistencias int not null,
  foreign key (id_jugador) references jugadores(id),
  foreign key (id_partido) references partidos(id),
  primary key(id_jugador,id_partido)
);
  


