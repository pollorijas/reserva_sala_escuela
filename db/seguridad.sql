-- ============================================================
-- Seguridad del Sistema de Registro de Sala
--
-- Ejecutar UNA VEZ en Supabase:
-- Dashboard → SQL Editor → New query → pegar este archivo → Run
--
-- Qué hace:
--   * Impide reservas duplicadas del mismo bloque en la misma fecha.
--   * Activa Row Level Security (RLS) en las tres tablas y elimina
--     cualquier política previa que pudiera dejarlas abiertas.
--   * La clave pública (anon, la que usa el navegador) solo puede:
--       - LEER semanas, bloques y reservas
--       - CREAR reservas de cursos de 1° a 8° Básico (los profesores
--         reservan sin login; los usos administrativos como Feriado
--         o Mantención quedan reservados al administrador)
--   * Todo lo demás (editar/eliminar reservas, crear semanas,
--     editar notas, reservas administrativas) queda BLOQUEADO para el
--     navegador y solo es posible a través de las funciones de Netlify,
--     que usan la clave service_role + la contraseña de administrador.
--   * Valida cada reserva: largo máximo de textos, fecha dentro de la
--     semana indicada y tipo de bloque acorde al día (viernes/lunes-jueves).
--   * Registra la fecha y hora de creación de cada reserva (creado_en).
--
-- Es seguro ejecutarlo más de una vez (es idempotente).
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

-- 3) Eliminar TODAS las políticas existentes en las tres tablas.
--    IMPORTANTE: las políticas de Supabase se SUMAN entre sí. Si queda
--    una política antigua tipo "Allow all operation on ..." (FOR ALL,
--    USING true), anula todas las restricciones de abajo y la clave
--    pública podría seguir modificando y borrando datos.
do $$
declare
    pol record;
begin
    for pol in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('semanas', 'bloques', 'reservas')
    loop
        execute format('drop policy %I on %I.%I',
                       pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end $$;

-- 4) Políticas de LECTURA pública (necesarias para ambas páginas)
create policy "lectura_publica_semanas"  on semanas  for select using (true);
create policy "lectura_publica_bloques"  on bloques  for select using (true);
create policy "lectura_publica_reservas" on reservas for select using (true);

-- 5) Política de INSERCIÓN pública en reservas
--    Permite que los profesores registren SIN iniciar sesión, pero solo
--    con cursos de 1° a 8° Básico (A o B). Los usos administrativos
--    (Mantención, UTP, Senda Previene, Feriado, Vacaciones) solo se pueden
--    crear desde el panel de administrador, vía la función admin-api.
create policy "insercion_publica_reservas" on reservas
    for insert with check (curso ~ '^[1-8]° Básico [AB]$');

-- 6) No se crean políticas de UPDATE ni DELETE.
--    Con RLS activo y sin política, esas operaciones quedan
--    denegadas para la clave anon. La clave service_role
--    (usada solo por las funciones de Netlify) las omite.

-- 7) Fecha y hora de creación de cada reserva.
--    Sirve para detectar envíos masivos y saber qué reservas eliminar.
--    Las reservas anteriores a este cambio quedan con valor vacío (null).
alter table reservas add column if not exists creado_en timestamptz;
alter table reservas alter column creado_en set default now();

-- 8) Límites de largo (evita textos gigantes que consuman el espacio)
alter table reservas drop constraint if exists reservas_largos_validos;
alter table reservas add constraint reservas_largos_validos check (
    char_length(btrim(curso))    >= 1
    and char_length(btrim(profesor)) between 1 and 100
    and char_length(coalesce(actividad, ''))     <= 500
    and char_length(coalesce(observaciones, '')) <= 500
);

-- 9) Coherencia de la reserva (al crear o modificar):
--      * la semana y el bloque deben existir
--      * la fecha debe estar dentro de la semana indicada
--      * los bloques de viernes solo en viernes y los de lunes a jueves
--        solo de lunes a jueves
--    También fija creado_en con la hora del servidor, para que no
--    se pueda falsear desde el navegador.
create or replace function validar_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_inicio date;
    v_fin    date;
    v_tipo   text;
    v_dia    int;
begin
    select fecha_inicio, fecha_fin into v_inicio, v_fin
    from semanas where id = new.semana_id;

    select dia_semana into v_tipo
    from bloques where id = new.bloque_id;

    if v_inicio is null or v_tipo is null then
        raise exception 'La semana o el bloque indicado no existe'
            using errcode = 'check_violation';
    end if;

    if new.fecha < v_inicio or new.fecha > v_fin then
        raise exception 'La fecha % no pertenece a la semana seleccionada', new.fecha
            using errcode = 'check_violation';
    end if;

    v_dia := extract(isodow from new.fecha);

    if v_tipo = 'Viernes' and v_dia <> 5 then
        raise exception 'Los bloques de viernes solo se pueden reservar en viernes'
            using errcode = 'check_violation';
    end if;

    if v_tipo = 'Lunes-Jueves' and v_dia not between 1 and 4 then
        raise exception 'Los bloques de lunes a jueves solo se pueden reservar de lunes a jueves'
            using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT' then
        new.creado_en := now();
    else
        new.creado_en := old.creado_en;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_validar_reserva on reservas;
create trigger trg_validar_reserva
    before insert or update on reservas
    for each row execute function validar_reserva();

-- ------------------------------------------------------------
-- Verificación (opcional): como clave pública, las modificaciones
-- deben afectar 0 filas y la lectura debe devolver todos los datos.
-- No cambia datos: todo se deshace con rollback.
--
-- begin;
-- set local role anon;
-- with r as (update reservas set curso = curso where id = (select min(id) from reservas) returning 1)
-- select (select count(*) from r) as reservas_modificables,   -- esperado: 0
--        (select count(*) from reservas) as reservas_legibles; -- esperado: total de reservas
-- rollback;
--
-- Ver las políticas vigentes (deben ser solo 4: 3 de lectura + 1 inserción):
-- select tablename, policyname, cmd from pg_policies where schemaname = 'public';
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Consulta auxiliar: detectar reservas duplicadas antes del paso 1
-- (descomentar y ejecutar solo si el paso 1 falla)
--
-- select bloque_id, fecha, count(*)
-- from reservas
-- group by bloque_id, fecha
-- having count(*) > 1;
-- ------------------------------------------------------------
