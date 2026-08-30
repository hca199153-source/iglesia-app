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

// Procesar Registro del Formulario estructurado en tablas relacionales de Supabase
app.post('/guardar-registro', async (req, res) => {
    try {
        const {
            zona,
            nombre_pastor,
            telefono_pastor,
            correo_pastor,
            nombre_iglesia,
            direccion,
            nombre_lider,
            telefono_lider,
            correo_lider,
            num_cajas,
            maestros,
            guerrerito_nombre,
            tutor_nombre,
            tutor_telefono
        } = req.body;

        // 1. Insertar la iglesia principal
        const { data: iglesiaData, error: iglesiaError } = await supabase
            .from('iglesias')
            .insert([{
                zona,
                nombre_pastor,
                telefono_pastor,
                correo_pastor,
                nombre_iglesia,
                direccion,
                nombre_lider,
                telefono_lider,
                correo_lider,
                num_cajas: parseInt(num_cajas) || 0,
                num_maestros: maestros ? Object.keys(maestros).length : 0
            }])
            .select()
            .single();

        if (iglesiaError) throw new Error('Error al guardar iglesia: ' + iglesiaError.message);

        const iglesiaId = iglesiaData.id;

        // 2. Insertar maestros asociados
        if (maestros) {
            const maestrosArray = Object.values(maestros).map(m => ({
                iglesia_id: iglesiaId,
                nombre: m.nombre,
                telefono: m.telefono,
                correo: m.correo || null
            }));

            const { error: maestrosError } = await supabase.from('maestros').insert(maestrosArray);
            if (maestrosError) throw new Error('Error al guardar maestros: ' + maestrosError.message);
        }

        // 3. Insertar guerrerito de oración si fue provisto
        if (guerrerito_nombre && guerrerito_nombre.trim() !== '') {
            const { error: guerreritoError } = await supabase.from('guerreritos_oracion').insert([{
                iglesia_id: iglesiaId,
                nombre: guerrerito_nombre
            }]);
            if (guerreritoError) throw new Error('Error al guardar guerrerito: ' + guerreritoError.message);
        }

        // 4. Insertar tutor si fue provisto
        if (tutor_nombre && tutor_nombre.trim() !== '') {
            const { error: tutorError } = await supabase.from('tutores').insert([{
                iglesia_id: iglesiaId,
                nombre: tutor_nombre,
                telefono: tutor_telefono
            }]);
            if (tutorError) throw new Error('Error al guardar tutor: ' + tutorError.message);
        }

        // Respuesta de éxito
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
                    <p class="text-muted">Los datos de la iglesia, maestros y red de apoyo se han guardado correctamente.</p>
                    <a href="/" class="btn btn-success mt-2">Regresar a la página principal</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Excepción al procesar el registro:', err);
        res.status(500).send(`
            <div style="font-family: Arial; padding: 30px; text-align: center;">
                <h2 style="color: #d32f2f;">Error al procesar el registro</h2>
                <p>${err.message}</p>
                <a href="/" style="color: #009639; font-weight: bold;">Regresar al formulario</a>
            </div>
        `);
    }
});

// ==========================================
// INICIALIZACIÓN DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`);
});
