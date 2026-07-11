// ============================================================
// Notificación por correo a profesores
// Usa la función de Netlify /.netlify/functions/enviar-correo
// Requiere las variables globales de app-admin.js:
// semanaActual, reservas, bloques
// ============================================================

function abrirModalCorreo() {
    if (!semanaActual) {
        mostrarError('Primero seleccione una semana');
        return;
    }

    if (!reservas || reservas.length === 0) {
        mostrarAviso('La semana seleccionada no tiene reservas registradas');
        return;
    }

    // Profesores únicos con reservas en la semana
    const profesores = [...new Set(reservas.map(r => r.profesor).filter(Boolean))].sort();

    const select = document.getElementById('selectProfesorCorreo');
    select.innerHTML = '<option value="">Seleccione un profesor</option>';
    profesores.forEach(profesor => {
        const option = document.createElement('option');
        option.value = profesor;
        option.textContent = profesor;
        select.appendChild(option);
    });

    select.onchange = actualizarResumenCorreo;

    document.getElementById('formCorreo').reset();
    document.getElementById('resumenCorreo').textContent =
        'Seleccione un profesor para ver el resumen de sus reservas.';

    document.getElementById('modalCorreo').style.display = 'block';
}

function cerrarModalCorreo() {
    document.getElementById('modalCorreo').style.display = 'none';
    document.getElementById('formCorreo').reset();
}

// Reservas de un profesor en la semana actual, con datos del bloque
function obtenerReservasProfesor(profesor) {
    return reservas
        .filter(r => r.profesor === profesor)
        .map(r => {
            const bloque = bloques.find(b => b.id === r.bloque_id);
            const fecha = new Date(r.fecha + 'T12:00:00-03:00');
            const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];

            return {
                fecha: r.fecha,
                dia: nombreDia,
                numeroBloque: bloque ? bloque.numero_bloque : '?',
                horario: bloque ? `${bloque.hora_inicio} - ${bloque.hora_fin}` : 'Horario no disponible',
                curso: r.curso,
                actividad: r.actividad || '',
                observaciones: r.observaciones || ''
            };
        })
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numeroBloque - b.numeroBloque);
}

function actualizarResumenCorreo() {
    const profesor = document.getElementById('selectProfesorCorreo').value;
    const resumen = document.getElementById('resumenCorreo');

    if (!profesor) {
        resumen.textContent = 'Seleccione un profesor para ver el resumen de sus reservas.';
        return;
    }

    const reservasProfesor = obtenerReservasProfesor(profesor);

    const items = reservasProfesor.map(r =>
        `<li><strong>${r.dia} ${formatearFechaCorta(r.fecha)}</strong> · Bloque ${r.numeroBloque} (${r.horario}) · ${r.curso}${r.actividad ? ' · ' + r.actividad : ''}</li>`
    ).join('');

    resumen.innerHTML = `
        <strong>Se enviarán ${reservasProfesor.length} reserva(s) de la Semana ${semanaActual.numero_semana}:</strong>
        <ul>${items}</ul>
    `;
}

// Envío del formulario
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('formCorreo');
    if (!form) return;

    form.onsubmit = async function(e) {
        e.preventDefault();

        const profesor = document.getElementById('selectProfesorCorreo').value;
        const correo = document.getElementById('inputCorreoProfesor').value.trim();
        const mensaje = document.getElementById('inputMensajeCorreo').value.trim();

        if (!profesor || !correo) {
            mostrarError('Seleccione un profesor e ingrese su correo electrónico');
            return;
        }

        const reservasProfesor = obtenerReservasProfesor(profesor);

        if (reservasProfesor.length === 0) {
            mostrarError('El profesor seleccionado no tiene reservas en esta semana');
            return;
        }

        if (!obtenerClaveAdmin()) {
            mostrarLoginAdmin('Debe iniciar sesión como administrador para enviar correos.');
            return;
        }

        const btnEnviar = document.getElementById('btnEnviarCorreo');
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviando...';

        try {
            const respuesta = await fetch('/.netlify/functions/enviar-correo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clave: obtenerClaveAdmin(),
                    para: correo,
                    profesor: profesor,
                    mensaje: mensaje,
                    semana: {
                        numero: semanaActual.numero_semana,
                        inicio: formatearFechaCorta(semanaActual.fecha_inicio),
                        fin: formatearFechaCorta(semanaActual.fecha_fin),
                        notas: semanaActual.notas || ''
                    },
                    reservas: reservasProfesor
                })
            });

            const resultado = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
                throw new Error(resultado.error || `Error del servidor (${respuesta.status})`);
            }

            cerrarModalCorreo();
            mostrarExito(`Correo enviado a ${profesor} (${correo})`);
        } catch (error) {
            console.error('Error enviando correo:', error);
            mostrarError('No se pudo enviar el correo: ' + error.message);
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar Correo';
        }
    };
});
