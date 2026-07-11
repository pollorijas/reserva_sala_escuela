// ============================================================
// Función de Netlify: operaciones de administrador
//
// Ejecuta las acciones que la clave pública de Supabase ya no
// puede realizar (con Row Level Security activo): editar y
// eliminar reservas, crear semanas y editar notas.
//
// Cada solicitud debe incluir la contraseña de administrador,
// que se compara contra la variable de entorno ADMIN_PASSWORD.
// Las escrituras usan la clave service_role de Supabase, que
// nunca sale del servidor.
//
// Variables de entorno requeridas (Netlify: Site settings →
// Environment variables):
//   ADMIN_PASSWORD             - contraseña del administrador
//   SUPABASE_SERVICE_ROLE_KEY  - clave service_role del proyecto
//                                (Supabase: Settings → API keys)
//   SUPABASE_URL               - opcional, URL del proyecto
// ============================================================

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iuspypmzrwzlqolbkjhl.supabase.co';

const CABECERAS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respuesta(statusCode, cuerpo) {
    return { statusCode, headers: CABECERAS, body: JSON.stringify(cuerpo) };
}

// Comparación en tiempo constante para no filtrar información
// sobre la contraseña mediante los tiempos de respuesta
function claveValida(entregada) {
    const esperada = process.env.ADMIN_PASSWORD || '';
    if (!esperada || !entregada) return false;
    const a = crypto.createHash('sha256').update(String(entregada)).digest();
    const b = crypto.createHash('sha256').update(esperada).digest();
    return crypto.timingSafeEqual(a, b);
}

// Llamada a la API REST de Supabase con la clave service_role
async function supabaseAdmin(metodo, ruta, cuerpo) {
    const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const opciones = {
        method: metodo,
        headers: {
            'apikey': llave,
            'Authorization': `Bearer ${llave}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, opciones);
    const datos = await resp.json().catch(() => null);

    if (!resp.ok) {
        const mensaje = (datos && (datos.message || datos.details)) || `Error de Supabase (${resp.status})`;
        const error = new Error(mensaje);
        error.codigo = datos && datos.code;
        throw error;
    }

    return datos;
}

// Deja solo los campos permitidos, descartando cualquier otro
function filtrarCampos(objeto, permitidos) {
    const limpio = {};
    permitidos.forEach(campo => {
        if (objeto && Object.prototype.hasOwnProperty.call(objeto, campo)) {
            limpio[campo] = objeto[campo];
        }
    });
    return limpio;
}

function idValido(valor) {
    if (typeof valor === 'number' && Number.isInteger(valor) && valor > 0) return valor;
    if (typeof valor === 'string' && /^\d+$/.test(valor)) return parseInt(valor, 10);
    return null;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return respuesta(200, { ok: true });
    }

    if (event.httpMethod !== 'POST') {
        return respuesta(405, { error: 'Método no permitido. Use POST.' });
    }

    if (!process.env.ADMIN_PASSWORD) {
        return respuesta(500, {
            error: 'El acceso de administrador no está configurado. Falta la variable de entorno ADMIN_PASSWORD en Netlify.'
        });
    }

    let solicitud;
    try {
        solicitud = JSON.parse(event.body || '{}');
    } catch (e) {
        return respuesta(400, { error: 'El cuerpo de la solicitud no es JSON válido.' });
    }

    const { accion, clave, datos = {} } = solicitud;

    if (!claveValida(clave)) {
        return respuesta(401, { error: 'Contraseña de administrador incorrecta.' });
    }

    // Verificación de contraseña sin ejecutar ninguna acción
    if (accion === 'verificar') {
        return respuesta(200, { ok: true });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return respuesta(500, {
            error: 'Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Netlify.'
        });
    }

    try {
        switch (accion) {
            case 'crearSemana': {
                const semana = filtrarCampos(datos, ['fecha_inicio', 'fecha_fin', 'numero_semana', 'notas']);
                if (!semana.fecha_inicio || !semana.fecha_fin || !semana.numero_semana) {
                    return respuesta(400, { error: 'Faltan datos de la semana.' });
                }
                const creada = await supabaseAdmin('POST', 'semanas', [semana]);
                return respuesta(200, { ok: true, semana: creada && creada[0] });
            }

            case 'actualizarSemana': {
                const id = idValido(datos.id);
                if (!id) return respuesta(400, { error: 'Identificador de semana inválido.' });
                const campos = filtrarCampos(datos, ['fecha_inicio', 'fecha_fin', 'numero_semana']);
                if (Object.keys(campos).length === 0) {
                    return respuesta(400, { error: 'No hay campos para actualizar.' });
                }
                await supabaseAdmin('PATCH', `semanas?id=eq.${id}`, campos);
                return respuesta(200, { ok: true });
            }

            case 'actualizarNotas': {
                const id = idValido(datos.id);
                if (!id) return respuesta(400, { error: 'Identificador de semana inválido.' });
                const notas = datos.notas === undefined || datos.notas === null || String(datos.notas).trim() === ''
                    ? null
                    : String(datos.notas);
                await supabaseAdmin('PATCH', `semanas?id=eq.${id}`, { notas });
                return respuesta(200, { ok: true });
            }

            case 'actualizarReserva': {
                const id = idValido(datos.id);
                if (!id) return respuesta(400, { error: 'Identificador de reserva inválido.' });
                const campos = filtrarCampos(datos, [
                    'semana_id', 'bloque_id', 'curso', 'profesor', 'actividad', 'observaciones', 'fecha'
                ]);
                if (Object.keys(campos).length === 0) {
                    return respuesta(400, { error: 'No hay campos para actualizar.' });
                }
                await supabaseAdmin('PATCH', `reservas?id=eq.${id}`, campos);
                return respuesta(200, { ok: true });
            }

            case 'eliminarReserva': {
                const id = idValido(datos.id);
                if (!id) return respuesta(400, { error: 'Identificador de reserva inválido.' });
                await supabaseAdmin('DELETE', `reservas?id=eq.${id}`);
                return respuesta(200, { ok: true });
            }

            default:
                return respuesta(400, { error: `Acción desconocida: ${accion}` });
        }
    } catch (error) {
        console.error(`Error ejecutando acción "${accion}":`, error);
        if (error.codigo === '23505') {
            return respuesta(409, { error: 'Ese bloque ya tiene una reserva en esa fecha.' });
        }
        return respuesta(500, { error: error.message || 'Error interno del servidor.' });
    }
};
