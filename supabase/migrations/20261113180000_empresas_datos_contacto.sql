-- Base real: ynpvetdujkpxuaplsona.
-- Datos fiscales y de contacto de cada empresa (para membretes y formatos de la fase 4)
-- y llenado con la información de los membretes de BOCAM y TOLTECATL.
-- Aditiva: agrega columnas y llena datos de empresas; no toca otras tablas.

alter table public.empresas
  add column if not exists domicilio text,
  add column if not exists telefono text,
  add column if not exists email text;

update public.empresas set
  rfc = 'IMI2304186C1',
  domicilio = 'Calle Ignacio Zaragoza No. 12, Col. General Felipe Ángeles, Tolcayuca, Hidalgo, C.P. 43875',
  telefono = '55 2674 9910',
  email = 'serviciostoltecatl@gmail.com',
  logo_path = '/empresas/toltecatl-logo.jpg'
where clave = 'TOLTECATL';

update public.empresas set
  rfc = 'CIB130321IF7',
  domicilio = 'Edificio Campeche No. 43 Depto. 302, Fracc. Las Torres, C.P. 60950, Lázaro Cárdenas, Michoacán',
  telefono = '753 114 2513 / 753 531 3100',
  email = 'constructora_bocam@yahoo.com.mx'
where clave = 'BOCAM';

update public.empresas set
  logo_path = '/zaraman-logo.svg'
where clave = 'ZARAMAN';
