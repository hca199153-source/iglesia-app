const express = require('express');
const path = require('path');
const supabase = require('./db.js'); // Importa tu conexión existente desde db.js

const app = express();

// Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para procesar datos y archivos estáticos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta Principal (Formulario de Registro)
app.get('/', (req, res) => {
    res.render('index'); // Asegúrate de tener tu index.ejs en la carpeta views
});

// ==========================================
// RUTA DEL PANEL DE ADMINISTRACIÓN (/admin)
// ==========================================
app.get('/admin', async (req, res) => {
    try {
        // Consulta los registros en Supabase (ajusta 'registros' si tu tabla se llama distinto, ej. 'iglesias')
        const { data: registros, error } = await supabase
            .from('registros')
            .select('*');

        if (error) {
            console.error('Error al obtener registros de Supabase:', error.message);
            return res.status(500).send('Error al conectar con la base de datos: ' + error.message);
        }

        // Renderiza views/admin.ejs pasándole la lista de registros
        res.render('admin', { registros: registros || [] });
    } catch (err) {
        console.error('Excepción en la ruta /admin:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// Exporta la aplicación para que server.js pueda levantarla
module.exports = app;
