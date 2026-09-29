// Pruebas de la exportación (js/exportar.js) y de la numeración de semanas (js/app-admin.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarScripts, evaluar } = require('./cargar');

// ---------- CSV ----------
const exportar = cargarScripts('js/exportar.js');
const esc = exportar.escaparCeldaCSV;

test('CSV: una celda normal solo se entrecomilla', () => {
    assert.equal(esc('Hola'), '"Hola"');
});

test('CSV: las comillas dobles se duplican (no desplazan columnas)', () => {
    assert.equal(esc('Ensayo "SIMCE"'), '"Ensayo ""SIMCE"""');
});

test('CSV: null, undefined y vacío dan una celda vacía; los números pasan a texto', () => {
    assert.equal(esc(null), '""');
    assert.equal(esc(undefined), '""');
    assert.equal(esc(''), '""');
    assert.equal(esc(5), '"5"');
});

test('CSV: los textos que empiezan como fórmula se neutralizan con apóstrofe', () => {
    for (const formula of ['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tdato', '\rdato', '=HYPERLINK("http://x","clic")']) {
        assert.ok(esc(formula).startsWith('"\''), `${JSON.stringify(formula)} debería quedar neutralizada`);
    }
});

test('CSV: fechas, horarios y textos normales no se alteran', () => {
    assert.equal(esc('2026-06-30'), '"2026-06-30"');
    assert.equal(esc('08:30:00 - 09:15:00'), '"08:30:00 - 09:15:00"');
    assert.equal(esc('5° Básico A'), '"5° Básico A"');
});

test('CSV: conserva los saltos de línea dentro de la celda entrecomillada', () => {
    assert.equal(esc('línea1\nlínea2'), '"línea1\nlínea2"');
});

test('CSV: un guion en medio del texto no se toca', () => {
    assert.equal(esc('Bloque 1 - Lunes'), '"Bloque 1 - Lunes"');
});

// ---------- Recorte de textos para el PDF ----------
test('PDF: truncarPorPalabras no toca los textos cortos', () => {
    assert.equal(exportar.truncarPorPalabras('Texto corto', 50), 'Texto corto');
    assert.equal(exportar.truncarPorPalabras('', 50), '');
    assert.equal(exportar.truncarPorPalabras(null, 50), '');
});

test('PDF: truncarPorPalabras corta en el límite de una palabra y agrega puntos suspensivos', () => {
    const largo = 'Investigación guiada sobre el sistema solar con recursos multimedia interactivos';
    const recortado = exportar.truncarPorPalabras(largo, 40);
    assert.ok(recortado.endsWith('…'));
    assert.ok(recortado.length <= 41);
    // Debe cortar en un espacio: la parte anterior a "…" es prefijo del original y termina en palabra completa
    const sinPuntos = recortado.slice(0, -1);
    assert.ok(largo.startsWith(sinPuntos));
    assert.ok(largo[sinPuntos.length] === ' ' || largo[sinPuntos.length] === undefined);
});

test('PDF: un texto de justo el largo máximo no se recorta', () => {
    const texto = 'a'.repeat(50);
    assert.equal(exportar.truncarPorPalabras(texto, 50), texto);
});

// ---------- Numeración sugerida de semanas ----------
const app = cargarScripts('js/common.js', 'js/app-admin.js');
const asignarSemanas = (semanas) => evaluar(app, `listaSemanas = ${JSON.stringify(semanas)}`);

test('semana sugerida: la primera semana del año parte en 1', () => {
    asignarSemanas([]);
    assert.equal(app.calcularNumeroSemanaSugerido('2026-03-02'), 1);
});

test('semana sugerida: continúa desde el mayor número del mismo año', () => {
    asignarSemanas([
        { numero_semana: 16, fecha_inicio: '2026-06-15' },
        { numero_semana: 17, fecha_inicio: '2026-06-22' },
        { numero_semana: 18, fecha_inicio: '2026-06-29' }
    ]);
    assert.equal(app.calcularNumeroSemanaSugerido('2026-07-06'), 19);
});

test('semana sugerida: no depende del orden de la lista', () => {
    asignarSemanas([
        { numero_semana: 18, fecha_inicio: '2026-06-29' },
        { numero_semana: 2, fecha_inicio: '2026-03-09' },
        { numero_semana: 10, fecha_inicio: '2026-05-04' }
    ]);
    assert.equal(app.calcularNumeroSemanaSugerido('2026-07-06'), 19);
});

test('semana sugerida: solo cuenta las semanas del año de la nueva semana', () => {
    asignarSemanas([{ numero_semana: 38, fecha_inicio: '2026-12-21' }]);
    assert.equal(app.calcularNumeroSemanaSugerido('2027-03-01'), 1);
    assert.equal(app.calcularNumeroSemanaSugerido('2026-12-28'), 39);
});

test('semana sugerida: respeta los saltos (vacaciones) sin reiniciar la numeración', () => {
    asignarSemanas([
        { numero_semana: 18, fecha_inicio: '2026-06-29' },
        { numero_semana: 19, fecha_inicio: '2026-07-20' } // pausa de 2 semanas
    ]);
    assert.equal(app.calcularNumeroSemanaSugerido('2026-07-27'), 20);
});
