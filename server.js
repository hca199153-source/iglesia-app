const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares esenciales
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CARPETA PÚBLICA PARA ARCHIVOS ESTÁTICOS (Imágenes, CSS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesiones
app.use(session({
    secret: 'secreto_super_seguro_iglesia',
    resave: false,
    saveUninitialized: false
}));

// Ruta Principal (Renderiza el index.ejs)
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta de Login para Administradores
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Admin</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card p-4 shadow-sm" style="max-width: 400px; width: 100%;">
                <h4 class="text-success text-center mb-3">Panel Admin</h4>
                <form action="/login" method="POST">
                    <div class="mb-3">
                        <label class="form-label small">Contraseña:</label>
                        <input type="password" name="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-success w-100">Ingresar</button>
                </form>
                <div class="text-center mt-3">
                    <a href="/" class="small text-muted text-decoration-none">← Volver al inicio</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Procesar Registro del Formulario
app.post('/guardar-registro', (req, res) => {
    const datosRegistro = req.body;
    console.log("Nuevo registro recibido:", datosRegistro);
    // Aquí puedes agregar la lógica para guardar en Supabase
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card p-4 text-center shadow-sm" style="max-width: 450px;">
                <h3 class="text-success mb-3">¡Registro Exitoso!</h3>
                <p class="text-muted">Los datos se han guardado correctamente para la zona seleccionada.</p>
                <a href="/" class="btn btn-success mt-2">Regresar a la página principal</a>
            </div>
        </body>
        </html>
    `);
});

// Inicialización del servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

const app = require('./index.js');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`);
});
