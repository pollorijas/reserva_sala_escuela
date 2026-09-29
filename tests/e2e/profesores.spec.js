// Pruebas de navegador de la página de profesores (profesores.html)
// Los profesores NO inician sesión: reservan con la clave pública.
const { test, expect } = require('@playwright/test');
const { prepararPagina, crearDatos, CELDA_MARTES_BLOQUE_2 } = require('./ayudas');

const ADMINISTRATIVOS = ['Mantención', 'UTP', 'Senda Previene', 'Feriado', 'Vacaciones'];

async function abrirProfesores(page, opciones = {}) {
    const registro = await prepararPagina(page, opciones);
    await page.goto('/profesores.html');
    await expect(page.locator('#infoSemana h3')).toBeVisible();
    return registro;
}

test.describe('Reservar sin iniciar sesión', () => {
    test('no pide contraseña ni muestra ventana de acceso', async ({ page }) => {
        await abrirProfesores(page);
        await expect(page.locator('#modalLoginAdmin')).toHaveCount(0);
        await expect(page.locator('.bloque-libre').first()).toBeVisible();
    });

    test('un profesor reserva un bloque libre con la inserción pública', async ({ page }) => {
        const registro = await abrirProfesores(page);
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', '5° Básico B');
        await page.fill('#inputProfesor', 'Javier Marca');
        await page.fill('#inputActividad', 'Evaluación de proceso');
        await page.click('#formRegistro button[type="submit"]');

        await expect(page.locator('.toast.exito')).toBeVisible();
        expect(registro.posts).toHaveLength(1);
        const { tabla, cuerpo } = registro.posts[0];
        expect(tabla).toBe('reservas');
        expect(cuerpo[0]).toMatchObject({ semana_id: 3, curso: '5° Básico B', profesor: 'Javier Marca', actividad: 'Evaluación de proceso' });
        expect(registro.acciones).toHaveLength(0); // nunca usa la función de administrador
    });

    test('el formulario exige curso y profesor', async ({ page }) => {
        const registro = await abrirProfesores(page);
        await page.locator('.bloque-libre').first().click();
        await page.click('#formRegistro button[type="submit"]');
        expect(registro.posts).toHaveLength(0);
        await expect(page.locator('#modalRegistro')).toBeVisible();
    });

    test('la reserva usa la fecha correcta del día elegido (viernes = 03/07)', async ({ page }) => {
        const registro = await abrirProfesores(page);
        // Columna del viernes, primer bloque libre (el bloque 1 del viernes está reservado en los datos de ejemplo)
        await page.locator('#cuerpoTabla tr:nth-child(2) td:nth-child(7)').click();
        await page.selectOption('#inputCurso', '2° Básico A');
        await page.fill('#inputProfesor', 'Prueba');
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('.toast.exito')).toBeVisible();
        expect(registro.posts[0].cuerpo[0].fecha).toBe('2026-07-03');
    });
});

test.describe('Cursos disponibles', () => {
    test('el profesor NO ve los usos administrativos', async ({ page }) => {
        await abrirProfesores(page);
        await page.locator('.bloque-libre').first().click();
        const opciones = await page.locator('#inputCurso option').allTextContents();
        ADMINISTRATIVOS.forEach(nombre => expect(opciones).not.toContain(nombre));
        expect(opciones).toContain('1° Básico A');
        expect(opciones).toContain('8° Básico B');
    });
});

test.describe('Mensajes de error', () => {
    test('bloque ya reservado (23505)', async ({ page }) => {
        await abrirProfesores(page, { insertar: () => ({ status: 409, body: { code: '23505', message: 'duplicate key' } }) });
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', '5° Básico B');
        await page.fill('#inputProfesor', 'Prueba');
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('.toast.error')).toContainText('ya ha sido reservado');
    });

    test('regla de la base de datos (23514) muestra el motivo', async ({ page }) => {
        await abrirProfesores(page, { insertar: () => ({ status: 400, body: { code: '23514', message: 'La fecha 2099-01-01 no pertenece a la semana seleccionada' } }) });
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', '5° Básico B');
        await page.fill('#inputProfesor', 'Prueba');
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('.toast.error')).toContainText('no pertenece a la semana');
    });

    test('política de seguridad (42501) muestra un mensaje comprensible', async ({ page }) => {
        await abrirProfesores(page, { insertar: () => ({ status: 403, body: { code: '42501', message: 'new row violates row-level security policy for table "reservas"' } }) });
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', '5° Básico B');
        await page.fill('#inputProfesor', 'Prueba');
        await page.click('#formRegistro button[type="submit"]');
        const aviso = page.locator('.toast.error');
        await expect(aviso).toContainText('no está permitida');
        await expect(aviso).not.toContainText('row-level');
    });
});

test.describe('Reservas existentes y ventanas', () => {
    test('un bloque ocupado abre el detalle de solo lectura', async ({ page }) => {
        await abrirProfesores(page);
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await expect(page.locator('#modalSoloLectura')).toBeVisible();
        await expect(page.locator('#infoCurso')).toHaveText('5° Básico A');
        await expect(page.locator('#infoProfesor')).toHaveText('Ana Pérez');
        await expect(page.locator('#infoHorario')).toContainText('08:30');
    });

    test('el detalle de solo lectura se cierra con click fuera, el formulario no', async ({ page }) => {
        await abrirProfesores(page);
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await page.mouse.click(5, 5);
        await expect(page.locator('#modalSoloLectura')).toBeHidden();

        await page.locator('.bloque-libre').first().click();
        await page.fill('#inputProfesor', 'No perder');
        await page.mouse.click(5, 5);
        await expect(page.locator('#modalRegistro')).toBeVisible();
        await expect(page.locator('#inputProfesor')).toHaveValue('No perder');
    });

    test('el HTML escrito en una reserva no se ejecuta', async ({ page }) => {
        const datos = crearDatos();
        datos.reservas[0].actividad = '<img src=x onerror="window.__xss=1">';
        datos.reservas[0].profesor = '<b>negrita</b>';
        await abrirProfesores(page, { datos });
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await expect(page.locator('#infoProfesor')).toHaveText('<b>negrita</b>');
        await expect(page.locator('#infoActividad')).toContainText('<img');
        await expect(page.locator('#modalSoloLectura img, #modalSoloLectura b')).toHaveCount(0);
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });

    test('las notas de la semana se muestran como texto', async ({ page }) => {
        await abrirProfesores(page);
        const notas = page.locator('#notasSemanaContenido');
        await expect(notas).toContainText('<5 alumnos');
        await expect(notas.locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });

    test('si la semana no tiene notas se muestra el mensaje por defecto', async ({ page }) => {
        const datos = crearDatos();
        datos.semanas[2].notas = null;
        await abrirProfesores(page, { datos });
        await expect(page.locator('#notasSemanaContenido')).toBeEmpty();
        const mensaje = await page.locator('#notasSemanaContenido').evaluate(e => getComputedStyle(e, '::before').content);
        expect(mensaje).toContain('No hay notas');
    });
});

test.describe('Selector de semanas', () => {
    test('permite ir a otra semana con las flechas y con un click en la semana', async ({ page }) => {
        await abrirProfesores(page);
        await page.click('#flechaSemanaAnterior');
        await expect(page.locator('.chip-semana.activo')).toContainText('Semana 17');
        await expect(page.locator('#infoSemana h3')).toContainText('Semana 17');

        await page.locator('.chip-semana', { hasText: 'Semana 16' }).click();
        await expect(page.locator('#infoSemana h3')).toContainText('Semana 16');
        await expect(page.locator('.bloque-ocupado')).toHaveCount(0);
    });

    test('se puede arrastrar la lista de semanas con el mouse', async ({ page }) => {
        // Se agregan semanas para que la lista supere el ancho y pueda desplazarse
        const datos = crearDatos();
        for (let n = 19; n <= 40; n++) {
            const inicio = new Date(Date.UTC(2026, 6, 6 + (n - 19) * 7));
            const fin = new Date(inicio.getTime() + 4 * 86400000);
            datos.semanas.push({ id: 100 + n, numero_semana: n, fecha_inicio: inicio.toISOString().slice(0, 10), fecha_fin: fin.toISOString().slice(0, 10), notas: null });
        }
        await abrirProfesores(page, { datos });

        const pista = page.locator('#pistaSemanas');
        const antes = await pista.evaluate(e => e.scrollLeft);
        const caja = await pista.boundingBox();
        await page.mouse.move(caja.x + caja.width - 60, caja.y + caja.height / 2);
        await page.mouse.down();
        await page.mouse.move(caja.x + 80, caja.y + caja.height / 2, { steps: 10 });
        await page.mouse.up();
        const despues = await pista.evaluate(e => e.scrollLeft);
        expect(despues).toBeGreaterThan(antes);
    });
});

test.describe('Vista de celular', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('muestra tarjetas por día en lugar de la tabla', async ({ page }) => {
        await abrirProfesores(page);
        await expect(page.locator('#vistaMovil')).toBeVisible();
        await expect(page.locator('#tabla-container')).toBeHidden();
        await expect(page.locator('.tab-dia')).toHaveCount(5);
    });

    test('abre por defecto el día actual (martes) y muestra los bloques de ese día', async ({ page }) => {
        await abrirProfesores(page);
        await expect(page.locator('.tab-dia.activo')).toContainText('Mar');
        await expect(page.locator('.tarjeta-bloque')).toHaveCount(8);
        await expect(page.locator('.tarjeta-bloque.ocupado')).toHaveCount(2);
    });

    test('el viernes tiene solo 6 bloques', async ({ page }) => {
        await abrirProfesores(page);
        await page.locator('.tab-dia', { hasText: 'Vie' }).tap();
        await expect(page.locator('.tarjeta-bloque')).toHaveCount(6);
    });

    test('tocar una tarjeta libre abre el formulario y permite reservar', async ({ page }) => {
        const registro = await abrirProfesores(page);
        await page.locator('.tarjeta-bloque.libre').first().tap();
        await expect(page.locator('#modalRegistro')).toBeVisible();
        await page.selectOption('#inputCurso', '4° Básico A');
        await page.fill('#inputProfesor', 'Prueba móvil');
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('.toast.exito')).toBeVisible();
        expect(registro.posts[0].cuerpo[0].curso).toBe('4° Básico A');
    });

    test('la página no se desborda horizontalmente', async ({ page }) => {
        await abrirProfesores(page);
        const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(desborde).toBeLessThanOrEqual(1);
    });
});

test('la página no produce errores de JavaScript', async ({ page }) => {
    const registro = await abrirProfesores(page);
    await page.locator('.bloque-libre').first().click();
    await page.click('#modalRegistro .btn-secondary');
    expect(registro.erroresPagina).toEqual([]);
});
