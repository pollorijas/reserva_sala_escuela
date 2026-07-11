-- ============================================================
-- Seguridad del Sistema de Registro de Sala
--
-- Ejecutar UNA VEZ en Supabase:
-- Dashboard → SQL Editor → New query → pegar este archivo → Run
--
-- Qué hace:
--   * Impide reservas duplicadas del mismo bloque en la misma fecha.
--   * Activa Row Level Security (RLS) en las tres tablas.
--   * La clave pública (anon, la que usa el navegador) solo puede:
--       - LEER semanas, bloques y reservas
--       - CREAR reservas (los profesores reservan sin login)
--   * Todo lo demás (editar/eliminar reservas, crear semanas,
--     editar notas) queda BLOQUEADO para el navegador y solo es
--     posible a través de las funciones de Netlify, que usan la
--     clave service_role + la contraseña de administrador.
-- ============================================================

-- 1) Evitar doble reserva del mismo bloque en la misma fecha.
--    Si este paso falla, es porque ya existen reservas duplicadas:
--    revíselas con la consulta comentada al final y elimínelas antes.
do $$
begin
    alter table reservas
        add constraint reservas_bloque_fecha_unicos unique (bloque_id, fecha);
exception
    when duplicate_object then null;
    when duplicate_table then null;
end $$;

-- 2) Activar Row Level Security
alter table semanas  enable row level security;
alter table bloques  enable row level security;
alter table reservas enable row level security;

-- 3) Políticas de LECTURA pública (necesarias para ambas páginas)
drop policy if exists "lectura_publica_semanas"  on semanas;
drop policy if exists "lectura_publica_bloques"  on bloques;
drop policy if exists "lectura_publica_reservas" on reservas;

create policy "lectura_publica_semanas"  on semanas  for select using (true);
create policy "lectura_publica_bloques"  on bloques  for select using (true);
create policy "lectura_publica_reservas" on reservas for select using (true);

-- 4) Política de INSERCIÓN pública en reservas
--    (permite que los profesores registren sin iniciar sesión)
drop policy if exists "insercion_publica_reservas" on reservas;

create policy "insercion_publica_reservas" on reservas
    for insert with check (true);

-- 5) IMPORTANTE: no se crean políticas de UPDATE ni DELETE.
--    Con RLS activo y sin política, esas operaciones quedan
--    denegadas para la clave anon. La clave service_role
--    (usada solo por las funciones de Netlify) las omite.

-- ------------------------------------------------------------
-- Consulta auxiliar: detectar reservas duplicadas antes del paso 1
-- (descomentar y ejecutar solo si el paso 1 falla)
--
-- select bloque_id, fecha, count(*)
-- from reservas
-- group by bloque_id, fecha
-- having count(*) > 1;
-- ------------------------------------------------------------
