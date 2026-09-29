// ============================================================
// Lógica compartida por las páginas de administradores y profesores
//
// Aquí vive todo lo que era idéntico en app-admin.js y app-profesores.js.
// Cada página se registra con registrarApp({...}) indicando solo lo que la
// distingue (qué hacer al tocar un bloque, cómo dibujar el panel de la
// semana, si ve los cursos administrativos).
//
// Secciones de este archivo:
//   1. Estado global
//   2. Registro de la página
//   3. Inicialización y carga de datos (bloques, semanas, reservas)
//   4. Piezas del panel de información de la semana
//   5. Formulario de reserva (abrir, leer, cerrar)
//
// Debe cargarse después de common.js y antes de app-admin.js / app-profesores.js.
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
// 2. Registro de la página
// ============================================================
let _app = null;

// configuracion:
//   onLibre(bloque, dia, nombreDia)                 → al tocar un bloque libre (obligatorio)
//   onOcupada(reserva, bloque, dia, nombreDia)      → al tocar un bloque ocupado (obligatorio)
//   actualizarInfoSemana()                          → dibuja el panel de la semana (obligatorio)
//   mensajeSinSemanas                               → aviso cuando no hay semanas creadas
//   cursosAdministrativos                           → true si el selector de curso incluye
//                                                     Mantención, UTP, Feriado, etc.
function registrarApp(configuracion) {
    ['onLibre', 'onOcupada', 'actualizarInfoSemana'].forEach(nombre => {
        if (typeof configuracion[nombre] !== 'function') {
            throw new Error(`registrarApp: falta la función "${nombre}"`);
        }
    });

    _app = {
        mensajeSinSemanas: 'No hay semanas disponibles.',
        cursosAdministrativos: false,
        ...configuracion
    };
}

function obtenerApp() {
    if (!_app) throw new Error('La página debe llamar a registrarApp() antes de cargar datos');
    return _app;
}

// ============================================================
// 3. Inicialización y carga de datos
// ============================================================
async function iniciarApp() {
    await cargarBloques();
    await cargarSemanas();
}

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

// Carga las semanas, arma el selector deslizable y abre la semana actual
async function cargarSemanas() {
    const app = obtenerApp();

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
        mostrarAviso(app.mensajeSinSemanas);
        return;
    }

    // La semana actual es la que contiene la fecha de hoy; si no hay, la más reciente
    const hoyStr = hoyISO();
    semanaActual = listaSemanas.find(semana =>
        semana.fecha_inicio <= hoyStr && semana.fecha_fin >= hoyStr
    ) || listaSemanas[0];

    inicializarSelectorSemanas(listaSemanas, semanaActual.id, async (semana) => {
        semanaActual = semana;
        await cargarReservasSemana(semana.id);
    });

    await cargarReservasSemana(semanaActual.id);
}

async function cargarReservasSemana(semanaId) {
    const app = obtenerApp();

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
        onLibre: app.onLibre,
        onOcupada: app.onOcupada
    });

    app.actualizarInfoSemana();
}

// ============================================================
// 4. Piezas del panel de información de la semana
//    Cada página las combina a su manera en actualizarInfoSemana().
// ============================================================

// Devuelve el contenedor del panel, o null (escribiendo un aviso) si no hay semana
function prepararPanelSemana() {
    const contenedor = document.getElementById('infoSemana');
    if (!semanaActual) {
        contenedor.innerHTML = '<p>No hay semana seleccionada</p>';
        return null;
    }
    return contenedor;
}

function calcularEstadisticasSemana() {
    const ocupados = reservas.length;
    const total = calcularTotalBloquesSemana(bloques);
    return {
        ocupados,
        total,
        libres: total - ocupados,
        porcentaje: total > 0 ? Math.round(ocupados / total * 100) : 0
    };
}

// Título de la semana + porcentaje de ocupación (+ contenido extra, p. ej. un botón)
function htmlEncabezadoSemana(estadisticas, htmlExtra = '') {
    return `
        <div class="info-semana-header">
            <div class="info-semana-titulo">
                <h3>📅 Semana ${semanaActual.numero_semana}</h3>
                <p>${formatearFecha(semanaActual.fecha_inicio)} - ${formatearFecha(semanaActual.fecha_fin)}</p>
            </div>

            <div class="info-semana-estadisticas">
                <div class="estadistica-principal">
                    <span class="porcentaje-ocupacion">${estadisticas.porcentaje}%</span>
                    <span class="texto-estadistica">ocupación</span>
                </div>
                <div class="detalles-estadistica">
                    <div class="detalle-item">
                        <strong>${estadisticas.ocupados}</strong>
                        <div>ocupados</div>
                    </div>
                    <div class="detalle-item">
                        <strong>${estadisticas.libres}</strong>
                        <div>libres</div>
                    </div>
                </div>
            </div>
            ${htmlExtra}
        </div>
    `;
}

// Contenedor de las notas. El texto se escribe después con mostrarNotasSemana()
function htmlNotasSemana() {
    return `
        <div class="notas-semana-container ${!semanaActual.notas ? 'sin-notas' : ''}">
            <div class="notas-semana-titulo">
                <span class="icono">📌</span>
                <span>Información importante</span>
            </div>
            <div class="notas-semana-contenido" id="notasSemanaContenido"></div>
        </div>
    `;
}

function htmlZonaHoraria() {
    return `
        <div class="zona-horaria-info">
            📍 Chile - ${formatearFechaCorta(new Date())}
        </div>
    `;
}

// Las notas se asignan como texto (no como HTML) para que ningún carácter como
// "<" se interprete como una etiqueta. Con mensajeVacio en '' el contenedor queda
// vacío y el CSS muestra el mensaje por defecto.
function mostrarNotasSemana(mensajeVacio = '') {
    document.getElementById('notasSemanaContenido').textContent = semanaActual.notas || mensajeVacio;
}

// ============================================================
// 5. Formulario de reserva
// ============================================================

// Abre el formulario para registrar una reserva en un bloque libre
function abrirModalRegistro(bloque, dia, nombreDia) {
    if (!semanaActual) return;

    document.getElementById('bloqueSeleccionado').value = bloque.id;
    document.getElementById('fechaSeleccionada').value = calcularFecha(semanaActual.fecha_inicio, dia);

    document.getElementById('tituloModalRegistro').textContent =
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;

    document.getElementById('formRegistro').reset();
    cargarCursosEnSelect(document.getElementById('inputCurso'), '', obtenerApp().cursosAdministrativos);

    // Estos elementos existen solo en el formulario del administrador (que también edita reservas)
    const reservaId = document.getElementById('reservaId');
    if (reservaId) reservaId.value = '';
    const btnLiberar = document.getElementById('btnLiberar');
    if (btnLiberar) btnLiberar.style.display = 'none';

    document.getElementById('modalRegistro').style.display = 'block';
}

// Lee los campos del formulario como una reserva lista para guardar
function leerDatosFormularioReserva() {
    return {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };
}

function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
    reservaSeleccionada = null;
}
