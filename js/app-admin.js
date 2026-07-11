// Variables globales para administradores
let semanaActual = null;
let bloques = [];
let reservas = [];
let reservaSeleccionada = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para administradores...');
    await cargarBloques();
    await cargarSemanas();

    document.getElementById('formNuevaSemana').onsubmit = crearNuevaSemana;
    document.getElementById('formEditarNotas').onsubmit = guardarNotasSemana;
    document.getElementById('btnEliminarNotas').onclick = eliminarNotasSemana;
    document.getElementById('btnLiberar').onclick = liberarBloque;

    // Validar semanas existentes (para corregir fechas si es necesario)
    setTimeout(validarSemanasExistentes, 2000);
});

// Cargar bloques horarios
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

// Cargar semanas y construir el selector deslizable
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

    if (!data || data.length === 0) {
        inicializarSelectorSemanas([], null, null);
        mostrarAviso('No hay semanas creadas. Use "Nueva Semana" para comenzar.');
        return;
    }

    // Determinar la semana actual basada en la fecha de hoy
    const hoyStr = hoyISO();
    let semanaActualEncontrada = data.find(semana =>
        semana.fecha_inicio <= hoyStr && semana.fecha_fin >= hoyStr
    );

    if (!semanaActualEncontrada) {
        semanaActualEncontrada = data[0];
    }

    semanaActual = semanaActualEncontrada;

    inicializarSelectorSemanas(data, semanaActual.id, async (semana) => {
        semanaActual = semana;
        await cargarReservasSemana(semana.id);
    });

    await cargarReservasSemana(semanaActual.id);
}

// Cargar reservas de una semana
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

// Información de la semana
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
            <div class="notas-semana-contenido">
                ${semanaActual.notas ? semanaActual.notas : 'No hay notas específicas. Click en "Editar Notas" para agregar información importante.'}
            </div>
        </div>

        <div class="zona-horaria-info">
            📍 Chile - ${formatearFechaCorta(new Date())}
        </div>
    `;
}

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

    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso);

    document.getElementById('modalRegistro').style.display = 'block';
}

// Editar reserva existente
function abrirModalEdicion(reserva, bloque, dia, nombreDia) {
    if (!semanaActual) return;

    document.getElementById('bloqueSeleccionado').value = bloque.id;
    document.getElementById('fechaSeleccionada').value = reserva.fecha;
    document.getElementById('reservaId').value = reserva.id;

    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso, reserva.curso);

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

    let error;

    if (reservaId) {
        ({ error } = await supabaseDB
            .from('reservas')
            .update(reservaData)
            .eq('id', reservaId));
    } else {
        ({ error } = await supabaseDB
            .from('reservas')
            .insert([reservaData]));
    }

    if (error) {
        console.error('Error guardando reserva:', error);
        mostrarError('Error al guardar: ' + error.message);
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        mostrarExito(reservaId ? 'Reserva actualizada exitosamente' : 'Registro guardado exitosamente');
    }
};

// Liberar bloque
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
            const { error } = await supabaseDB
                .from('reservas')
                .delete()
                .eq('id', reservaId);

            cerrarModalConfirmacion();

            if (error) {
                console.error('Error eliminando reserva:', error);
                mostrarError('Error al liberar bloque: ' + error.message);
            } else {
                cerrarModal();
                await cargarReservasSemana(semanaActual.id);
                mostrarExito('Bloque liberado exitosamente');
            }
        }
    );
}

// Modal para nueva semana
function abrirModalNuevaSemana() {
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

    // Calcular número de semana automáticamente (según ISO)
    const primerDiaAno = new Date(proximoLunes.getFullYear(), 0, 1);
    const diferenciaTiempo = proximoLunes - primerDiaAno;
    const diferenciaDias = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
    const numeroSemana = Math.ceil((diferenciaDias + primerDiaAno.getDay() + 1) / 7);

    document.getElementById('inputNumeroSemana').value = numeroSemana;

    document.getElementById('modalNuevaSemana').style.display = 'block';
}

// Crear nueva semana
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

    const { error } = await supabaseDB
        .from('semanas')
        .insert([nuevaSemana]);

    if (error) {
        console.error('Error creando semana:', error);
        mostrarError('Error creando semana: ' + error.message);
    } else {
        cerrarModalNuevaSemana();
        await cargarSemanas();
        mostrarExito('Semana creada exitosamente');
    }
}

// Abrir modal para editar notas
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

// Guardar notas de la semana
async function guardarNotasSemana(e) {
    e.preventDefault();

    const semanaId = document.getElementById('semanaIdEditar').value;
    const nuevasNotas = document.getElementById('inputNotasEditar').value.trim();

    const { error } = await supabaseDB
        .from('semanas')
        .update({ notas: nuevasNotas || null })
        .eq('id', semanaId);

    if (error) {
        console.error('Error actualizando notas:', error);
        mostrarError('Error al actualizar notas: ' + error.message);
    } else {
        cerrarModalEditarNotas();
        semanaActual.notas = nuevasNotas || null;
        await cargarReservasSemana(semanaActual.id);
        mostrarExito('Notas actualizadas exitosamente');
    }
}

// Eliminar notas de la semana
async function eliminarNotasSemana() {
    const semanaId = document.getElementById('semanaIdEditar').value;

    abrirModalConfirmacion(
        'Eliminar Notas',
        '¿Estás seguro de que deseas eliminar todas las notas de esta semana?',
        async () => {
            const { error } = await supabaseDB
                .from('semanas')
                .update({ notas: null })
                .eq('id', semanaId);

            cerrarModalConfirmacion();

            if (error) {
                console.error('Error eliminando notas:', error);
                mostrarError('Error al eliminar notas: ' + error.message);
            } else {
                cerrarModalEditarNotas();
                semanaActual.notas = null;
                await cargarReservasSemana(semanaActual.id);
                mostrarExito('Notas eliminadas exitosamente');
            }
        }
    );
}

// Validar que las semanas existentes empiecen en lunes
async function validarSemanasExistentes() {
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

            const { error: updateError } = await supabaseDB
                .from('semanas')
                .update({
                    fecha_inicio: fechaInicioCorregida,
                    fecha_fin: fechaFinCorregida
                })
                .eq('id', semana.id);

            if (!updateError) semanasCorregidas++;
        }
    }

    if (semanasCorregidas > 0) {
        console.log(`${semanasCorregidas} semanas corregidas`);
        await cargarSemanas();
    }
}

// Funciones para cerrar modales
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

// Sistema de confirmación
function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('tituloConfirmacion').textContent = titulo;
    document.getElementById('mensajeConfirmacion').textContent = mensaje;

    const btnConfirmar = document.getElementById('btnConfirmarSi');
    btnConfirmar.onclick = callback;

    document.getElementById('modalConfirmacion').style.display = 'block';
}

// Cerrar modales al hacer click fuera
window.onclick = function(event) {
    const modals = {
        modalRegistro: cerrarModal,
        modalNuevaSemana: cerrarModalNuevaSemana,
        modalConfirmacion: cerrarModalConfirmacion,
        modalEditarNotas: cerrarModalEditarNotas,
        modalCorreo: () => typeof cerrarModalCorreo === 'function' && cerrarModalCorreo(),
        modalInforme: () => typeof cerrarModalInforme === 'function' && cerrarModalInforme()
    };

    Object.entries(modals).forEach(([modalId, cerrar]) => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) cerrar();
    });
};
