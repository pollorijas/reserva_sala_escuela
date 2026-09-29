// Ayudantes compartidos por las pruebas de navegador.
// Simulan Supabase y la función de administrador para que las pruebas sean
// rápidas, repetibles y nunca toquen la base de datos real.
const fs = require('fs');
const path = require('path');

const MODULOS = path.join(__dirname, '..', 'node_modules');
const librerias = {
    supabase: fs.readFileSync(path.join(MODULOS, '@supabase/supabase-js/dist/umd/supabase.js'), 'utf8'),
    jspdf: fs.readFileSync(path.join(MODULOS, 'jspdf/dist/jspdf.umd.min.js'), 'utf8'),
    autotable: fs.readFileSync(path.join(MODULOS, 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js'), 'utf8')
};

const CLAVE_ADMIN = 'clave-de-prueba';
// Reserva id 1 (5° Básico A, Ana Pérez): martes, bloque 2 → fila 2, columna 4 de la tabla del horario
const CELDA_MARTES_BLOQUE_2 = '#cuerpoTabla tr:nth-child(2) td:nth-child(4)';
// Martes 30 de junio de 2026: cae dentro de la semana 18 (29/06 al 03/07)
const FECHA_FIJA = new Date('2026-06-30T12:00:00-04:00');

// ---------- Datos de ejemplo ----------
function crearDatos() {
    const bloques = [];
    for (let i = 1; i <= 8; i++) {
        bloques.push({ id: i, numero_bloque: i, dia_semana: 'Lunes-Jueves', hora_inicio: '08:30:00', hora_fin: '09:15:00' });
    }
    for (let i = 1; i <= 6; i++) {
        bloques.push({ id: 100 + i, numero_bloque: i, dia_semana: 'Viernes', hora_inicio: '08:30:00', hora_fin: '09:15:00' });
    }

    const semanas = [
        { id: 1, numero_semana: 16, fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19', notas: null },
        { id: 2, numero_semana: 17, fecha_inicio: '2026-06-22', fecha_fin: '2026-06-26', notas: null },
        { id: 3, numero_semana: 18, fecha_inicio: '2026-06-29', fecha_fin: '2026-07-03', notas: 'Semana de pruebas: <5 alumnos y <img src=x onerror="window.__xss=1">\nSegunda línea' }
    ];

    const reservas = [
        { id: 1, semana_id: 3, bloque_id: 2, fecha: '2026-06-30', curso: '5° Básico A', profesor: 'Ana Pérez',
          actividad: 'Investigacion guiada sobre el sistema solar con recursos multimedia interactivos', observaciones: '' },
        { id: 2, semana_id: 3, bloque_id: 3, fecha: '2026-06-30', curso: '7° Básico A', profesor: 'Luis Soto',
          actividad: 'Prueba', observaciones: 'Necesita audífonos' },
        { id: 3, semana_id: 3, bloque_id: 101, fecha: '2026-07-03', curso: '5° Básico A', profesor: 'Ana Pérez',
          actividad: '', observaciones: '' },
        { id: 4, semana_id: 2, bloque_id: 1, fecha: '2026-06-22', curso: '3° Básico B', profesor: 'María Díaz',
          actividad: 'Juegos educativos', observaciones: '' }
    ];

    return { bloques, semanas, reservas };
}

// ---------- Simulación de la red ----------
// Devuelve un registro con todo lo que la página intentó hacer:
//   posts    → inserciones directas a Supabase (clave pública)
//   lecturas → consultas a Supabase
//   acciones → llamadas a la función de administrador (admin-api)
async function prepararPagina(page, opciones = {}) {
    const {
        datos = crearDatos(),
        sesionAdmin = false,        // simula que el administrador ya inició sesión
        insertar = null,            // (tabla, cuerpo) => { status, body }
        adminApi = null             // (solicitud) => { status, body }
    } = opciones;

    const registro = { posts: [], lecturas: [], acciones: [], datos };

    await page.clock.setFixedTime(FECHA_FIJA);
    if (sesionAdmin) {
        await page.addInitScript((clave) => sessionStorage.setItem('claveAdmin', clave), CLAVE_ADMIN);
    }

    // Librerías externas (CDN) servidas desde node_modules
    await page.route('**/unpkg.com/@supabase/**', r => r.fulfill({ contentType: 'application/javascript', body: librerias.supabase }));
    await page.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/**', r => r.fulfill({ contentType: 'application/javascript', body: librerias.autotable }));
    await page.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf/**', r => r.fulfill({ contentType: 'application/javascript', body: librerias.jspdf }));

    // API REST de Supabase
    await page.route('**/rest/v1/**', route => {
        const solicitud = route.request();
        const url = new URL(solicitud.url());
        const tabla = url.pathname.split('/').pop();

        if (solicitud.method() === 'POST') {
            const cuerpo = JSON.parse(solicitud.postData() || 'null');
            registro.posts.push({ tabla, cuerpo });
            const respuesta = insertar ? insertar(tabla, cuerpo) : { status: 201, body: [] };
            return route.fulfill({ status: respuesta.status, contentType: 'application/json', body: JSON.stringify(respuesta.body) });
        }

        registro.lecturas.push({ tabla, consulta: url.search });
        let filas;
        if (tabla === 'bloques') filas = datos.bloques;
        else if (tabla === 'semanas') filas = [...datos.semanas].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
        else if (tabla === 'reservas') {
            filas = datos.reservas;
            const filtro = url.searchParams.get('semana_id');
            if (filtro) filas = filas.filter(r => r.semana_id === parseInt(filtro.replace('eq.', ''), 10));
            const seleccion = url.searchParams.get('select') || '*';
            if (seleccion.includes('bloques') || seleccion.includes('semanas')) {
                filas = filas.map(r => ({
                    ...r,
                    bloques: datos.bloques.find(b => b.id === r.bloque_id) || null,
                    semanas: datos.semanas.find(s => s.id === r.semana_id) || null
                }));
            }
        } else filas = [];

        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(filas) });
    });

    // Función de administrador
    await page.route('**/.netlify/functions/admin-api', route => {
        const solicitud = JSON.parse(route.request().postData());
        registro.acciones.push(solicitud);

        let respuesta;
        if (adminApi) respuesta = adminApi(solicitud);
        if (!respuesta) {
            respuesta = solicitud.clave === CLAVE_ADMIN
                ? { status: 200, body: { ok: true } }
                : { status: 401, body: { error: 'Contraseña de administrador incorrecta.' } };
        }
        return route.fulfill({ status: respuesta.status, contentType: 'application/json', body: JSON.stringify(respuesta.body) });
    });

    // Errores de JavaScript en la página: hacen fallar la prueba
    registro.erroresPagina = [];
    page.on('pageerror', error => registro.erroresPagina.push(error.message));

    return registro;
}

// ---------- Utilidades ----------
// Lector CSV mínimo (RFC 4180): comprueba que las columnas no se desplazan
function parsearCSV(texto) {
    const filas = [];
    let fila = [], celda = '', entreComillas = false;
    const contenido = texto.replace(/^﻿/, '');

    for (let i = 0; i < contenido.length; i++) {
        const c = contenido[i];
        if (entreComillas) {
            if (c === '"' && contenido[i + 1] === '"') { celda += '"'; i++; }
            else if (c === '"') entreComillas = false;
            else celda += c;
        } else if (c === '"') entreComillas = true;
        else if (c === ',') { fila.push(celda); celda = ''; }
        else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
        else celda += c;
    }
    return filas;
}

async function leerDescarga(descarga) {
    const ruta = await descarga.path();
    return fs.readFileSync(ruta);
}

module.exports = { CLAVE_ADMIN, CELDA_MARTES_BLOQUE_2, crearDatos, prepararPagina, parsearCSV, leerDescarga };
