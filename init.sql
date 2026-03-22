USE projectusers;

CREATE TABLE IF NOT EXISTS users (
  idUsers       INT AUTO_INCREMENT PRIMARY KEY,
  fullname      VARCHAR(255),
  poste         VARCHAR(255),
  email         VARCHAR(255),
  password      VARCHAR(255),
  idsecretaire  INT,
  type          VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS demande (
  iddemande     INT AUTO_INCREMENT PRIMARY KEY,
  iduser        INT,
  titre         VARCHAR(255),
  file_name     VARCHAR(255),
  file          LONGBLOB,
  date_demande  DATETIME,
  commentaire   TEXT
);

CREATE TABLE IF NOT EXISTS d_a (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  iddemande      INT,
  Nomapprobateur VARCHAR(255),
  ordre          INT,
  statut         INT,
  commentaire    TEXT
);

INSERT IGNORE INTO users (idUsers, fullname, poste, email, password, type)
VALUES (1, 'Admin', 'Administrateur', 'admin@example.com', 'admin123', 'Admin');
