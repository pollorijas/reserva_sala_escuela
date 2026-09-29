// ============================================================
// Aplicación de administradores
//
// La carga de datos, el selector de semanas y el formulario de reserva
// se comparten con la página de profesores (js/app-comun.js). Aquí solo
// está lo propio del administrador.
//
// Secciones de este archivo:
//   1. Registro de la página
//   2. Inicialización
//   3. Panel de información de la semana
//   4. Reservas (editar, guardar, liberar)
//   5. Semanas (crear, corregir fechas)
//   6. Notas de la semana
//   7. Modales y confirmaciones
//
// Las operaciones que modifican datos protegidos (crear, editar y
// eliminar reservas, crear semanas, notas) pasan por llamarAdminAPI()
// definida en js/admin-api.js.
// ============================================================

// ============================================================
// 1. Registro de la página
// ============================================================
registrarApp({
    onLibre: abrirModalRegistro,
    onOcupada: abrirModalEdicion,
    actualizarInfoSemana,
    mensajeSinSemanas: 'No hay semanas creadas. Use "Nueva Semana" para comenzar.',
    cursosAdministrativos: true // también ve Mantención, UTP, Senda Previene, Feriado y Vacaciones
});

// ============================================================
// 2. Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para administradores...');
    await iniciarApp();

    document.getElementById('formNuevaSemana').onsubmit = crearNuevaSemana;
    document.getElementById('formEditarNotas').onsubmit = guardarNotasSemana;
    document.getElementById('btnEliminarNotas').onclick = eliminarNotasSemana;
    document.getElementById('btnLiberar').onclick = liberarBloque;
    document.getElementById('inputFechaInicio').onchange = actualizarNumeroSemanaSugerido;

    // Validar semanas existentes (para corregir fechas si es necesario)
    setTimeout(validarSemanasExistentes, 2000);
});

// ============================================================
// 3. Panel de información de la semana
// ============================================================

// Fecha de la última reserva registrada en la semana, o 'N/A' si no hay
function textoUltimaReserva() {
    let fechaMax = null;

    reservas.forEach(reserva => {
        const fechaReserva = new Date(reserva.fecha + 'T12:00:00-03:00');
        if (!isNaN(fechaReserva.getTime()) && (!fechaMax || fechaReserva > fechaMax)) {
            fechaMax = fechaReserva;
        }
    });

    return fechaMax ? formatearFechaCorta(fechaMax) : 'N/A';
}

function actualizarInfoSemana() {
    const panel = prepararPanelSemana();
    if (!panel) return;

    const estadisticas = calcularEstadisticasSemana();
    const ocupacionPorDia = calcularOcupacionPorDia(bloques, reservas, semanaActual);

    const botonEditarNotas = `
            <button onclick="abrirModalEditarNotas()" class="btn-editar-notas">
                ✏️ Editar Notas
            </button>`;

    const tarjetasDetalle = `
        <div class="info-semana-detalles">
            <div class="detalle-card">
                <span class="icono">📋</span>
                <span class="valor">${estadisticas.total}</span>
                <span class="etiqueta">Total bloques</span>
            </div>
            <div class="detalle-card">
                <span class="icono">📊</span>
                <span class="valor">${ocupacionPorDia.maxOcupacion.dia}</span>
                <span class="etiqueta">Día más ocupado</span>
            </div>
            <div class="detalle-card">
                <span class="icono">📈</span>
                <span class="valor">${ocupacionPorDia.maxOcupacion.porcentaje}%</span>
                <span class="etiqueta">Máx. ocupación</span>
            </div>
            <div class="detalle-card">
                <span class="icono">🔄</span>
                <span class="valor">${textoUltimaReserva()}</span>
                <span class="etiqueta">Última reserva</span>
            </div>
        </div>
    `;

    panel.classList.add('admin');
    panel.innerHTML =
        htmlEncabezadoSemana(estadisticas, botonEditarNotas) +
        tarjetasDetalle +
        htmlNotasSemana() +
        htmlZonaHoraria();

    mostrarNotasSemana('No hay notas específicas. Click en "Editar Notas" para agregar información importante.');
}

// ============================================================
// 4. Reservas (editar, guardar, liberar)
//    Registrar en un bloque libre (abrirModalRegistro) está en app-comun.js
// ============================================================

// Editar reserva existente
function abrirModalEdicion(reserva, bloque, dia, nombreDia) {
    if (!semanaActual) return;

    document.getElementById('bloqueSeleccionado').value = bloque.id;
    document.getElementById('fechaSeleccionada').value = reserva.fecha;
    document.getElementById('reservaId').value = reserva.id;

    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso, reserva.curso, true);

    document.getElementById('inputProfesor').value = reserva.profesor;
    document.getElementById('inputActividad').value = reserva.actividad || '';
    document.getElementById('inputObservaciones').value = reserva.observaciones || '';

    document.getElementById('tituloModalRegistro').textContent =
        `Editar Reserva - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;

    document.getElementById('btnLiberar').style.display = 'inline-block';

    reservaSeleccionada = reserva;
    document.getElementById('modalRegistro').style.display = 'block';
}

// Guardar reserva (nueva o edición)
// Ambas pasan por admin-api: la inserción pública de la base de datos
// solo acepta cursos de 1° a 8°, y el administrador también puede crear
// reservas de uso administrativo (Mantención, UTP, Feriado, etc.).
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();

    const reservaId = document.getElementById('reservaId').value;
    const reservaData = leerDatosFormularioReserva();

    try {
        if (reservaId) {
            await llamarAdminAPI('actualizarReserva', { id: parseInt(reservaId), ...reservaData });
        } else {
            await llamarAdminAPI('crearReserva', reservaData);
        }

        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        mostrarExito(reservaId ? 'Reserva actualizada exitosamente' : 'Registro guardado exitosamente');
    } catch (error) {
        console.error('Error guardando reserva:', error);
        mostrarError('Error al guardar: ' + error.message);
    }
};

// Liberar bloque (eliminar reserva)
async function liberarBloque() {
    const reservaId = document.getElementById('reservaId').value;

    if (!reservaId) {
        mostrarError('No hay reserva seleccionada para liberar');
        return;
    }

    abrirModalConfirmacion(
        'Liberar Bloque',
        '¿Estás seguro de que deseas liberar este bloque? Esta acción no se puede deshacer.',
        async () => {
            cerrarModalConfirmacion();

            try {
                await llamarAdminAPI('eliminarReserva', { id: parseInt(reservaId) });
                cerrarModal();
                await cargarReservasSemana(semanaActual.id);
                mostrarExito('Bloque liberado exitosamente');
            } catch (error) {
                console.error('Error eliminando reserva:', error);
                mostrarError('Error al liberar bloque: ' + error.message);
            }
        }
    );
}

// ============================================================
// 5. Semanas (crear, corregir fechas)
// ============================================================

// Número sugerido para una nueva semana: continúa la numeración de
// las semanas ya creadas en el mismo año (no la semana ISO del
// calendario). Si es la primera semana del año, parte en 1.
function calcularNumeroSemanaSugerido(fechaLunes) {
    const anio = String(fechaLunes).substring(0, 4);
    const semanasDelAnio = listaSemanas.filter(s => String(s.fecha_inicio).startsWith(anio));

    if (semanasDelAnio.length === 0) return 1;

    const maximo = Math.max(...semanasDelAnio.map(s => parseInt(s.numero_semana, 10) || 0));
    return maximo + 1;
}

// Recalcular el número sugerido cuando el administrador cambia la fecha
function actualizarNumeroSemanaSugerido() {
    const fechaInput = document.getElementById('inputFechaInicio').value;
    if (!fechaInput) return;

    const lunes = obtenerLunesSemana(fechaInput);
    document.getElementById('inputNumeroSemana').value = calcularNumeroSemanaSugerido(lunes);
}

function abrirModalNuevaSemana() {
    // Encontrar el próximo lunes
    const hoy = new Date();
    const diasHastaLunes = (1 - hoy.getDay() + 7) % 7;
    const proximoLunes = new Date(hoy);
    proximoLunes.setDate(hoy.getDate() + (diasHastaLunes === 0 ? 7 : diasHastaLunes));

    const year = proximoLunes.getFullYear();
    const month = String(proximoLunes.getMonth() + 1).padStart(2, '0');
    const day = String(proximoLunes.getDate()).padStart(2, '0');
    const fechaProximoLunes = `${year}-${month}-${day}`;

    document.getElementById('inputFechaInicio').value = fechaProximoLunes;
    document.getElementById('inputFechaInicio').min = fechaProximoLunes;
    document.getElementById('inputNumeroSemana').value = calcularNumeroSemanaSugerido(fechaProximoLunes);

    document.getElementById('modalNuevaSemana').style.display = 'block';
}

async function crearNuevaSemana(e) {
    e.preventDefault();

    const fechaInicioInput = document.getElementById('inputFechaInicio').value;
    const numeroSemana = parseInt(document.getElementById('inputNumeroSemana').value);
    const notas = document.getElementById('inputNotas').value.trim();

    if (!fechaInicioInput || !numeroSemana) {
        mostrarError('Por favor completa todos los campos requeridos');
        return;
    }

    const fechaInicio = obtenerLunesSemana(fechaInicioInput);
    const fechaFin = obtenerViernesSemana(fechaInicio);

    const nuevaSemana = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        numero_semana: numeroSemana,
        notas: notas || null
    };

    try {
        await llamarAdminAPI('crearSemana', nuevaSemana);
        cerrarModalNuevaSemana();
        await cargarSemanas();
        mostrarExito('Semana creada exitosamente');
    } catch (error) {
        console.error('Error creando semana:', error);
        mostrarError('Error creando semana: ' + error.message);
    }
}

// Validar que las semanas existentes empiecen en lunes.
// Requiere sesión de administrador; si aún no se ha ingresado la
// contraseña, simplemente se omite (se reintenta al recargar).
async function validarSemanasExistentes() {
    if (!obtenerClaveAdmin()) return;

    const { data: semanas, error } = await supabaseDB
        .from('semanas')
        .select('*');

    if (error) {
        console.error('Error validando semanas:', error);
        return;
    }

    let semanasCorregidas = 0;

    for (const semana of semanas) {
        const fechaInicio = new Date(semana.fecha_inicio + 'T12:00:00-03:00');
        const diaSemanaInicio = fechaInicio.getDay();

        if (diaSemanaInicio !== 1) {
            const fechaInicioCorregida = obtenerLunesSemana(semana.fecha_inicio);
            const fechaFinCorregida = obtenerViernesSemana(fechaInicioCorregida);

            try {
                await llamarAdminAPI('actualizarSemana', {
                    id: semana.id,
                    fecha_inicio: fechaInicioCorregida,
                    fecha_fin: fechaFinCorregida
                });
                semanasCorregidas++;
            } catch (updateError) {
                console.error('Error corrigiendo semana:', updateError);
            }
        }
    }

    if (semanasCorregidas > 0) {
        console.log(`${semanasCorregidas} semanas corregidas`);
        await cargarSemanas();
    }
}

// ============================================================
// 6. Notas de la semana
// ============================================================
function abrirModalEditarNotas() {
    if (!semanaActual) {
        mostrarError('Primero seleccione una semana');
        return;
    }

    document.getElementById('semanaIdEditar').value = semanaActual.id;
    document.getElementById('infoSemanaTitulo').textContent = `Semana ${semanaActual.numero_semana}`;
    document.getElementById('infoSemanaFechas').textContent =
        `${formatearFechaCorta(semanaActual.fecha_inicio)} - ${formatearFechaCorta(semanaActual.fecha_fin)}`;

    document.getElementById('inputNotasEditar').value = semanaActual.notas || '';

    const btnEliminar = document.getElementById('btnEliminarNotas');
    btnEliminar.style.display = semanaActual.notas ? 'inline-block' : 'none';

    document.getElementById('modalEditarNotas').style.display = 'block';
}

async function guardarNotasSemana(e) {
    e.preventDefault();

    const semanaId = document.getElementById('semanaIdEditar').value;
    const nuevasNotas = document.getElementById('inputNotasEditar').value.trim();

    try {
        await llamarAdminAPI('actualizarNotas', { id: parseInt(semanaId), notas: nuevasNotas || null });
        cerrarModalEditarNotas();
        semanaActual.notas = nuevasNotas || null;
        await cargarReservasSemana(semanaActual.id);
        mostrarExito('Notas actualizadas exitosamente');
    } catch (error) {
        console.error('Error actualizando notas:', error);
        mostrarError('Error al actualizar notas: ' + error.message);
    }
}

async function eliminarNotasSemana() {
    const semanaId = document.getElementById('semanaIdEditar').value;

    abrirModalConfirmacion(
        'Eliminar Notas',
        '¿Estás seguro de que deseas eliminar todas las notas de esta semana?',
        async () => {
            cerrarModalConfirmacion();

            try {
                await llamarAdminAPI('actualizarNotas', { id: parseInt(semanaId), notas: null });
                cerrarModalEditarNotas();
                semanaActual.notas = null;
                await cargarReservasSemana(semanaActual.id);
                mostrarExito('Notas eliminadas exitosamente');
            } catch (error) {
                console.error('Error eliminando notas:', error);
                mostrarError('Error al eliminar notas: ' + error.message);
            }
        }
    );
}

// ============================================================
// 7. Modales y confirmaciones
//    (cerrarModal, el de la reserva, está en app-comun.js)
// ============================================================
function cerrarModalNuevaSemana() {
    document.getElementById('modalNuevaSemana').style.display = 'none';
    document.getElementById('formNuevaSemana').reset();
}

function cerrarModalEditarNotas() {
    document.getElementById('modalEditarNotas').style.display = 'none';
    document.getElementById('formEditarNotas').reset();
}

function cerrarModalConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('tituloConfirmacion').textContent = titulo;
    document.getElementById('mensajeConfirmacion').textContent = mensaje;

    const btnConfirmar = document.getElementById('btnConfirmarSi');
    btnConfirmar.onclick = callback;

    document.getElementById('modalConfirmacion').style.display = 'block';
}

// Click fuera de un modal: SOLO cierra el informe (es de solo
// lectura). Los modales con formularios se cierran únicamente con
// sus botones, para no perder lo escrito por un click accidental.
window.onclick = function(event) {
    const modalInforme = document.getElementById('modalInforme');
    if (modalInforme && event.target === modalInforme && typeof cerrarModalInforme === 'function') {
        cerrarModalInforme();
    }
};
