// Pruebas de consistencia del proyecto: detectan referencias rotas entre HTML y JS,
// y verifican que db/seguridad.sql mantenga sus garantías principales.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ } = require('./cargar');

const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
const PAGINAS = ['index.html', 'admin.html', 'profesores.html'];

function scriptsLocales(html) {
    return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(src => !/^https?:/.test(src));
}

test('todos los scripts y hojas de estilo locales referenciados existen', () => {
    for (const pagina of PAGINAS) {
        const html = leer(pagina);
        const recursos = [
            ...scriptsLocales(html),
            ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(m => m[1])
        ];
        recursos.forEach(recurso => {
            assert.ok(fs.existsSync(path.join(RAIZ, recurso)), `${pagina} referencia "${recurso}", que no existe`);
        });
    }
});

test('cada función llamada desde un onclick existe en los scripts de esa página', () => {
    for (const pagina of ['admin.html', 'profesores.html']) {
        const html = leer(pagina);
        const codigo = scriptsLocales(html).map(leer).join('\n');
        const llamadas = new Set([...html.matchAll(/onclick="\s*(\w+)\s*\(/g)].map(m => m[1]));

        assert.ok(llamadas.size > 0);
        llamadas.forEach(nombre => {
            assert.match(codigo, new RegExp(`function\\s+${nombre}\\s*\\(`),
                `${pagina}: onclick llama a ${nombre}(), que no está definida en sus scripts`);
        });
    }
});

test('los identificadores usados con getElementById existen en el HTML de la página (o se crean dinámicamente)', () => {
    const dinamicos = new Set([
        // Se crean desde JavaScript, no están en el HTML estático
        'contenedorToasts', 'pistaSemanas', 'flechaSemanaAnterior', 'flechaSemanaSiguiente',
        'notasSemanaContenido', 'tablaHorarios'
    ]);
    const paginas = {
        'admin.html': ['js/common.js', 'js/admin-api.js', 'js/app-comun.js', 'js/app-admin.js', 'js/exportar.js', 'js/informe.js'],
        'profesores.html': ['js/common.js', 'js/app-comun.js', 'js/app-profesores.js']
    };
    for (const [pagina, scripts] of Object.entries(paginas)) {
        const html = leer(pagina);
        const codigo = scripts.map(leer).join('\n');
        const ids = new Set([...codigo.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
        ids.forEach(id => {
            if (dinamicos.has(id)) return;
            // Elementos que el código compartido consulta solo si existen en esa página
            const opcionales = { 'profesores.html': ['reservaId', 'btnLiberar'] };
            if ((opcionales[pagina] || []).includes(id)) return;
            if (['inputCursoEditar', 'contenedorToasts'].includes(id)) return;
            assert.ok(html.includes(`id="${id}"`), `${pagina}: falta el elemento id="${id}" que usa el JavaScript`);
        });
    }
});

test('el panel de profesores no carga código de administración', () => {
    const scripts = scriptsLocales(leer('profesores.html')).join(' ');
    for (const prohibido of ['admin-api', 'app-admin', 'exportar', 'informe']) {
        assert.ok(!scripts.includes(prohibido), `profesores.html no debería cargar ${prohibido}`);
    }
});

test('las únicas claves de Supabase en el código del navegador son la clave pública (anon)', () => {
    // Una clave "service_role" en el navegador daría acceso total a la base de datos.
    const archivos = ['index.html', 'admin.html', 'profesores.html', ...fs.readdirSync(path.join(RAIZ, 'js')).map(f => `js/${f}`)];
    let encontradas = 0;
    archivos.forEach(archivo => {
        for (const [token] of leer(archivo).matchAll(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)) {
            const carga = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
            assert.equal(carga.role, 'anon', `${archivo} contiene una clave con rol "${carga.role}"`);
            encontradas++;
        }
    });
    assert.ok(encontradas >= 1, 'debería existir al menos la clave pública en js/common.js');
});

test('el navegador nunca modifica ni borra reservas, semanas o bloques directamente', () => {
    // Con RLS activo esas operaciones fallarían; deben pasar por admin-api.
    const archivos = fs.readdirSync(path.join(RAIZ, 'js')).filter(f => f !== 'admin-api.js');
    archivos.forEach(archivo => {
        const texto = leer(`js/${archivo}`);
        assert.ok(!/\.(update|delete|upsert)\s*\(/.test(texto), `js/${archivo} usa update/delete/upsert directo sobre la base de datos`);
    });
});

test('solo la página de profesores inserta reservas con la clave pública', () => {
    assert.match(leer('js/app-profesores.js'), /\.from\('reservas'\)\s*\.insert\(/);
    assert.ok(!/\.insert\(/.test(leer('js/app-admin.js')), 'el administrador debe crear reservas vía admin-api (crearReserva)');
});

// ---------- db/seguridad.sql ----------
const sql = leer('db/seguridad.sql');
const sqlSinComentarios = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

test('seguridad.sql activa RLS en las tres tablas', () => {
    for (const tabla of ['semanas', 'bloques', 'reservas']) {
        assert.match(sqlSinComentarios, new RegExp(`alter table ${tabla}\\s+enable row level security`));
    }
});

test('seguridad.sql elimina las políticas previas de las tres tablas', () => {
    assert.match(sqlSinComentarios, /from pg_policies/);
    assert.match(sqlSinComentarios, /drop policy/);
});

test('seguridad.sql no crea políticas de escritura abiertas (UPDATE, DELETE o ALL)', () => {
    assert.ok(!/for\s+(update|delete|all)\b/i.test(sqlSinComentarios));
});

test('seguridad.sql limita la inserción pública a los cursos de 1° a 8°', () => {
    const insercion = sqlSinComentarios.match(/create policy "insercion_publica_reservas"[\s\S]*?;/)[0];
    assert.match(insercion, /for insert/);
    assert.ok(!/with check \(true\)/.test(insercion), 'la inserción pública no puede aceptar cualquier valor');
    assert.match(insercion, /\[1-8\]° Básico \[AB\]/);
});

test('seguridad.sql mantiene la unicidad, los límites de largo y la validación de fecha/bloque', () => {
    assert.match(sqlSinComentarios, /unique \(bloque_id, fecha\)/);
    assert.match(sqlSinComentarios, /reservas_largos_validos/);
    assert.match(sqlSinComentarios, /create trigger trg_validar_reserva/);
    assert.match(sqlSinComentarios, /creado_en/);
});
