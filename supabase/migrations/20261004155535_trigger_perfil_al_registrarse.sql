-- Trigger en auth.users que crea el perfil de cada usuario nuevo
-- (función private.handle_new_user: rol 'consulta', inactivo).
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
