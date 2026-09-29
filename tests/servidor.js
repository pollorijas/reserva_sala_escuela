// Servidor estático mínimo para las pruebas de navegador: sirve el sitio
// (la carpeta raíz del repositorio) sin dependencias externas.
const http = require('http');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const puerto = process.env.PORT || 4173;

const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (ruta === '/') ruta = '/index.html';

    const archivo = path.join(raiz, ruta);
    if (!archivo.startsWith(raiz + path.sep)) {
        res.writeHead(403);
        return res.end();
    }

    fs.readFile(archivo, (error, datos) => {
        if (error) {
            res.writeHead(404);
            return res.end('No encontrado');
        }
        res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream' });
        res.end(datos);
    });
}).listen(puerto, () => console.log(`Sitio de pruebas en http://localhost:${puerto}`));
