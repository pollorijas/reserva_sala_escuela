// Pruebas de navegador del panel de administradores (admin.html)
const { test, expect } = require('@playwright/test');
const { prepararPagina, parsearCSV, leerDescarga, CLAVE_ADMIN, CELDA_MARTES_BLOQUE_2 } = require('./ayudas');

const ADMINISTRATIVOS = ['Mantención', 'UTP', 'Senda Previene', 'Feriado', 'Vacaciones'];

async function abrirAdmin(page, opciones = {}) {
    const registro = await prepararPagina(page, { sesionAdmin: true, ...opciones });
    await page.goto('/admin.html');
    await expect(page.locator('#infoSemana h3')).toBeVisible();
    return registro;
}

test.describe('Inicio de sesión', () => {
    test('pide la contraseña al entrar si no hay sesión', async ({ page }) => {
        await prepararPagina(page);
        await page.goto('/admin.html');
        await expect(page.locator('#modalLoginAdmin')).toBeVisible();
    });

    test('rechaza una contraseña incorrecta y muestra el error', async ({ page }) => {
        await prepararPagina(page);
        await page.goto('/admin.html');
        await page.fill('#inputClaveAdmin', 'incorrecta');
        await page.click('#btnLoginAdmin');
        await expect(page.locator('#errorLoginAdmin')).toBeVisible();
        await expect(page.locator('#modalLoginAdmin')).toBeVisible();
        expect(await page.evaluate(() => sessionStorage.getItem('claveAdmin'))).toBeNull();
    });

    test('acepta la contraseña correcta, cierra el aviso y guarda la sesión de la pestaña', async ({ page }) => {
        await prepararPagina(page);
        await page.goto('/admin.html');
        await page.fill('#inputClaveAdmin', CLAVE_ADMIN);
        await page.click('#btnLoginAdmin');
        await expect(page.locator('#modalLoginAdmin')).toBeHidden();
        expect(await page.evaluate(() => sessionStorage.getItem('claveAdmin'))).toBe(CLAVE_ADMIN);
    });

    test('si la contraseña deja de ser válida, vuelve a pedirla', async ({ page }) => {
        const registro = await abrirAdmin(page, { adminApi: () => ({ status: 401, body: { error: 'Contraseña de administrador incorrecta.' } }) });
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('#modalLoginAdmin')).toBeVisible();
        expect(registro.acciones.length).toBeGreaterThan(0);
    });
});

test.describe('Horario y reservas', () => {
    test('muestra la semana actual con sus reservas', async ({ page }) => {
        await abrirAdmin(page);
        await expect(page.locator('#infoSemana h3')).toContainText('Semana 18');
        await expect(page.locator('.bloque-ocupado')).toHaveCount(3);
        await expect(page.locator('.bloque-ocupado').first()).toContainText('5° Básico A');
    });

    test('las estadísticas cuentan bloques ocupados y libres sobre 38 bloques', async ({ page }) => {
        await abrirAdmin(page);
        await expect(page.locator('.detalle-card', { hasText: 'Total bloques' })).toContainText('38');
        await expect(page.locator('.detalles-estadistica')).toContainText('3');
        await expect(page.locator('.detalles-estadistica')).toContainText('35');
    });

    test('editar una reserva pasa por la función de administrador', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await expect(page.locator('#modalRegistro')).toBeVisible();
        await page.fill('#inputProfesor', 'Ana Pérez Editada');
        await page.click('#formRegistro button[type="submit"]');

        await expect(page.locator('.toast.exito')).toBeVisible();
        const accion = registro.acciones.find(a => a.accion === 'actualizarReserva');
        expect(accion).toBeTruthy();
        expect(accion.datos.profesor).toBe('Ana Pérez Editada');
        expect(accion.datos.id).toBe(1);
        expect(accion.clave).toBe(CLAVE_ADMIN);
        expect(registro.posts).toHaveLength(0);
    });

    test('liberar un bloque pide confirmación y usa la función de administrador', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await page.click('#btnLiberar');
        await expect(page.locator('#modalConfirmacion')).toBeVisible();
        expect(registro.acciones.some(a => a.accion === 'eliminarReserva')).toBe(false);

        await page.click('#btnConfirmarSi');
        await expect(page.locator('.toast.exito')).toBeVisible();
        const accion = registro.acciones.find(a => a.accion === 'eliminarReserva');
        expect(accion.datos.id).toBe(1);
    });

    test('cancelar la confirmación no elimina nada', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await page.click('#btnLiberar');
        await page.click('#modalConfirmacion .btn-secondary');
        await expect(page.locator('#modalConfirmacion')).toBeHidden();
        expect(registro.acciones.some(a => a.accion === 'eliminarReserva')).toBe(false);
    });

    test('crear una reserva administrativa ("Feriado") usa la función de administrador, no la inserción pública', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', 'Feriado');
        await page.fill('#inputProfesor', 'Administración');
        await page.click('#formRegistro button[type="submit"]');

        await expect(page.locator('.toast.exito')).toBeVisible();
        const accion = registro.acciones.find(a => a.accion === 'crearReserva');
        expect(accion.datos.curso).toBe('Feriado');
        expect(registro.posts).toHaveLength(0);
    });

    test('el selector de cursos del administrador incluye los usos administrativos', async ({ page }) => {
        await abrirAdmin(page);
        await page.locator('.bloque-libre').first().click();
        const opciones = await page.locator('#inputCurso option').allTextContents();
        ADMINISTRATIVOS.forEach(nombre => expect(opciones).toContain(nombre));
        expect(opciones).toContain('1° Básico A');
    });

    test('muestra el mensaje de la regla violada cuando el servidor rechaza la reserva', async ({ page }) => {
        await abrirAdmin(page, {
            adminApi: () => ({ status: 400, body: { error: 'La fecha 2099-01-01 no pertenece a la semana seleccionada' } })
        });
        await page.locator('.bloque-libre').first().click();
        await page.selectOption('#inputCurso', 'UTP');
        await page.fill('#inputProfesor', 'Admin');
        await page.click('#formRegistro button[type="submit"]');
        await expect(page.locator('.toast.error')).toContainText('no pertenece a la semana');
    });
});

test.describe('Ventanas (modales)', () => {
    test('los formularios NO se cierran al hacer click fuera y conservan lo escrito', async ({ page }) => {
        await abrirAdmin(page);
        await page.locator('.bloque-libre').first().click();
        await page.fill('#inputProfesor', 'Texto que no debe perderse');

        await page.mouse.click(5, 5);
        await expect(page.locator('#modalRegistro')).toBeVisible();
        await expect(page.locator('#inputProfesor')).toHaveValue('Texto que no debe perderse');

        await page.click('#modalRegistro .btn-secondary');
        await expect(page.locator('#modalRegistro')).toBeHidden();
    });

    test('"Nueva semana" y "Editar notas" tampoco se cierran con click fuera', async ({ page }) => {
        await abrirAdmin(page);
        await page.click('button:has-text("Nueva Semana")');
        await page.mouse.click(5, 5);
        await expect(page.locator('#modalNuevaSemana')).toBeVisible();
        await page.click('#modalNuevaSemana .btn-secondary');

        await page.click('.btn-editar-notas');
        await page.mouse.click(5, 5);
        await expect(page.locator('#modalEditarNotas')).toBeVisible();
    });

    test('el informe (solo lectura) sí se cierra con click fuera', async ({ page }) => {
        await abrirAdmin(page);
        await page.click('button:has-text("Informe de Uso")');
        await expect(page.locator('#modalInforme')).toBeVisible();
        await page.mouse.click(5, 5);
        await expect(page.locator('#modalInforme')).toBeHidden();
    });
});

test.describe('Semanas y notas', () => {
    test('la numeración sugerida continúa la de las semanas ya creadas', async ({ page }) => {
        await abrirAdmin(page);
        await page.click('button:has-text("Nueva Semana")');
        await expect(page.locator('#inputNumeroSemana')).toHaveValue('19');
    });

    test('crear una semana usa la función de administrador con lunes y viernes correctos', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.click('button:has-text("Nueva Semana")');
        await page.fill('#inputFechaInicio', '2026-07-08'); // un miércoles → debe quedar el lunes 6
        await page.click('#formNuevaSemana button[type="submit"]');
        await expect(page.locator('.toast.exito')).toBeVisible();

        const accion = registro.acciones.find(a => a.accion === 'crearSemana');
        expect(accion.datos.fecha_inicio).toBe('2026-07-06');
        expect(accion.datos.fecha_fin).toBe('2026-07-10');
    });

    test('las notas se muestran como texto: sin ejecutar HTML y respetando saltos de línea', async ({ page }) => {
        await abrirAdmin(page);
        const notas = page.locator('#notasSemanaContenido');
        await expect(notas).toContainText('<5 alumnos');
        await expect(notas).toContainText('Segunda línea');
        await expect(notas.locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
        expect(await notas.evaluate(e => getComputedStyle(e).whiteSpace)).toBe('pre-line');
    });

    test('guardar notas usa la función de administrador', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.click('.btn-editar-notas');
        await page.fill('#inputNotasEditar', 'Nueva nota');
        await page.click('#formEditarNotas button[type="submit"]');
        await expect(page.locator('.toast.exito')).toBeVisible();
        const accion = registro.acciones.find(a => a.accion === 'actualizarNotas');
        expect(accion.datos).toEqual({ id: 3, notas: 'Nueva nota' });
    });

    test('el selector permite cambiar de semana y carga sus reservas', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await expect(page.locator('.chip-semana')).toHaveCount(3);
        await expect(page.locator('.chip-semana.activo')).toContainText('Semana 18');

        await page.click('#flechaSemanaAnterior');
        await expect(page.locator('.chip-semana.activo')).toContainText('Semana 17');
        await expect(page.locator('.bloque-ocupado')).toHaveCount(1);
        await expect(page.locator('.bloque-ocupado')).toContainText('3° Básico B');
        expect(registro.lecturas.some(l => l.tabla === 'reservas' && l.consulta.includes('semana_id=eq.2'))).toBe(true);
    });

    test('las flechas se deshabilitan en los extremos', async ({ page }) => {
        await abrirAdmin(page);
        await expect(page.locator('#flechaSemanaSiguiente')).toBeDisabled();
        await page.click('#flechaSemanaAnterior');
        await page.click('#flechaSemanaAnterior');
        await expect(page.locator('#flechaSemanaAnterior')).toBeDisabled();
    });
});

test.describe('Exportaciones', () => {
    test('el CSV mantiene las columnas alineadas y neutraliza fórmulas', async ({ page }) => {
        const datos = require('./ayudas').crearDatos();
        datos.reservas.push(
            { id: 10, semana_id: 3, bloque_id: 4, fecha: '2026-06-30', curso: '6° Básico A', profesor: 'Carla',
              actividad: 'Ensayo "SIMCE", parte 1', observaciones: 'línea1\nlínea2' },
            { id: 11, semana_id: 3, bloque_id: 5, fecha: '2026-06-30', curso: '6° Básico B', profesor: 'Pedro',
              actividad: '=HYPERLINK("http://sitio-ajeno.com","clic")', observaciones: '@cmd' }
        );
        await abrirAdmin(page, { datos });

        const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar CSV")')]);
        expect(descarga.suggestedFilename()).toBe('reservas_semana_18.csv');
        const filas = parsearCSV((await leerDescarga(descarga)).toString('utf8'));

        expect(filas[0]).toEqual(['Día', 'Fecha', 'Bloque', 'Horario', 'Curso', 'Profesor', 'Actividad', 'Observaciones']);
        const datosCSV = filas.slice(1);
        expect(datosCSV).toHaveLength(5);
        datosCSV.forEach(fila => expect(fila).toHaveLength(8));

        const carla = datosCSV.find(f => f[5] === 'Carla');
        expect(carla[6]).toBe('Ensayo "SIMCE", parte 1');
        expect(carla[7]).toBe('línea1\nlínea2');
        const pedro = datosCSV.find(f => f[5] === 'Pedro');
        expect(pedro[6].startsWith("'=HYPERLINK")).toBe(true);
        expect(pedro[7]).toBe("'@cmd");
    });

    test('el PDF del horario se descarga y muestra la actividad completa, sin recortarla', async ({ page }) => {
        await abrirAdmin(page);
        const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar PDF")')]);
        expect(descarga.suggestedFilename()).toBe('horario_semana_18.pdf');

        const pdf = (await leerDescarga(descarga)).toString('latin1');
        expect(pdf.startsWith('%PDF')).toBe(true);
        expect(pdf).toContain('Investigacion guiada sobre el sistema solar con recursos multimedia interactivos');
        expect(pdf).not.toContain('…');
        expect(pdf).toContain('DISPONIBLE');
        expect(pdf).toContain('Ana P');
    });

    test('el informe muestra estadísticas y se puede descargar en PDF', async ({ page }) => {
        await abrirAdmin(page);
        await page.click('button:has-text("Informe de Uso")');
        const informe = page.locator('#contenidoInforme');
        await expect(informe).toContainText('Reservas totales');
        // 4 reservas en total: Ana Pérez es la profesora con más reservas (2) y 5° Básico A el curso más usado (2)
        await expect(informe.locator('.informe-stat', { hasText: 'Reservas totales' })).toContainText('4');
        await expect(informe.locator('.informe-stat', { hasText: 'Profesor que más usa' })).toContainText('Ana Pérez');
        await expect(informe.locator('.informe-stat', { hasText: 'Curso que más usa' })).toContainText('5° Básico A');
        await expect(informe.locator('.informe-stat', { hasText: 'Día más ocupado' })).toContainText('Martes');

        const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Descargar PDF")')]);
        expect((await leerDescarga(descarga)).toString('latin1').startsWith('%PDF')).toBe(true);
    });

    test('el informe escapa el HTML de los datos y no ejecuta código', async ({ page }) => {
        const datos = require('./ayudas').crearDatos();
        datos.reservas[0].profesor = '<img src=x onerror="window.__xss=1">';
        datos.reservas[0].curso = '<b>negrita</b>';
        await abrirAdmin(page, { datos });
        await page.click('button:has-text("Informe de Uso")');
        await expect(page.locator('#contenidoInforme')).toContainText('Reservas totales');
        await expect(page.locator('#contenidoInforme img')).toHaveCount(0);
        await expect(page.locator('#contenidoInforme b')).toHaveCount(0);
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });
});

test.describe('Aspectos generales', () => {
    test('ya no existe la función de correo', async ({ page }) => {
        await abrirAdmin(page);
        await expect(page.locator('button:has-text("Notificar")')).toHaveCount(0);
        await expect(page.locator('#modalCorreo')).toHaveCount(0);
    });

    test('los botones de administración están presentes', async ({ page }) => {
        await abrirAdmin(page);
        await expect(page.locator('.acciones-admin button')).toHaveText([
            /Nueva Semana/, /Exportar CSV/, /Exportar PDF/, /Informe de Uso/
        ]);
    });

    test('la reserva con HTML en la actividad no ejecuta código en la tabla ni en el modal', async ({ page }) => {
        const datos = require('./ayudas').crearDatos();
        datos.reservas[0].actividad = '<img src=x onerror="window.__xss=1">';
        datos.reservas[0].curso = '5° Básico A';
        await abrirAdmin(page, { datos });
        await page.locator(CELDA_MARTES_BLOQUE_2).click();
        await expect(page.locator('#inputActividad')).toHaveValue('<img src=x onerror="window.__xss=1">');
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    });

    test('la página no produce errores de JavaScript', async ({ page }) => {
        const registro = await abrirAdmin(page);
        await page.locator('.bloque-libre').first().click();
        await page.click('#modalRegistro .btn-secondary');
        expect(registro.erroresPagina).toEqual([]);
    });
});
