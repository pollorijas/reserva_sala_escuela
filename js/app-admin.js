// ============================================================
// Aplicación de administradores
//
// Secciones de este archivo:
//   1. Estado global
//   2. Inicialización
//   3. Carga de datos (bloques, semanas, reservas)
//   4. Panel de información de la semana
//   5. Reservas (registrar, editar, liberar)
//   6. Semanas (crear, corregir fechas)
//   7. Notas de la semana
//   8. Modales y confirmaciones
//
// Las operaciones que modifican datos protegidos (editar/eliminar
// reservas, crear semanas, notas) pasan por llamarAdminAPI()
// definida en js/admin-api.js.
// ============================================================

// ============================================================
// 1. Estado global
// ============================================================
let semanaActual = null;
let listaSemanas = [];
let bloques = [];
let reservas = [];
let reservaSeleccionada = null;

// ============================================================
// 2. Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para administradores...');
    await cargarBloques();
    await cargarSemanas();

    document.getElementById('formNuevaSemana').onsubmit = crearNuevaSemana;
    document.getElementById('formEditarNotas').onsubmit = guardarNotasSemana;
    document.getElementById('btnEliminarNotas').onclick = eliminarNotasSemana;
    document.getElementById('btnLiberar').onclick = liberarBloque;
    document.getElementById('inputFechaInicio').onchange = actualizarNumeroSemanaSugerido;

    // Validar semanas existentes (para corregir fechas si es necesario)
    setTimeout(validarSemanasExistentes, 2000);
});

// ============================================================
// 3. Carga de datos
// ============================================================
async function cargarBloques() {
    const { data, error } = await supabaseDB
        .from('bloques')
        .select('*')
        .order('dia_semana')
        .order('numero_bloque');

    if (error) {
        console.error('Error cargando bloques:', error);
        mostrarError('Error al cargar bloques horarios: ' + error.message);
        return;
    }

    bloques = data;
}

async function cargarSemanas() {
    const { data, error } = await supabaseDB
        .from('semanas')
        .select('*')
        .order('fecha_inicio', { ascending: false });

    if (error) {
        console.error('Error cargando semanas:', error);
        mostrarError('Error al cargar semanas: ' + error.message);
        return;
    }

    listaSemanas = data || [];

    if (listaSemanas.length === 0) {
        inicializarSelectorSemanas([], null, null);
        mostrarAviso('No hay semanas creadas. Use "Nueva Semana" para comenzar.');
        return;
    }

    // Determinar la semana actual basada en la fecha de hoy
    const hoyStr = hoyISO();
    let semanaActualEncontrada = listaSemanas.find(semana =>
        semana.fecha_inicio <= hoyStr && semana.fecha_fin >= hoyStr
    );

    if (!semanaActualEncontrada) {
        semanaActualEncontrada = listaSemanas[0];
    }

    semanaActual = semanaActualEncontrada;

    inicializarSelectorSemanas(listaSemanas, semanaActual.id, async (semana) => {
        semanaActual = semana;
        await cargarReservasSemana(semana.id);
    });

    await cargarReservasSemana(semanaActual.id);
}

async function cargarReservasSemana(semanaId) {
    const { data, error } = await supabaseDB
        .from('reservas')
        .select('*')
        .eq('semana_id', semanaId);

    if (error) {
        console.error('Error cargando reservas:', error);
        mostrarError('Error al cargar reservas: ' + error.message);
        return;
    }

    reservas = data || [];

    renderizarHorario({
        bloques,
        reservas,
        semana: semanaActual,
        onLibre: (bloque, dia, nombreDia) => abrirModalRegistro(bloque, dia, nombreDia),
        onOcupada: (reserva, bloque, dia, nombreDia) => abrirModalEdicion(reserva, bloque, dia, nombreDia)
    });

    actualizarInfoSemana();
}

// ============================================================
// 4. Panel de información de la semana
// ============================================================
function actualizarInfoSemana() {
    const infoContainer = document.getElementById('infoSemana');
    if (!semanaActual) {
        infoContainer.innerHTML = '<p>No hay semana seleccionada</p>';
        return;
    }

    const reservasCount = reservas.length;
    const bloquesTotales = calcularTotalBloquesSemana(bloques);
    const porcentajeOcupacion = bloquesTotales > 0 ? Math.round(reservasCount / bloquesTotales * 100) : 0;
    const bloquesDisponibles = bloquesTotales - reservasCount;

    const ocupacionPorDia = calcularOcupacionPorDia(bloques, reservas, semanaActual);

    // Última reserva registrada de la semana
    let ultimaReservaTexto = 'N/A';
    if (reservas.length > 0) {
        let fechaMax = null;
        reservas.forEach(reserva => {
            const fechaReserva = new Date(reserva.fecha + 'T12:00:00-03:00');
            if (!isNaN(fechaReserva.getTime()) && (!fechaMax || fechaReserva > fechaMax)) {
                fechaMax = fechaReserva;
            }
        });
        if (fechaMax) ultimaReservaTexto = formatearFechaCorta(fechaMax);
    }

    infoContainer.classList.add('admin');
    infoContainer.innerHTML = `
        <div class="info-semana-header">
            <div class="info-semana-titulo">
                <h3>📅 Semana ${semanaActual.numero_semana}</h3>
                <p>${formatearFecha(semanaActual.fecha_inicio)} - ${formatearFecha(semanaActual.fecha_fin)}</p>
            </div>

            <div class="info-semana-estadisticas">
                <div class="estadistica-principal">
                    <span class="porcentaje-ocupacion">${porcentajeOcupacion}%</span>
                    <span class="texto-estadistica">ocupación</span>
                </div>
                <div class="detalles-estadistica">
                    <div class="detalle-item">
                        <strong>${reservasCount}</strong>
                        <div>ocupados</div>
                    </div>
                    <div class="detalle-item">
                        <strong>${bloquesDisponibles}</strong>
                        <div>libres</div>
                    </div>
                </div>
            </div>

            <button onclick="abrirModalEditarNotas()" class="btn-editar-notas">
                ✏️ Editar Notas
            </button>
        </div>

        <div class="info-semana-detalles">
            <div class="detalle-card">
                <span class="icono">📋</span>
                <span class="valor">${bloquesTotales}</span>
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
                <span class="valor">${ultimaReservaTexto}</span>
                <span class="etiqueta">Última reserva</span>
            </div>
        </div>

        <div class="notas-semana-container ${!semanaActual.notas ? 'sin-notas' : ''}">
            <div class="notas-semana-titulo">
                <span class="icono">📌</span>
                <span>Información importante</span>
            </div>
            <div class="notas-semana-contenido" id="notasSemanaContenido"></div>
        </div>

        <div class="zona-horaria-info">
            📍 Chile - ${formatearFechaCorta(new Date())}
        </div>
    `;

    // Las notas se asignan como texto (no como HTML) para que ningún
    // carácter como "<" se interprete como una etiqueta
    document.getElementById('notasSemanaContenido').textContent = semanaActual.notas ||
        'No hay notas específicas. Click en "Editar Notas" para agregar información importante.';
}

// ============================================================
// 5. Reservas (registrar, editar, liberar)
// ============================================================

// Registrar nueva reserva (bloque libre)
function abrirModalRegistro(bloque, dia, nombreDia) {
    if (!semanaActual) return;

    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);

    document.getElementById('bloqueSeleccionado').value = bloque.id;
    document.getElementById('fechaSeleccionada').value = fecha;
    document.getElementById('reservaId').value = '';

    document.getElementById('tituloModalRegistro').textContent =
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;

    document.getElementById('btnLiberar').style.display = 'none';
    document.getElementById('formRegistro').reset();

    // El administrador ve también las opciones de uso administrativo
    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso, '', true);

    document.getElementById('modalRegistro').style.display = 'block';
}

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
// La creación usa la inserción pública (igual que los profesores);
// la edición requiere la sesión de administrador (admin-api).
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();

    const reservaId = document.getElementById('reservaId').value;
    const reservaData = {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };

    try {
        if (reservaId) {
            await llamarAdminAPI('actualizarReserva', { id: parseInt(reservaId), ...reservaData });
        } else {
            const { error } = await supabaseDB
                .from('reservas')
                .insert([reservaData]);
            if (error) {
                throw new Error(error.code === '23505'
                    ? 'Ese bloque ya tiene una reserva en esa fecha.'
                    : error.message);
            }
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
// 6. Semanas (crear, corregir fechas)
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
// 7. Notas de la semana
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
// 8. Modales y confirmaciones
// ============================================================
function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
    reservaSeleccionada = null;
}

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
