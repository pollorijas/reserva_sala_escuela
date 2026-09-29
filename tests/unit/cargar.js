// Carga scripts del sitio (js/*.js) dentro de un contexto aislado de Node,
// con "document" y "window" simulados, para probar sus funciones puras
// sin abrir un navegador.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Las fechas del sistema son de Chile; se fija la zona para que las pruebas
// den lo mismo en cualquier computador o servidor.
process.env.TZ = 'America/Santiago';

const RAIZ = path.resolve(__dirname, '..', '..');

// opciones.elementos → { id: objetoSimulado } devueltos por document.getElementById(id)
// opciones.tablas    → { nombreTabla: filas } que devuelve la base de datos simulada
function crearContexto(opciones = {}) {
    const { elementos = {}, tablas = {} } = opciones;

    const elementoFalso = new Proxy(function () {}, {
        get: (_, prop) => (prop === 'style' || prop === 'classList' ? elementoFalso : elementoFalso),
        set: () => true,
        apply: () => elementoFalso
    });

    const contexto = {
        console,
        window: { supabase: { createClient: () => crearBaseDeDatosSimulada(tablas) } },
        document: {
            addEventListener: () => {},
            getElementById: (id) => elementos[id] || elementoFalso,
            querySelector: () => elementoFalso,
            querySelectorAll: () => []
        },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    };
    return vm.createContext(contexto);
}

// Imita el encadenado de supabase-js: from(tabla).select().order().eq() se puede esperar (await)
function crearBaseDeDatosSimulada(tablas) {
    return {
        from(tabla) {
            const consulta = {
                select: () => consulta,
                order: () => consulta,
                eq: () => consulta,
                then: (resolver) => resolver({ data: tablas[tabla] || [], error: null })
            };
            return consulta;
        }
    };
}

// Ejecuta los archivos indicados (rutas relativas a la raíz del repositorio)
// en un mismo contexto y lo devuelve. Las funciones declaradas quedan
// disponibles como propiedades del contexto.
function cargarScripts(...archivos) {
    return cargarScriptsConOpciones({}, ...archivos);
}

function cargarScriptsConOpciones(opciones, ...archivos) {
    const contexto = crearContexto(opciones);
    archivos.forEach(archivo => {
        const codigo = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
        vm.runInContext(codigo, contexto, { filename: archivo });
    });
    return contexto;
}

// Evalúa una expresión en un contexto ya creado (útil para leer o asignar
// variables globales declaradas con let/const en los scripts)
function evaluar(contexto, codigo) {
    return vm.runInContext(codigo, contexto);
}

module.exports = { RAIZ, cargarScripts, cargarScriptsConOpciones, evaluar };
