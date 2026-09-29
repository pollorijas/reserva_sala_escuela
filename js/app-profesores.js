// ============================================================
// Aplicación de profesores
//
// La carga de datos, el selector de semanas y el formulario de reserva
// se comparten con la página de administradores (js/app-comun.js). Aquí
// solo está lo propio del profesor.
//
// Secciones de este archivo:
//   1. Registro de la página
//   2. Inicialización
//   3. Panel de información de la semana
//   4. Reservas (guardar y ver ocupadas)
//   5. Modales
//
// Los profesores no inician sesión: solo pueden leer datos y
// crear reservas (permisos definidos por RLS en Supabase).
// ============================================================

// ============================================================
// 1. Registro de la página
// ============================================================
registrarApp({
    onLibre: abrirModalRegistro,
    onOcupada: mostrarInformacionReserva,
    actualizarInfoSemana,
    mensajeSinSemanas: 'No hay semanas configuradas. Contacte al administrador.',
    cursosAdministrativos: false // los profesores solo ven los cursos de 1° a 8° Básico
});

// ============================================================
// 2. Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para profesores...');
    await iniciarApp();
});

// ============================================================
// 3. Panel de información de la semana
// ============================================================
function actualizarInfoSemana() {
    const panel = prepararPanelSemana();
    if (!panel) return;

    const avisoModoProfesor = `
        <div class="estado-sistema">
            ✅ Modo profesor - Solo puede registrar en bloques disponibles
        </div>
    `;

    panel.innerHTML =
        htmlEncabezadoSemana(calcularEstadisticasSemana()) +
        htmlNotasSemana() +
        avisoModoProfesor +
        htmlZonaHoraria();

    // Sin notas el contenedor queda vacío y el CSS muestra el mensaje por defecto
    mostrarNotasSemana();
}

// ============================================================
// 4. Reservas
//    Registrar en un bloque libre (abrirModalRegistro) está en app-comun.js
// ============================================================

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

    const reservaData = leerDatosFormularioReserva();

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
// 5. Modales
//    (cerrarModal, el de la reserva, está en app-comun.js)
// ============================================================
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
