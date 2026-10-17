const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const supabase = require('./db.js');

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de Multer para recibir la imagen de la solicitud en memoria
const upload = multer({ storage: multer.memoryStorage() });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'secreto_super_seguro_iglesia',
    resave: false,
    saveUninitialized: false
}));

// ESTADO GLOBAL DE LA APLICACIÓN (MANTENIMIENTO Y PAUSA)
let systemState = {
    status: 'active', // 'active', 'mantenimiento', 'fuera_tiempo'
    targetDate: null,  // Fecha/hora del cronómetro
    customMessage: ''
};

// MIDDLEWARE DE CONTROL DE ESTADO PÚBLICO
app.use((req, res, next) => {
    if (
        req.path.startsWith('/admin') ||
        req.path.startsWith('/dev-admin') ||
        req.path.startsWith('/login') ||
        req.path.startsWith('/logout') ||
        req.path.startsWith('/public') ||
        req.path.startsWith('/images') ||
        req.path.startsWith('/css')
    ) {
        return next();
    }

    if (systemState.status === 'mantenimiento') {
        return res.render('pausa', { 
            tipo: 'mantenimiento', 
            targetDate: systemState.targetDate,
            mensaje: systemState.customMessage || "Estamos trabajando en darte la mejor experiencia posible..."
        });
    } else if (systemState.status === 'fuera_tiempo') {
        return res.render('pausa', { 
            tipo: 'fuera_tiempo', 
            targetDate: systemState.targetDate,
            mensaje: systemState.customMessage || "El periodo de registros ha finalizado. Agradecemos a todas las iglesias su participación."
        });
    }

    next();
});

// Ruta Principal (Formulario Público)
app.get('/', (req, res) => {
    res.render('index');
});

// PANEL DE PROGRAMADOR (DEV-ADMIN)
app.get('/dev-admin', (req, res) => {
    if (!req.session.isDev) {
        return res.render('dev_login', { error: null });
    }
    res.render('dev_dashboard', { systemState });
});

// LOGIN DE PROGRAMADOR
app.post('/dev-admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'dev2026') { 
        req.session.isDev = true;
        res.redirect('/dev-admin');
    } else {
        res.render('dev_login', { error: 'Contraseña de desarrollador incorrecta.' });
    }
});

// CAMBIO DE ESTADO DESDE EL PANEL DE PROGRAMADOR
app.post('/dev-admin/cambiar-estado', (req, res) => {
    if (!req.session.isDev) return res.status(403).send('No autorizado');

    const { status, targetDate, customMessage } = req.body;
    
    systemState.status = status;
    systemState.targetDate = targetDate ? new Date(targetDate).getTime() : null;
    systemState.customMessage = customMessage || '';

    res.redirect('/dev-admin');
});

// CERRAR SESIÓN DE PROGRAMADOR
app.get('/dev-admin/logout', (req, res) => {
    req.session.isDev = false;
    res.redirect('/dev-admin');
});

// PROCESAR IMAGEN CON GOOGLE CLOUD VISION API
app.post('/escanear-vision', upload.single('imagenFormulario'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se subió ninguna imagen.' });
        }

        const imageBytes = req.file.buffer.toString('base64');
        const apiKey = 'AIzaSyAQo6X3fv4gTWNks7w1jFN3LaldV5dWDE';
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

        const body = {
            requests: [
                {
                    image: { content: imageBytes },
                    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.responses && data.responses[0].fullTextAnnotation) {
            const textoCompleto = data.responses[0].fullTextAnnotation.text;
            res.json({ success: true, text: textoCompleto });
        } else {
            res.json({ success: false, error: 'No se detectó texto legible en la imagen.' });
        }

    } catch (error) {
        console.error('Error al procesar con Cloud Vision:', error);
        res.status(500).json({ success: false, error: 'Error interno al procesar la imagen.' });
    }
});

// Inicio de Sesión (Incluye opción para Dev Console)
app.post('/login', (req, res) => {
    const { zona, password } = req.body;

    if (zona === 'dev_console') {
        if (password === 'dev2026') {
            req.session.isDev = true;
            return res.redirect('/dev-admin');
        } else {
            return res.send(`
                <script>
                    alert('Contraseña de Desarrollador incorrecta.');
                    window.location.href = '/admin';
                </script>
            `);
        }
    }

    const contrasenasZonas = {
        "san_andres": "sanandres2026",
        "veracruz": "veracruz2026",
        "cd_aleman": "cdaleman2026",
        "xalapa": "xalapa2026"
    };

    if (contrasenasZonas[zona] && contrasenasZonas[zona] === password) {
        req.session.zona = zona;
        res.redirect('/admin');
    } else {
        res.send(`
            <script>
                alert('Contraseña incorrecta para la zona seleccionada.');
                window.location.href = '/admin';
            </script>
        `);
    }
});

// Cerrar Sesión
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin');
    });
});

// Panel de Administración
app.get('/admin', async (req, res) => {
    try {
        const zonaActual = req.session.zona;
        
        if (!zonaActual) {
            return res.render('admin', { 
                registros: [], 
                zona: null, 
                totalIglesias: 0, 
                totalCajitas: 0, 
                totalMaestros: 0,
                totalPastores: 0,
                totalGuerreritos: 0,
                totalGuerreros: 0
            });
        }

        const { data: registros, error } = await supabase
            .from('iglesias')
            .select(`
                *,
                maestros (*),
                guerreritos_oracion (*),
                guerreros_oracion (*)
            `)
            .eq('zona', zonaActual);

        if (error) throw new Error(error.message);

        const totalIglesias = registros.length;
        const totalCajitas = registros.reduce((acc, curr) => acc + (parseInt(curr.num_cajas) || 0), 0);
        const totalMaestros = registros.reduce((acc, curr) => acc + (curr.maestros ? curr.maestros.length : 0), 0);
        const totalPastores = registros.filter(r => r.nombre_pastor && r.nombre_pastor.trim() !== '').length;
        const totalGuerreritos = registros.reduce((acc, curr) => acc + (curr.guerreritos_oracion ? curr.guerreritos_oracion.length : 0), 0);
        const totalGuerreros = registros.reduce((acc, curr) => acc + (curr.guerreros_oracion ? curr.guerreros_oracion.length : 0), 0);

        res.render('admin', { 
            registros: registros || [], 
            zona: zonaActual,
            totalIglesias,
            totalCajitas,
            totalMaestros,
            totalPastores,
            totalGuerreritos,
            totalGuerreros
        });
    } catch (err) {
        console.error('Error en /admin:', err);
        res.status(500).send('Error al cargar el panel: ' + err.message);
    }
});

// Guardar Registro Público
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
            guerreritos,
            guerreros
        } = req.body;

        const { data: iglesiaData, error: iglesiaError } = await supabase
            .from('iglesias')
            .insert([{
                zona,
                nombre_pastor,
                telefono_pastor,
                correo_pastor: correo_pastor || null,
                nombre_iglesia,
                direccion,
                nombre_lider,
                telefono_lider,
                correo_lider: correo_lider || null,
                num_cajas: parseInt(num_cajas) || 0,
                num_maestros: maestros ? Object.keys(maestros).length : 0,
                estado_semaforo: 'verde',
                observacion_semaforo: 'Completo'
            }])
            .select()
            .single();

        if (iglesiaError) throw new Error('Error al guardar iglesia: ' + iglesiaError.message);
        const iglesiaId = iglesiaData.id;

        if (maestros) {
            const maestrosArray = Object.values(maestros).map(m => ({
                iglesia_id: iglesiaId,
                nombre: m.nombre,
                telefono: m.telefono,
                correo: m.correo || null
            }));
            await supabase.from('maestros').insert(maestrosArray);
        }

        if (guerreritos) {
            const listaGuerreritos = Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos);
            const guerreritosArray = listaGuerreritos.map(g => ({
                iglesia_id: iglesiaId,
                nombre_guerrerito: g.nombre_guerrerito,
                nombre_tutor: g.nombre_tutor,
                telefono_tutor: g.telefono_tutor
            })).filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '');

            if (guerreritosArray.length > 0) {
                await supabase.from('guerreritos_oracion').insert(guerreritosArray);
            }
        }

        if (guerreros) {
            const listaGuerreros = Array.isArray(guerreros) ? guerreros : Object.values(guerreros);
            const guerrerosArray = listaGuerreros.map(gu => ({
                iglesia_id: iglesiaId,
                nombre_guerrero: gu.nombre_guerrero,
                telefono_guerrero: gu.telefono_guerrero
            })).filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '');

            if (guerrerosArray.length > 0) {
                await supabase.from('guerreros_oracion').insert(guerrerosArray);
            }
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head>
            <body class="bg-light d-flex align-items-center justify-content-center vh-100">
                <div class="card p-4 text-center shadow-sm" style="max-width: 450px;">
                    <h3 class="text-success mb-3">¡Registro Exitoso!</h3>
                    <p class="text-muted">Los datos de la iglesia y su red de apoyo se han guardado correctamente.</p>
                    <a href="/" class="btn btn-success mt-2">Regresar a la página principal</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error al procesar registro:', err);
        res.status(500).send('Error al procesar: ' + err.message);
    }
});

// Cargar Edición
app.get('/editar-registro/:id', async (req, res) =>
