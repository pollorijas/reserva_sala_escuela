// Pruebas de las funciones puras de js/common.js (fechas, bloques, ocupación)
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarScripts, evaluar } = require('./cargar');

const c = cargarScripts('js/common.js');
// Las constantes declaradas con const no quedan como propiedades del contexto
const CURSOS_ADMINISTRATIVOS = evaluar(c, 'CURSOS_ADMINISTRATIVOS');

// Datos de ejemplo: 8 bloques de lunes a jueves y 6 de viernes
const bloques = [];
for (let i = 1; i <= 8; i++) bloques.push({ id: i, numero_bloque: i, dia_semana: 'Lunes-Jueves' });
for (let i = 1; i <= 6; i++) bloques.push({ id: 100 + i, numero_bloque: i, dia_semana: 'Viernes' });
const semana = { fecha_inicio: '2026-06-29', fecha_fin: '2026-07-03' };

test('calcularFecha suma días a partir del lunes', () => {
    assert.equal(c.calcularFecha('2026-06-29', 0), '2026-06-29');
    assert.equal(c.calcularFecha('2026-06-29', 4), '2026-07-03'); // cruza de mes
    assert.equal(c.calcularFecha('2026-12-28', 4), '2027-01-01'); // cruza de año
});

test('calcularFecha devuelve vacío sin fecha de inicio', () => {
    assert.equal(c.calcularFecha('', 2), '');
    assert.equal(c.calcularFecha(null, 2), '');
});

test('obtenerLunesSemana devuelve el lunes de cualquier día de esa semana', () => {
    assert.equal(c.obtenerLunesSemana('2026-06-29'), '2026-06-29'); // lunes
    assert.equal(c.obtenerLunesSemana('2026-07-01'), '2026-06-29'); // miércoles
    assert.equal(c.obtenerLunesSemana('2026-07-03'), '2026-06-29'); // viernes
    assert.equal(c.obtenerLunesSemana('2026-07-05'), '2026-06-29'); // domingo pertenece a la semana anterior
});

test('obtenerViernesSemana es el lunes más 4 días', () => {
    assert.equal(c.obtenerViernesSemana('2026-06-29'), '2026-07-03');
});

test('formatearFechaCorta entrega dd/mm/aaaa', () => {
    assert.equal(c.formatearFechaCorta('2026-06-29'), '29/06/2026');
    assert.equal(c.formatearFechaCorta('2026-01-05'), '05/01/2026');
});

test('formatearFechaCorta tolera valores vacíos o inválidos', () => {
    assert.equal(c.formatearFechaCorta(''), '');
    assert.equal(c.formatearFechaCorta(null), '');
    assert.equal(c.formatearFechaCorta('no-es-fecha'), '');
});

test('formatearDiaMes entrega dd/mm', () => {
    assert.equal(c.formatearDiaMes('2026-06-29'), '29/06');
});

test('formatearFecha incluye el día de la semana en español', () => {
    const texto = c.formatearFecha('2026-06-29');
    assert.match(texto, /lunes/i);
    assert.match(texto, /29/);
    assert.match(texto, /2026/);
});

test('calcularTotalBloquesSemana: 4 días de lunes-jueves + viernes', () => {
    assert.equal(c.calcularTotalBloquesSemana(bloques), 8 * 4 + 6); // 38
    assert.equal(c.calcularTotalBloquesSemana([]), 0);
    assert.equal(c.calcularTotalBloquesSemana(null), 0);
});

test('obtenerBloqueParaDia: viernes solo tiene 6 bloques', () => {
    assert.equal(c.obtenerBloqueParaDia(bloques, 7, 4), null);
    assert.equal(c.obtenerBloqueParaDia(bloques, 6, 4).id, 106);
    assert.equal(c.obtenerBloqueParaDia(bloques, 8, 0).id, 8);
    assert.equal(c.obtenerBloqueParaDia(bloques, 1, 3).dia_semana, 'Lunes-Jueves');
});

test('calcularOcupacionPorDia: sin reservas, todo en cero', () => {
    const r = c.calcularOcupacionPorDia(bloques, [], semana);
    assert.equal(r.maxOcupacion.porcentaje, 0);
    assert.equal(r.porDia['Lunes'].total, 8);
    assert.equal(r.porDia['Viernes'].total, 6);
});

test('calcularOcupacionPorDia: identifica el día más ocupado', () => {
    const reservas = [
        { bloque_id: 1, fecha: '2026-06-30' }, // martes
        { bloque_id: 2, fecha: '2026-06-30' },
        { bloque_id: 3, fecha: '2026-06-30' },
        { bloque_id: 1, fecha: '2026-06-29' }  // lunes
    ];
    const r = c.calcularOcupacionPorDia(bloques, reservas, semana);
    assert.equal(r.maxOcupacion.dia, 'Martes');
    assert.equal(r.porDia['Martes'].ocupados, 3);
    assert.equal(r.porDia['Martes'].porcentaje, Math.round(3 / 8 * 100));
    assert.equal(r.porDia['Lunes'].ocupados, 1);
});

test('calcularOcupacionPorDia: el viernes se calcula sobre 6 bloques', () => {
    const reservas = [{ bloque_id: 101, fecha: '2026-07-03' }, { bloque_id: 102, fecha: '2026-07-03' }, { bloque_id: 103, fecha: '2026-07-03' }];
    const r = c.calcularOcupacionPorDia(bloques, reservas, semana);
    assert.equal(r.porDia['Viernes'].porcentaje, 50);
});

test('calcularOcupacionPorDia sin semana no falla', () => {
    const r = c.calcularOcupacionPorDia(bloques, [], null);
    assert.equal(r.maxOcupacion.dia, 'N/A');
});

test('generarOpcionesCursos: 1° a 8° Básico, letras A y B', () => {
    const cursos = c.generarOpcionesCursos().map(x => x.valor);
    assert.equal(cursos.length, 16);
    assert.equal(cursos[0], '1° Básico A');
    assert.equal(cursos[15], '8° Básico B');
});

test('los cursos públicos coinciden con la regla de la base de datos (^[1-8]° Básico [AB]$)', () => {
    // Si esta prueba falla, la política de inserción pública de db/seguridad.sql
    // rechazaría reservas de profesores que el formulario sí permite.
    const regla = /^[1-8]° Básico [AB]$/;
    c.generarOpcionesCursos().forEach(curso => assert.match(curso.valor, regla));
});

test('los cursos administrativos NO cumplen la regla pública de la base de datos', () => {
    const regla = /^[1-8]° Básico [AB]$/;
    CURSOS_ADMINISTRATIVOS.forEach(nombre => assert.doesNotMatch(nombre, regla));
    assert.deepEqual([...CURSOS_ADMINISTRATIVOS], ['Mantención', 'UTP', 'Senda Previene', 'Feriado', 'Vacaciones']);
});

test('los nombres administrativos caben en el campo curso de la base de datos (varchar 25)', () => {
    CURSOS_ADMINISTRATIVOS.forEach(nombre => assert.ok(nombre.length <= 25, nombre));
});
