// ============================================================
// Función de Netlify: envío de correos a profesores
//
// Envía por correo el detalle de las reservas de un profesor
// usando la API de Resend (https://resend.com).
//
// Variables de entorno requeridas (configurar en Netlify:
// Site settings → Environment variables):
//   RESEND_API_KEY  - API key de Resend (obligatoria)
//   ADMIN_PASSWORD  - contraseña de administrador (obligatoria);
//                     evita que terceros usen la cuota de correo
//   EMAIL_FROM      - Remitente verificado, ej: "sala@tuescuela.cl"
//                     (opcional; por defecto usa onboarding@resend.dev,
//                     que solo permite enviar al dueño de la cuenta)
// ============================================================

const crypto = require('crypto');

// Comparación en tiempo constante (misma lógica que admin-api.js)
function claveValida(entregada) {
    const esperada = process.env.ADMIN_PASSWORD || '';
    if (!esperada || !entregada) return false;
    const a = crypto.createHash('sha256').update(String(entregada)).digest();
    const b = crypto.createHash('sha256').update(esperada).digest();
    return crypto.timingSafeEqual(a, b);
}

const CABECERAS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respuesta(statusCode, cuerpo) {
    return { statusCode, headers: CABECERAS, body: JSON.stringify(cuerpo) };
}

function escaparHtml(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function construirHtmlCorreo({ profesor, semana, reservas, mensaje }) {
    const filas = reservas.map(r => `
        <tr>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escaparHtml(r.dia)} ${escaparHtml(r.fecha)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">Bloque ${escaparHtml(r.numeroBloque)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${escaparHtml(r.horario)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escaparHtml(r.curso)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;">${escaparHtml(r.actividad) || '—'}</td>
        </tr>
    `).join('');

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">
        <div style="background:#33415c;color:#ffffff;padding:20px 24px;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;font-size:20px;">📚 Sala de Computación</h2>
            <p style="margin:6px 0 0;font-size:14px;opacity:0.85;">
                Reservas de la Semana ${escaparHtml(semana.numero)} · ${escaparHtml(semana.inicio)} al ${escaparHtml(semana.fin)}
            </p>
        </div>

        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px;">
            <p>Estimado/a <strong>${escaparHtml(profesor)}</strong>:</p>
            <p>Le informamos que tiene los siguientes horarios reservados en la sala de computación:</p>

            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Día</th>
                        <th style="padding:8px 10px;border:1px solid #e5e7eb;">Bloque</th>
                        <th style="padding:8px 10px;border:1px solid #e5e7eb;">Horario</th>
                        <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Curso</th>
                        <th style="padding:8px 10px;border:1px solid #e5e7eb;text-align:left;">Actividad</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>

            ${semana.notas ? `
            <div style="background:#fdf3e3;border-left:4px solid #e8a13c;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:14px;">
                <strong>📌 Información de la semana:</strong><br>${escaparHtml(semana.notas)}
            </div>` : ''}

            ${mensaje ? `
            <div style="background:#f1f5f9;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:14px;">
                <strong>Mensaje del administrador:</strong><br>${escaparHtml(mensaje)}
            </div>` : ''}

            <p style="font-size:13px;color:#6b7280;">
                Si necesita modificar o liberar alguna reserva, por favor contacte al administrador de la sala.
            </p>
        </div>

        <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:14px;">
            Correo generado automáticamente por el Sistema de Registro de Sala.
        </p>
    </div>
    `;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return respuesta(200, { ok: true });
    }

    if (event.httpMethod !== 'POST') {
        return respuesta(405, { error: 'Método no permitido. Use POST.' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return respuesta(500, {
            error: 'El envío de correos no está configurado. Falta la variable de entorno RESEND_API_KEY en Netlify.'
        });
    }

    if (!process.env.ADMIN_PASSWORD) {
        return respuesta(500, {
            error: 'Falta la variable de entorno ADMIN_PASSWORD en Netlify (requerida para proteger el envío de correos).'
        });
    }

    let datos;
    try {
        datos = JSON.parse(event.body || '{}');
    } catch (e) {
        return respuesta(400, { error: 'El cuerpo de la solicitud no es JSON válido.' });
    }

    const { clave, para, profesor, semana, reservas, mensaje } = datos;

    if (!claveValida(clave)) {
        return respuesta(401, { error: 'Contraseña de administrador incorrecta.' });
    }

    if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
        return respuesta(400, { error: 'Correo electrónico de destino inválido.' });
    }

    if (!profesor || !semana || !Array.isArray(reservas) || reservas.length === 0) {
        return respuesta(400, { error: 'Faltan datos: profesor, semana o reservas.' });
    }

    if (reservas.length > 50) {
        return respuesta(400, { error: 'Demasiadas reservas en una sola solicitud.' });
    }

    const remitente = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const html = construirHtmlCorreo({ profesor, semana, reservas, mensaje });

    try {
        const resultado = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `Sala de Computación <${remitente}>`,
                to: [para],
                subject: `📚 Sus reservas de la sala de computación - Semana ${semana.numero}`,
                html
            })
        });

        const cuerpoRespuesta = await resultado.json().catch(() => ({}));

        if (!resultado.ok) {
            console.error('Error de Resend:', resultado.status, cuerpoRespuesta);
            return respuesta(resultado.status === 429 ? 429 : 502, {
                error: cuerpoRespuesta.message || 'El servicio de correo rechazó el envío.'
            });
        }

        return respuesta(200, { ok: true, id: cuerpoRespuesta.id });
    } catch (error) {
        console.error('Error enviando correo:', error);
        return respuesta(500, { error: 'Error interno al enviar el correo.' });
    }
};
