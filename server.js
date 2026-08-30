const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./db.js'); // Conexión a Supabase

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares esenciales
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesiones
app.use(session({
    secret: 'secreto_super_seguro_iglesia',
    resave: false,
    saveUninitialized: false
}));

// ==========================================
// RUTAS DE LA APLICACIÓN
// ==========================================

// Ruta Principal (Formulario de Registro)
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta del Panel de Administración (/admin) consultando la tabla 'iglesias'
app.get('/admin', async (req, res) => {
    try {
        const { data: registros, error } = await supabase
            .from('iglesias')
            .select('*');

        if (error) {
            console.error('Error al obtener registros de Supabase:', error.message);
            return res.status(500).send('Error al conectar con la base de datos: ' + error.message);
        }

        res.render('admin', { registros: registros || [] });
    } catch (err) {
        console.error('Excepción en ruta /admin:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Procesar Registro del Formulario e insertarlo en Supabase
app.post('/guardar-registro', async (req, res) => {
    try {
        const datosRegistro = req.body;
        console.log("Nuevo registro recibido:", datosRegistro);
        
        // Inserción real a la tabla 'iglesias' de Supabase
        const { error } = await supabase.from('iglesias').insert([datosRegistro]);
        
        if (error) {
            console.error('Error al guardar en Supabase:', error.message);
            return res.status(500).send('Error al guardar los datos: ' + error.message);
        }

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
                    <p class="text-muted">Los datos se han guardado correctamente en la base de datos.</p>
                    <a href="/" class="btn btn-success mt-2">Regresar a la página principal</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Excepción al procesar el registro:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// ==========================================
// INICIALIZACIÓN DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`);
});
