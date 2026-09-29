// Pruebas de la función serverless de administrador (netlify/functions/admin-api.js)
// con la API de Supabase simulada: no se conecta a ninguna base de datos real.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// La función registra en consola los errores simulados; se silencian para no ensuciar la salida
console.error = () => {};

process.env.ADMIN_PASSWORD = 'clave-correcta-123';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'llave-de-servicio-falsa';

const { handler } = require(path.resolve(__dirname, '../../netlify/functions/admin-api.js'));

let llamadas = [];
let respuestaSupabase;

function supabaseResponde(ok, status, cuerpo) {
    respuestaSupabase = { ok, status, json: async () => cuerpo };
}

test.beforeEach(() => {
    llamadas = [];
    supabaseResponde(true, 200, [{ id: 99 }]);
    global.fetch = async (url, opciones) => {
        llamadas.push({ url, metodo: opciones.method, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined, cabeceras: opciones.headers });
        return respuestaSupabase;
    };
});

const enviar = (cuerpo) => handler({ httpMethod: 'POST', body: JSON.stringify(cuerpo) });
const CLAVE = 'clave-correcta-123';
const reservaBase = { semana_id: 41, bloque_id: 1, curso: 'Feriado', profesor: 'Administración', fecha: '2026-10-21' };

test('rechaza métodos distintos de POST', async () => {
    const r = await handler({ httpMethod: 'GET' });
    assert.equal(r.statusCode, 405);
});

test('responde a la solicitud previa (OPTIONS) de los navegadores', async () => {
    const r = await handler({ httpMethod: 'OPTIONS' });
    assert.equal(r.statusCode, 200);
});

test('rechaza un cuerpo que no es JSON', async () => {
    const r = await handler({ httpMethod: 'POST', body: '{no es json' });
    assert.equal(r.statusCode, 400);
});

test('rechaza sin contraseña y sin tocar la base de datos', async () => {
    const r = await enviar({ accion: 'eliminarReserva', datos: { id: 1 } });
    assert.equal(r.statusCode, 401);
    assert.equal(llamadas.length, 0);
});

test('rechaza una contraseña incorrecta y sin tocar la base de datos', async () => {
    const r = await enviar({ accion: 'eliminarReserva', clave: 'incorrecta', datos: { id: 1 } });
    assert.equal(r.statusCode, 401);
    assert.equal(llamadas.length, 0);
});

test('"verificar" acepta la contraseña correcta sin ejecutar acciones', async () => {
    const r = await enviar({ accion: 'verificar', clave: CLAVE });
    assert.equal(r.statusCode, 200);
    assert.equal(llamadas.length, 0);
});

test('falla con mensaje claro si no hay ADMIN_PASSWORD configurada', async () => {
    const guardada = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    try {
        const r = await enviar({ accion: 'verificar', clave: CLAVE });
        assert.equal(r.statusCode, 500);
        assert.match(JSON.parse(r.body).error, /ADMIN_PASSWORD/);
    } finally {
        process.env.ADMIN_PASSWORD = guardada;
    }
});

test('falla con mensaje claro si falta la clave de servicio de Supabase', async () => {
    const guardada = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
        const r = await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id: 1 } });
        assert.equal(r.statusCode, 500);
        assert.match(JSON.parse(r.body).error, /SUPABASE_SERVICE_ROLE_KEY/);
    } finally {
        process.env.SUPABASE_SERVICE_ROLE_KEY = guardada;
    }
});

test('usa la clave de servicio (no la pública) al hablar con Supabase', async () => {
    await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id: 5 } });
    assert.equal(llamadas[0].cabeceras.apikey, 'llave-de-servicio-falsa');
    assert.equal(llamadas[0].cabeceras.Authorization, 'Bearer llave-de-servicio-falsa');
});

test('rechaza acciones desconocidas', async () => {
    const r = await enviar({ accion: 'borrarTodo', clave: CLAVE });
    assert.equal(r.statusCode, 400);
    assert.equal(llamadas.length, 0);
});

test('eliminarReserva: usa DELETE sobre el id indicado', async () => {
    const r = await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id: 42 } });
    assert.equal(r.statusCode, 200);
    assert.equal(llamadas[0].metodo, 'DELETE');
    assert.ok(llamadas[0].url.endsWith('/rest/v1/reservas?id=eq.42'));
});

test('rechaza ids que no son números enteros positivos (evita inyección en la URL)', async () => {
    for (const id of ['1;drop table', '1 or 1=1', -3, 0, 1.5, null, undefined, {}, [1]]) {
        const r = await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id } });
        assert.equal(r.statusCode, 400, `id ${JSON.stringify(id)} debería rechazarse`);
    }
    assert.equal(llamadas.length, 0);
});

test('acepta un id numérico escrito como texto', async () => {
    const r = await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id: '7' } });
    assert.equal(r.statusCode, 200);
    assert.ok(llamadas[0].url.endsWith('id=eq.7'));
});

test('crearReserva: acepta cursos administrativos y hace POST a reservas', async () => {
    const r = await enviar({ accion: 'crearReserva', clave: CLAVE, datos: reservaBase });
    assert.equal(r.statusCode, 200);
    assert.equal(llamadas[0].metodo, 'POST');
    assert.ok(llamadas[0].url.endsWith('/rest/v1/reservas'));
    assert.equal(llamadas[0].cuerpo[0].curso, 'Feriado');
});

test('crearReserva: descarta campos que no están en la lista permitida', async () => {
    await enviar({ accion: 'crearReserva', clave: CLAVE, datos: { ...reservaBase, id: 5, rol: 'admin', creado_en: '2000-01-01' } });
    const enviado = llamadas[0].cuerpo[0];
    assert.equal('id' in enviado, false);
    assert.equal('rol' in enviado, false);
    assert.equal('creado_en' in enviado, false);
});

test('crearReserva: exige los campos obligatorios', async () => {
    const r = await enviar({ accion: 'crearReserva', clave: CLAVE, datos: { semana_id: 41 } });
    assert.equal(r.statusCode, 400);
    assert.equal(llamadas.length, 0);
});

test('actualizarReserva: filtra campos y hace PATCH', async () => {
    const r = await enviar({ accion: 'actualizarReserva', clave: CLAVE, datos: { id: 7, curso: '5° Básico A', profesor: 'Ana', rol: 'admin' } });
    assert.equal(r.statusCode, 200);
    assert.equal(llamadas[0].metodo, 'PATCH');
    assert.deepEqual(llamadas[0].cuerpo, { curso: '5° Básico A', profesor: 'Ana' });
});

test('actualizarReserva: exige al menos un campo para actualizar', async () => {
    const r = await enviar({ accion: 'actualizarReserva', clave: CLAVE, datos: { id: 7 } });
    assert.equal(r.statusCode, 400);
});

test('crearSemana: exige fechas y número', async () => {
    const r = await enviar({ accion: 'crearSemana', clave: CLAVE, datos: { numero_semana: 20 } });
    assert.equal(r.statusCode, 400);
});

test('crearSemana: crea la semana con los campos permitidos', async () => {
    const r = await enviar({
        accion: 'crearSemana', clave: CLAVE,
        datos: { fecha_inicio: '2026-07-13', fecha_fin: '2026-07-17', numero_semana: 20, notas: null, extra: 'x' }
    });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(llamadas[0].cuerpo, [{ fecha_inicio: '2026-07-13', fecha_fin: '2026-07-17', numero_semana: 20, notas: null }]);
});

test('actualizarNotas: las notas vacías o de solo espacios se guardan como null', async () => {
    for (const notas of ['', '   ', null, undefined]) {
        llamadas = [];
        const r = await enviar({ accion: 'actualizarNotas', clave: CLAVE, datos: { id: 3, notas } });
        assert.equal(r.statusCode, 200);
        assert.equal(llamadas[0].cuerpo.notas, null);
    }
});

test('actualizarNotas: guarda el texto tal cual', async () => {
    await enviar({ accion: 'actualizarNotas', clave: CLAVE, datos: { id: 3, notas: 'Semana de exámenes' } });
    assert.equal(llamadas[0].cuerpo.notas, 'Semana de exámenes');
});

test('error de bloque duplicado (23505) → 409', async () => {
    supabaseResponde(false, 409, { code: '23505', message: 'duplicate key' });
    const r = await enviar({ accion: 'crearReserva', clave: CLAVE, datos: reservaBase });
    assert.equal(r.statusCode, 409);
});

test('regla de la base de datos (23514) → 400 con el mensaje original', async () => {
    supabaseResponde(false, 400, { code: '23514', message: 'La fecha 2099-01-01 no pertenece a la semana seleccionada' });
    const r = await enviar({ accion: 'crearReserva', clave: CLAVE, datos: reservaBase });
    assert.equal(r.statusCode, 400);
    assert.match(JSON.parse(r.body).error, /no pertenece a la semana/);
});

test('cualquier otro error de Supabase → 500', async () => {
    supabaseResponde(false, 500, { code: 'XX000', message: 'falla interna' });
    const r = await enviar({ accion: 'eliminarReserva', clave: CLAVE, datos: { id: 1 } });
    assert.equal(r.statusCode, 500);
});
