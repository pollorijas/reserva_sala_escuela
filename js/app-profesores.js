// ============================================================
// Aplicación de profesores
//
// Secciones de este archivo:
//   1. Estado global
//   2. Inicialización
//   3. Carga de datos (bloques, semanas, reservas)
//   4. Panel de información de la semana
//   5. Reservas (registrar en bloques libres, ver ocupados)
//   6. Modales
//
// Los profesores no inician sesión: solo pueden leer datos y
// crear reservas (permisos definidos por RLS en Supabase).
// ============================================================

// ============================================================
// 1. Estado global
// ============================================================
let semanaActual = null;
let bloques = [];
let reservas = [];

// ============================================================
// 2. Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para profesores...');
    await cargarBloques();
    await cargarSemanas();
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
        mostrarAviso('No hay semanas configuradas. Contacte al administrador.');
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
        onOcupada: (reserva, bloque, dia, nombreDia) => mostrarInformacionReserva(reserva, bloque, dia, nombreDia)
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
        </div>

        <div class="notas-semana-container ${!semanaActual.notas ? 'sin-notas' : ''}">
            <div class="notas-semana-titulo">
                <span class="icono">📌</span>
                <span>Información importante</span>
            </div>
            <div class="notas-semana-contenido" id="notasSemanaContenido"></div>
        </div>

        <div class="estado-sistema">
            ✅ Modo profesor - Solo puede registrar en bloques disponibles
        </div>

        <div class="zona-horaria-info">
            📍 Chile - ${formatearFechaCorta(new Date())}
        </div>
    `;

    // Las notas se asignan como texto (no como HTML) para que ningún
    // carácter como "<" se interprete como una etiqueta. Sin notas el
    // contenedor queda vacío y el CSS muestra el mensaje por defecto.
    document.getElementById('notasSemanaContenido').textContent = semanaActual.notas || '';
}

// ============================================================
// 5. Reservas
// ============================================================

// Abrir modal de registro (bloque libre)
function abrirModalRegistro(bloque, dia, nombreDia) {
    if (!semanaActual) return;

    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);

    document.getElementById('bloqueSeleccionado').value = bloque.id;
    document.getElementById('fechaSeleccionada').value = fecha;

    document.getElementById('tituloModalRegistro').textContent =
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;

    document.getElementById('formRegistro').reset();

    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso);

    document.getElementById('modalRegistro').style.display = 'block';
}

// Mostrar información de reserva (solo lectura)
function mostrarInformacionReserva(reserva, bloque, dia, nombreDia) {
    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);

    document.getElementById('tituloModalSoloLectura').textContent =
        `Reserva Existente - ${nombreDia} Bloque ${bloque.numero_bloque}`;

    document.getElementById('infoCurso').textContent = reserva.curso;
    document.getElementById('infoProfesor').textContent = reserva.profesor;
    document.getElementById('infoActividad').textContent = reserva.actividad || 'No especificada';
    document.getElementById('infoObservaciones').textContent = reserva.observaciones || 'Ninguna';
    document.getElementById('infoFecha').textContent = formatearFecha(fecha);
    document.getElementById('infoHorario').textContent = `${bloque.hora_inicio} - ${bloque.hora_fin}`;

    document.getElementById('modalSoloLectura').style.display = 'block';
}

// Envío del formulario de registro
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();

    const reservaData = {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };

    if (!reservaData.curso || !reservaData.profesor) {
        mostrarError('Curso y profesor son campos obligatorios');
        return;
    }

    const { error } = await supabaseDB
        .from('reservas')
        .insert([reservaData]);

    if (error) {
        console.error('Error guardando reserva:', error);
        if (error.code === '23505') {
            mostrarError('Este bloque ya ha sido reservado. Por favor, actualice la página.');
        } else if (error.code === '23514') {
            // Regla de la base de datos (largo máximo o fecha/bloque incoherentes)
            mostrarError('No se pudo registrar la reserva: ' + error.message);
        } else if (error.code === '42501') {
            mostrarError('Esta reserva no está permitida. Revise el curso seleccionado.');
        } else {
            mostrarError('Error al guardar la reserva: ' + error.message);
        }
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        mostrarExito('Reserva registrada exitosamente. No olvide asistir a la sala en el horario reservado.');
    }
};

// ============================================================
// 6. Modales
// ============================================================
function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
}

function cerrarModalSoloLectura() {
    document.getElementById('modalSoloLectura').style.display = 'none';
}

// Click fuera de un modal: SOLO cierra el de información (es de
// solo lectura). El formulario de reserva se cierra únicamente con
// sus botones, para no perder lo escrito por un click accidental.
window.onclick = function(event) {
    const modalSoloLectura = document.getElementById('modalSoloLectura');
    if (event.target === modalSoloLectura) cerrarModalSoloLectura();
};
