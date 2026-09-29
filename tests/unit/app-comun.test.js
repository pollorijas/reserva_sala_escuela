// Pruebas de la lógica compartida entre administradores y profesores (js/app-comun.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarScriptsConOpciones, evaluar } = require('./cargar');

const bloques = [];
for (let i = 1; i <= 8; i++) bloques.push({ id: i, numero_bloque: i, dia_semana: 'Lunes-Jueves', hora_inicio: '08:30', hora_fin: '09:15' });
for (let i = 1; i <= 6; i++) bloques.push({ id: 100 + i, numero_bloque: i, dia_semana: 'Viernes', hora_inicio: '08:30', hora_fin: '09:15' });

const semanas = [
    { id: 1, numero_semana: 16, fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19', notas: null },
    { id: 2, numero_semana: 17, fecha_inicio: '2026-06-22', fecha_fin: '2026-06-26', notas: null },
    { id: 3, numero_semana: 18, fecha_inicio: '2026-06-29', fecha_fin: '2026-07-03', notas: 'Nota <b>especial</b>' }
];

const appBase = { onLibre() {}, onOcupada() {}, actualizarInfoSemana() {} };

// Crea un contexto con common.js + app-comun.js, base de datos y elementos simulados
function crearApp({ elementos = {}, hoy = '2026-06-30' } = {}) {
    const ctx = cargarScriptsConOpciones({ elementos, tablas: { bloques, semanas: [...semanas].reverse(), reservas: [] } },
        'js/common.js', 'js/app-comun.js');
    evaluar(ctx, `hoyISO = () => '${hoy}'`);
    // El dibujo del selector y del horario necesita un navegador real: se prueba en e2e
    evaluar(ctx, 'inicializarSelectorSemanas = () => {}; renderizarHorario = () => {}');
    return ctx;
}

// ---------- Registro de la página ----------
test('registrarApp exige las tres funciones obligatorias', () => {
    const ctx = crearApp();
    for (const faltante of ['onLibre', 'onOcupada', 'actualizarInfoSemana']) {
        const config = { ...appBase };
        delete config[faltante];
        ctx.__config = config;
        assert.throws(() => evaluar(ctx, 'registrarApp(__config)'), new RegExp(faltante));
    }
});

test('cargar datos sin registrar la página da un error claro', async () => {
    const ctx = crearApp();
    await assert.rejects(() => evaluar(ctx, 'cargarSemanas()'), /registrarApp/);
});

// ---------- Carga de semanas ----------
test('cargarSemanas abre la semana que contiene la fecha de hoy', async () => {
    const ctx = crearApp({ hoy: '2026-06-24' }); // miércoles de la semana 17
    ctx.__config = { ...appBase };
    evaluar(ctx, 'registrarApp(__config)');
    await evaluar(ctx, 'cargarSemanas()');
    assert.equal(evaluar(ctx, 'semanaActual.numero_semana'), 17);
    assert.equal(evaluar(ctx, 'listaSemanas.length'), 3);
});

test('cargarSemanas abre la semana más reciente si hoy no cae en ninguna', async () => {
    const ctx = crearApp({ hoy: '2027-01-15' });
    ctx.__config = { ...appBase };
    evaluar(ctx, 'registrarApp(__config)');
    await evaluar(ctx, 'cargarSemanas()');
    assert.equal(evaluar(ctx, 'semanaActual.numero_semana'), 18);
});

test('cargarSemanas carga las reservas de la semana y avisa a la página', async () => {
    const ctx = crearApp();
    ctx.__llamadas = [];
    ctx.__config = { ...appBase, actualizarInfoSemana: () => ctx.__llamadas.push('info') };
    evaluar(ctx, 'registrarApp(__config)');
    await evaluar(ctx, 'cargarSemanas()');
    assert.deepEqual(ctx.__llamadas, ['info']);
});

test('sin semanas se muestra el mensaje propio de cada página', async () => {
    const ctx = cargarScriptsConOpciones({ tablas: { bloques, semanas: [], reservas: [] } }, 'js/common.js', 'js/app-comun.js');
    evaluar(ctx, 'inicializarSelectorSemanas = () => {}');
    ctx.__avisos = [];
    evaluar(ctx, 'mostrarAviso = (m) => __avisos.push(m)');
    ctx.__config = { ...appBase, mensajeSinSemanas: 'Mensaje del administrador' };
    evaluar(ctx, 'registrarApp(__config)');
    await evaluar(ctx, 'cargarSemanas()');
    assert.deepEqual(ctx.__avisos, ['Mensaje del administrador']);
});

// ---------- Panel de la semana ----------
test('calcularEstadisticasSemana: ocupados, libres y porcentaje sobre 38 bloques', () => {
    const ctx = crearApp();
    evaluar(ctx, `bloques = ${JSON.stringify(bloques)}; reservas = new Array(6).fill({})`);
    const e = evaluar(ctx, 'calcularEstadisticasSemana()');
    assert.equal(e.ocupados, 6);
    assert.equal(e.total, 38);
    assert.equal(e.libres, 32);
    assert.equal(e.porcentaje, 16);
});

test('calcularEstadisticasSemana sin bloques cargados no divide por cero', () => {
    const ctx = crearApp();
    evaluar(ctx, 'bloques = []; reservas = []');
    assert.equal(evaluar(ctx, 'calcularEstadisticasSemana()').porcentaje, 0);
});

test('htmlEncabezadoSemana muestra semana, porcentaje, contadores y contenido extra', () => {
    const ctx = crearApp();
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    ctx.__e = { ocupados: 6, libres: 32, total: 38, porcentaje: 16 };
    const html = evaluar(ctx, "htmlEncabezadoSemana(__e, '<button id=\"extra\"></button>')");
    assert.match(html, /Semana 18/);
    assert.match(html, /16%/);
    assert.match(html, /<strong>6<\/strong>/);
    assert.match(html, /<strong>32<\/strong>/);
    assert.match(html, /id="extra"/);
});

test('htmlNotasSemana marca el panel como "sin-notas" solo cuando no hay notas', () => {
    const ctx = crearApp();
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[0])}`);
    assert.match(evaluar(ctx, 'htmlNotasSemana()'), /sin-notas/);
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    assert.doesNotMatch(evaluar(ctx, 'htmlNotasSemana()'), /sin-notas/);
});

test('las notas nunca se insertan como HTML dentro de la plantilla', () => {
    const ctx = crearApp();
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    // El texto de la nota no debe aparecer en el HTML generado: se asigna después con textContent
    assert.doesNotMatch(evaluar(ctx, 'htmlNotasSemana()'), /especial/);
});

test('mostrarNotasSemana asigna texto plano y usa el mensaje si no hay notas', () => {
    const contenedor = { textContent: '', innerHTML: '' };
    const ctx = crearApp({ elementos: { notasSemanaContenido: contenedor } });

    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    evaluar(ctx, 'mostrarNotasSemana("Sin notas")');
    assert.equal(contenedor.textContent, 'Nota <b>especial</b>');
    assert.equal(contenedor.innerHTML, ''); // nunca se usó innerHTML

    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[0])}`);
    evaluar(ctx, 'mostrarNotasSemana("Sin notas")');
    assert.equal(contenedor.textContent, 'Sin notas');
    evaluar(ctx, 'mostrarNotasSemana()');
    assert.equal(contenedor.textContent, '');
});

test('prepararPanelSemana avisa cuando no hay semana seleccionada', () => {
    const panel = { innerHTML: '' };
    const ctx = crearApp({ elementos: { infoSemana: panel } });
    evaluar(ctx, 'semanaActual = null');
    assert.equal(evaluar(ctx, 'prepararPanelSemana()'), null);
    assert.match(panel.innerHTML, /No hay semana seleccionada/);

    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[0])}`);
    assert.equal(evaluar(ctx, 'prepararPanelSemana()'), panel);
});

// ---------- Formulario de reserva ----------
test('leerDatosFormularioReserva limpia espacios y convierte el bloque a número', () => {
    const campo = (value) => ({ value });
    const ctx = crearApp({
        elementos: {
            bloqueSeleccionado: campo('101'),
            inputCurso: campo(' 5° Básico A '),
            inputProfesor: campo('  Ana Pérez  '),
            inputActividad: campo(' Prueba '),
            inputObservaciones: campo(''),
            fechaSeleccionada: campo('2026-07-03')
        }
    });
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    assert.deepEqual(JSON.parse(JSON.stringify(evaluar(ctx, 'leerDatosFormularioReserva()'))), {
        semana_id: 3, bloque_id: 101, curso: '5° Básico A', profesor: 'Ana Pérez',
        actividad: 'Prueba', observaciones: '', fecha: '2026-07-03'
    });
});

test('abrirModalRegistro: el administrador ve los cursos administrativos y el profesor no', () => {
    for (const [cursosAdministrativos, esperado] of [[true, true], [false, false]]) {
        const elementos = {
            bloqueSeleccionado: { value: '' }, fechaSeleccionada: { value: '' },
            tituloModalRegistro: { textContent: '' }, formRegistro: { reset() {} },
            inputCurso: {}, reservaId: { value: 'viejo' }, btnLiberar: { style: {} },
            modalRegistro: { style: {} }
        };
        const ctx = crearApp({ elementos });
        ctx.__opciones = [];
        evaluar(ctx, 'cargarCursosEnSelect = (select, seleccionado, incluirAdmin) => __opciones.push(incluirAdmin)');
        ctx.__config = { ...appBase, cursosAdministrativos };
        evaluar(ctx, 'registrarApp(__config)');
        evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);

        evaluar(ctx, `abrirModalRegistro(${JSON.stringify(bloques[1])}, 1, 'Martes')`);

        assert.deepEqual(ctx.__opciones, [esperado]);
        assert.equal(elementos.bloqueSeleccionado.value, 2);
        assert.equal(elementos.fechaSeleccionada.value, '2026-06-30'); // martes de la semana 18
        assert.match(elementos.tituloModalRegistro.textContent, /Registrar Uso - Martes Bloque 2/);
        assert.equal(elementos.reservaId.value, '');
        assert.equal(elementos.btnLiberar.style.display, 'none');
        assert.equal(elementos.modalRegistro.style.display, 'block');
    }
});

test('abrirModalRegistro funciona en la página de profesores, que no tiene reservaId ni btnLiberar', () => {
    const modal = { style: {} };
    const elementos = {
        bloqueSeleccionado: { value: '' }, fechaSeleccionada: { value: '' },
        tituloModalRegistro: { textContent: '' }, formRegistro: { reset() {} },
        inputCurso: {}, modalRegistro: modal, reservaId: null, btnLiberar: null
    };
    const ctx = crearApp({ elementos: new Proxy(elementos, { get: (o, k) => o[k] || undefined }) });
    evaluar(ctx, 'cargarCursosEnSelect = () => {}');
    ctx.__config = { ...appBase };
    evaluar(ctx, 'registrarApp(__config)');
    evaluar(ctx, `semanaActual = ${JSON.stringify(semanas[2])}`);
    evaluar(ctx, `abrirModalRegistro(${JSON.stringify(bloques[0])}, 0, 'Lunes')`);
    assert.equal(modal.style.display, 'block');
});

test('cerrarModal oculta el formulario, lo limpia y olvida la reserva seleccionada', () => {
    const modal = { style: { display: 'block' } };
    let reiniciado = false;
    const ctx = crearApp({ elementos: { modalRegistro: modal, formRegistro: { reset: () => { reiniciado = true; } } } });
    evaluar(ctx, 'reservaSeleccionada = { id: 5 }');
    evaluar(ctx, 'cerrarModal()');
    assert.equal(modal.style.display, 'none');
    assert.equal(reiniciado, true);
    assert.equal(evaluar(ctx, 'reservaSeleccionada'), null);
});
