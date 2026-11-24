const express = require('express');
const session = require('express-session');
const path = require('path');
const QRCode = require('qrcode');
const supabase = require('./db.js');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'secreto_super_seguro_iglesia_2026_x_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

let systemState = {
    status: 'active', // 'active', 'mantenimiento', 'fuera_tiempo'
    targetDate: null,
    customMessage: '',
    zonasPausadas: []
};

const NOMBRES_ZONAS = {
    san_andres: 'San Andrés Tuxtla',
    medellin: 'Medellín',
    manlio: 'Manlio Fabio',
    orizaba: 'Orizaba',
    cd_aleman: 'Ciudad Alemán',
    xalapa: 'Xalapa',
    carlos_a_carrillo: 'Cosamaloapan',
    tezonapa: 'Tezonapa',
    sayula: 'Sayula',
    cosamaloapan: 'Coatepec'
};

const GRUPOS_DEFAULT = [
    { id: 'default_1', nombre: 'Maestros de Lerdo de Tejada', enlace: 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
    { id: 'default_2', nombre: 'Maestros de la Zona Catemaco', enlace: 'https://chat.whatsapp.com/GdjuIPnI2JTINlXTQiHBAS' },
    { id: 'default_3', nombre: 'CM de Lerdo de Tejada', enlace: 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK' },
    { id: 'default_4', nombre: 'CM Catemaco', enlace: 'https://chat.whatsapp.com/Gn0mJGYtdS893bEV12XPUA' }
];

async function obtenerGruposWhatsApp() {
    try {
        const { data, error } = await supabase
            .from('grupos_whatsapp')
            .select('id, nombre, enlace')
            .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
            return data;
        }
    } catch (_) {
        // Si la tabla no existe aún, usar los grupos por defecto
    }
    return GRUPOS_DEFAULT;
}

function normalizarTexto(texto) {
    return (texto || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function ultimos10Digitos(telefono) {
    const limpios = (telefono || '').toString().replace(/\D/g, '');
    return limpios.length >= 10 ? limpios.slice(-10) : limpios;
}

app.use((req, res, next) => {
    res.locals.nombresZonas = NOMBRES_ZONAS;
    const rutasLibres = [
        '/admin', '/admin-comunidad', '/dev-admin', '/dev-admin/login',
        '/login', '/logout', '/unirse-comunidad', '/procesar-unirse-comunidad',
        '/guardar-registro', '/iglesia/qr', '/descargar-qr', '/buscar-mi-qr',
        '/evento/checkin-dashboard', '/evento/confirmar-llegada',
        '/evento/marcar-asistencia', '/public', '/images', '/css'
    ];
    if (rutasLibres.some(r => req.path.startsWith(r))) {
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

app.get('/', (req, res) => {
    res.render('index');
});

// ==========================================
// SECCIÓN: UNIRSE A LA COMUNIDAD
// ==========================================
app.get('/unirse-comunidad', (req, res) => {
    res.render('unirse_comunidad', {
        registroExitoso: false,
        linkGrupo: null,
        rolSeleccionado: null,
        nombreUsuario: null,
        errorMensaje: null
    });
});

app.post('/procesar-unirse-comunidad', async (req, res) => {
    try {
        const { nombre_completo, telefono, correo, rol } = req.body;
        const telLimpio = (telefono || '').replace(/\D/g, '');
        let iglesiaEncontrada = null;

        if (telLimpio.length >= 10) {
            const { data: iglesiasMatch } = await supabase.from('iglesias').select('*');
            if (iglesiasMatch) {
                const encontrada = iglesiasMatch.find(i => {
                    const telP = (i.telefono_pastor || '').replace(/\D/g, '');
                    const telL = (i.telefono_lider || '').replace(/\D/g, '');
                    return (telP && telP.endsWith(telLimpio.slice(-10))) || (telL && telL.endsWith(telLimpio.slice(-10)));
                });
                if (encontrada) iglesiaEncontrada = encontrada;
            }

            if (!iglesiaEncontrada) {
                const { data: maestrosMatch } = await supabase.from('maestros').select('*, iglesias (*)');
                if (maestrosMatch) {
                    const mEncontrado = maestrosMatch.find(m => {
                        const telM = (m.telefono || '').replace(/\D/g, '');
                        return telM && telM.endsWith(telLimpio.slice(-10));
                    });
                    if (mEncontrado && mEncontrado.iglesias) iglesiaEncontrada = mEncontrado.iglesias;
                }
            }
        }

        if (!iglesiaEncontrada) {
            return res.render('unirse_comunidad', {
                registroExitoso: false,
                linkGrupo: null,
                rolSeleccionado: rol,
                nombreUsuario: null,
                errorMensaje: '❌ Su número no coincide con ningún registro previo en el formulario oficial.'
            });
        }

        await supabase.from('miembros_comunidad').insert([{
            nombre_completo: (nombre_completo || '').trim(),
            telefono: telLimpio,
            correo: (correo && correo.trim() !== '') ? correo.trim() : 'Sin correo registrado',
            rol,
            iglesia_id: iglesiaEncontrada.id
        }]);

        const zonaKey = iglesiaEncontrada.zona || 'san_andres';
        const linksPorZona = {
            'san_andres': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
            'catemaco': { 'pastor': 'https://chat.whatsapp.com/Gn0mJGYtdS893bEV12XPUA', 'lider': 'https://chat.whatsapp.com/Gn0mJGYtdS893bEV12XPUA', 'maestro': 'https://chat.whatsapp.com/GdjuIPnI2JTINlXTQiHBAS', 'guerrero': 'https://chat.whatsapp.com/GdjuIPnI2JTINlXTQiHBAS' },
            'lerdo': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
            'tezonapa': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
            'carlos_a_carrillo': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
            'sayula': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' },
            'cosamaloapan': { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' }
        };
        const linksDefault = { 'pastor': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'lider': 'https://chat.whatsapp.com/KCgzoYFlnqz0CPiseThOdK', 'maestro': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr', 'guerrero': 'https://chat.whatsapp.com/J56uP7MaPa78reDb0BHxvr' };
        const zonaLinks = linksPorZona[zonaKey] || linksDefault;
        const linkFinal = zonaLinks[rol] || linksDefault['pastor'];

        res.render('unirse_comunidad', {
            registroExitoso: true,
            linkGrupo: linkFinal,
            rolSeleccionado: rol,
            nombreUsuario: nombre_completo,
            errorMensaje: null
        });
    } catch (err) {
        res.status(500).send('Error al procesar el registro.');
    }
});

// ==========================================
// PANEL DE COMUNIDAD
// ==========================================
app.get('/admin-comunidad', async (req, res) => {
    try {
        const zonaActual = req.session.zona;
        if (!zonaActual) return res.render('admin_comunidad', { iglesias: [], zona: null });

        const { data: iglesias } = await supabase.from('iglesias').select(`*, miembros_comunidad (*)`).eq('zona', zonaActual);
        res.render('admin_comunidad', { iglesias: iglesias || [], zona: zonaActual });
    } catch (err) {
        res.status(500).send('Error al cargar panel de comunidad.');
    }
});

app.post('/admin-comunidad/notificado/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { notificado } = req.body;
        await supabase.from('iglesias').update({ notificado_whatsapp: notificado === true || notificado === 'true' }).eq('id', id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/admin-comunidad/editar/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nombre_completo, telefono, correo, rol } = req.body;
        await supabase.from('miembros_comunidad').update({
            nombre_completo: (nombre_completo || '').trim(),
            telefono: (telefono || '').replace(/\D/g, ''),
            correo: (correo && correo.trim() !== '') ? correo.trim() : 'Sin correo registrado',
            rol
        }).eq('id', id);
        res.redirect('/admin-comunidad');
    } catch (err) {
        res.status(500).send('Error al editar integrante.');
    }
});

app.post('/admin-comunidad/eliminar/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await supabase.from('miembros_comunidad').delete().eq('id', id);
        res.redirect('/admin-comunidad');
    } catch (err) {
        res.status(500).send('Error al eliminar integrante.');
    }
});

// ==========================================
// GRUPOS DE WHATSAPP EN BASE DE DATOS
// ==========================================
app.post('/api/grupos-whatsapp', async (req, res) => {
    try {
        const nombre = (req.body.nombre || '').trim();
        const enlace = (req.body.enlace || '').trim();

        if (!nombre || !enlace) {
            return res.status(400).json({ success: false, message: 'Debe indicar el nombre y el enlace del grupo.' });
        }

        const enlaceValido = /^https?:\/\/(chat\.whatsapp\.com|wa\.me)\/\S+/i.test(enlace);
        if (!enlaceValido) {
            return res.status(400).json({ success: false, message: 'Ingrese un enlace válido de WhatsApp (ej. https://chat.whatsapp.com/...).' });
        }

        const { data, error } = await supabase
            .from('grupos_whatsapp')
            .insert([{ nombre, enlace }])
            .select('id, nombre, enlace')
            .single();

        if (error) {
            return res.status(500).json({ success: false, message: 'No se pudo guardar en la base de datos: ' + error.message });
        }

        return res.status(201).json({ success: true, grupo: data });
    } catch (err) {
        console.error('Error al guardar grupo WhatsApp:', err);
        return res.status(500).json({ success: false, message: 'Error interno al guardar el grupo.' });
    }
});

// ==========================================
// DEV-ADMIN Y CONTROL DE ZONAS PAUSADAS
// ==========================================
app.get('/dev-admin', (req, res) => {
    if (!req.session.isDev) return res.render('dev_login', { error: null });
    res.render('dev_dashboard', { systemState });
});

app.post('/dev-admin/login', (req, res) => {
    const { password } = req.body;
    if (password === 'dev2026') {
        req.session.isDev = true;
        res.redirect('/dev-admin');
    } else {
        res.render('dev_login', { error: 'Contraseña incorrecta.' });
    }
});

app.post('/dev-admin/cambiar-estado', (req, res) => {
    if (!req.session.isDev) return res.status(403).send('No autorizado');
    const { status, targetDate, customMessage } = req.body;
    systemState.status = status;
    systemState.targetDate = targetDate ? new Date(targetDate).getTime() : null;
    systemState.customMessage = (customMessage || '').trim();
    res.redirect('/dev-admin');
});

app.post('/dev-admin/cambiar-zona-estado', (req, res) => {
    if (!req.session.isDev) return res.status(403).send('No autorizado');
    const { zona, accion } = req.body;
    if (!systemState.zonasPausadas) systemState.zonasPausadas = [];

    if (accion === 'pausar' && !systemState.zonasPausadas.includes(zona)) {
        systemState.zonasPausadas.push(zona);
    } else if (accion === 'activar') {
        systemState.zonasPausadas = systemState.zonasPausadas.filter(z => z !== zona);
    }
    res.redirect('/dev-admin');
});

app.get('/dev-admin/logout', (req, res) => {
    req.session.isDev = false;
    res.redirect('/dev-admin');
});

// ==========================================
// SESIÓN Y ADMINISTRACIÓN ZONAL
// ==========================================
app.post('/login', (req, res) => {
    const { zona, password } = req.body;

    if (zona === 'dev_console') {
        if (password === 'dev2026') {
            req.session.isDev = true;
            return res.redirect('/admin');
        } else {
            return res.send(`<script>alert('Contraseña incorrecta.');window.location.href = '/admin';</script>`);
        }
    }

    const contrasenasZonas = {
        "san_andres": "sanandres2026",
        "medellin": "medellin2026",
        "manlio": "manlio2026",
        "orizaba": "orizaba2026",
        "cd_aleman": "cdaleman2026",
        "xalapa": "xalapa2026",
        "carlos_a_carrillo": "carlos2026",
        "tezonapa": "tezonapa2026",
        "sayula": "sayula2026",
        "cosamaloapan": "cosamaloapan2026"
    };

    if (contrasenasZonas[zona] && contrasenasZonas[zona] === password) {
        req.session.zona = zona;
        res.redirect('/admin');
    } else {
        res.send(`<script>alert('Contraseña incorrecta.');window.location.href = '/admin';</script>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/admin'); });
});

app.get('/admin', async (req, res) => {
    try {
        const zonaActual = req.session.zona;
        const gruposWhatsApp = await obtenerGruposWhatsApp();

        if (!zonaActual) {
            return res.render('admin', {
                registros: [],
                zona: null,
                gruposWhatsApp,
                totalIglesias: 0,
                totalCajitas: 0,
                totalMaestros: 0,
                totalPastores: 0,
                totalGuerreritos: 0,
                totalGuerreros: 0
            });
        }

        const { data: registros } = await supabase.from('iglesias').select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`).eq('zona', zonaActual);

        const regs = registros || [];
        res.render('admin', {
            registros: regs,
            zona: zonaActual,
            gruposWhatsApp,
            totalIglesias: regs.length,
            totalCajitas: regs.reduce((a, c) => a + (parseInt(c.num_cajas) || 0), 0),
            totalMaestros: regs.reduce((a, c) => a + (c.maestros ? c.maestros.length : 0), 0),
            totalPastores: regs.filter(r => r.nombre_pastor).length,
            totalGuerreritos: regs.reduce((a, c) => a + (c.guerreritos_oracion ? c.guerreritos_oracion.length : 0), 0),
            totalGuerreros: regs.reduce((a, c) => a + (c.guerreros_oracion ? c.guerreros_oracion.length : 0), 0)
        });
    } catch (err) {
        res.status(500).send('Error al cargar panel.');
    }
});

// ==========================================
// ESTADO DE CONCENTRADO DE APP EXTERNA
// ==========================================
app.post('/actualizar-concentrado/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const realizado = req.body.realizado === true || req.body.realizado === 'true';

        const { error } = await supabase
            .from('iglesias')
            .update({ concentrado_realizado: realizado })
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        return res.json({ success: true, concentrado_realizado: realizado });
    } catch (err) {
        console.error('Error al actualizar estado de concentrado:', err);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el concentrado.' });
    }
});

// ==========================================
// ZONA: CÓDIGO QR Y CHECK-IN DE EVENTO
// ==========================================
app.get('/iglesia/qr/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { data: iglesia } = await supabase.from('iglesias').select('*').eq('id', id).maybeSingle();

        if (!iglesia) return res.status(404).send('Iglesia no encontrada.');

        let token = iglesia.token_qr;
        if (!token) {
            token = 'iglesia_' + id + '_' + Math.random().toString(36).substring(2, 9);
            await supabase.from('iglesias').update({ token_qr: token }).eq('id', id);
        }

        const hostUrl = req.protocol + '://' + req.get('host');
        const urlCheckIn = `${hostUrl}/evento/confirmar-llegada?token=${token}`;

        QRCode.toDataURL(urlCheckIn, { width: 300, margin: 2, color: { dark: '#007a2e', light: '#ffffff' } }, (err, qrImageSrc) => {
            if (err) {
                console.error("Error al generar QR:", err);
                return res.status(500).send("Error al generar el código QR.");
            }
            res.render('qr_iglesia', { iglesia, qrImageSrc, urlCheckIn });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error interno al generar el QR.');
    }
});

app.get('/descargar-qr', (req, res) => {
    res.render('descargar_qr_publico', { iglesia: null, qrImageSrc: null, errorMensaje: null });
});

app.post('/buscar-mi-qr', async (req, res) => {
    try {
        const telLimpio = (req.body.telefono || '').replace(/\D/g, '');
        if (telLimpio.length < 10) {
            return res.render('descargar_qr_publico', {
                iglesia: null,
                qrImageSrc: null,
                errorMensaje: 'Por favor ingresa un número válido de al menos 10 dígitos.'
            });
        }

        const ultimos10 = telLimpio.slice(-10);
        const { data: iglesias } = await supabase.from('iglesias').select('*');

        const iglesiaEncontrada = (iglesias || []).find(i => {
            const telP = (i.telefono_pastor || '').replace(/\D/g, '');
            const telL = (i.telefono_lider || '').replace(/\D/g, '');
            return (telP && telP.endsWith(ultimos10)) || (telL && telL.endsWith(ultimos10));
        });

        if (!iglesiaEncontrada) {
            return res.render('descargar_qr_publico', {
                iglesia: null,
                qrImageSrc: null,
                errorMensaje: 'No encontramos ninguna iglesia registrada con ese teléfono. Verifica el número o contacta a tu coordinador de zona.'
            });
        }

        let token = iglesiaEncontrada.token_qr;
        if (!token) {
            token = 'iglesia_' + iglesiaEncontrada.id + '_' + Math.random().toString(36).substring(2, 9);
            await supabase.from('iglesias').update({ token_qr: token }).eq('id', iglesiaEncontrada.id);
        }

        const hostUrl = req.protocol + '://' + req.get('host');
        const urlCheckIn = `${hostUrl}/evento/confirmar-llegada?token=${token}`;

        QRCode.toDataURL(urlCheckIn, { width: 300, margin: 2, color: { dark: '#007a2e', light: '#ffffff' } }, (err, qrImageSrc) => {
            if (err) {
                return res.render('descargar_qr_publico', { iglesia: null, qrImageSrc: null, errorMensaje: 'Error interno al generar la imagen QR.' });
            }
            res.render('descargar_qr_publico', { iglesia: iglesiaEncontrada, qrImageSrc, errorMensaje: null });
        });
    } catch (err) {
        console.error(err);
        res.render('descargar_qr_publico', { iglesia: null, qrImageSrc: null, errorMensaje: 'Ocurrió un error al consultar la base de datos.' });
    }
});

app.get('/evento/checkin-dashboard', async (req, res) => {
    try {
        const zonaFiltro = req.query.zona || '';

        let query = supabase.from('iglesias').select('*');
        if (zonaFiltro) {
            query = query.eq('zona', zonaFiltro);
        }

        const { data: iglesias } = await query;
        const listaIglesias = iglesias || [];

        const totalEsperadas = listaIglesias.length;
        const totalLlegadas = listaIglesias.filter(i => i.asistencia_confirmada).length;
        const totalFaltantes = totalEsperadas - totalLlegadas;
        const totalCajitasEntregadas = listaIglesias
            .filter(i => i.asistencia_confirmada)
            .reduce((acc, curr) => acc + (parseInt(curr.num_cajas) || 0), 0);

        res.render('checkin_dashboard', {
            iglesias: listaIglesias,
            zonaFiltro,
            totalEsperadas,
            totalLlegadas,
            totalFaltantes,
            totalCajitasEntregadas
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar el dashboard de check-in.');
    }
});

app.get('/evento/confirmar-llegada', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send('Token QR no válido o faltante.');

        const { data: iglesia } = await supabase.from('iglesias').select('*').eq('token_qr', token).maybeSingle();

        if (!iglesia) {
            return res.render('resultado_checkin', { exito: false, mensaje: '❌ Código QR no reconocido en la base de datos.' });
        }

        const fechaLlegada = new Date().toISOString();
        await supabase.from('iglesias').update({
            asistencia_confirmada: true,
            fecha_llegada: fechaLlegada
        }).eq('id', iglesia.id);

        res.render('resultado_checkin', {
            exito: true,
            iglesia: {
                ...iglesia,
                asistencia_confirmada: true,
                fecha_llegada: fechaLlegada,
                concentrado_realizado: Boolean(iglesia.concentrado_realizado)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al procesar la confirmación de llegada.');
    }
});

app.post('/evento/marcar-asistencia/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado } = req.body;

        await supabase.from('iglesias').update({
            asistencia_confirmada: estado === 'true' || estado === true,
            fecha_llegada: (estado === 'true' || estado === true) ? new Date().toISOString() : null
        }).eq('id', id);

        res.redirect('/evento/checkin-dashboard');
    } catch (err) {
        res.status(500).send('Error al actualizar el estado de asistencia.');
    }
});

// RUTA PARA TRASLADAR ZONA DE UNA IGLESIA
app.post('/trasladar-zona/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nueva_zona } = req.body;

        if (!nueva_zona) {
            return res.status(400).send('Debe seleccionar una zona de destino.');
        }

        const { error } = await supabase
            .from('iglesias')
            .update({ zona: nueva_zona })
            .eq('id', id);

        if (error) throw new Error(error.message);

        res.redirect('/admin');
    } catch (err) {
        console.error("Error al trasladar zona:", err);
        res.status(500).send('Error al procesar el traslado de zona.');
    }
});

// GUARDAR REGISTRO CON BLOQUEO POR ZONA PAUSADA Y ANTI-DUPLICADOS
app.post('/guardar-registro', async (req, res) => {
    try {
        const { zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, maestros, guerreritos, guerreros } = req.body;
        const zonaKey = (zona && zona.trim() !== '') ? zona : 'san_andres';
        const nombreZonaVisible = NOMBRES_ZONAS[zonaKey] || zonaKey.toUpperCase();

        if (systemState.zonasPausadas && systemState.zonasPausadas.includes(zonaKey)) {
            return res.status(400).send(`<!DOCTYPE html><html lang="es"><head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="bg-light d-flex align-items-center justify-content-center vh-100"><div class="card p-4 text-center shadow-sm" style="max-width: 450px;"><h3 class="text-danger mb-3">¡Registro Cerrado!</h3><p class="text-muted">Lo sentimos, la capacidad para la zona <strong>${nombreZonaVisible}</strong> se encuentra completa por el momento.</p><a href="/" class="btn btn-secondary mt-2">Regresar al Inicio</a></div></body></html>`);
        }

        const telPastor10 = ultimos10Digitos(telefono_pastor);
        const pastorNorm = normalizarTexto(nombre_pastor);
        const iglesiaNorm = normalizarTexto(nombre_iglesia);

        const { data: existentesZona, error: errDuplicado } = await supabase
            .from('iglesias')
            .select('id, nombre_iglesia, nombre_pastor, telefono_pastor')
            .eq('zona', zonaKey);

        if (errDuplicado) throw new Error(errDuplicado.message);

        const yaExiste = (existentesZona || []).some(reg => {
            const telExistente10 = ultimos10Digitos(reg.telefono_pastor);
            const mismoTelefono = telPastor10 && telPastor10.length >= 10 && telExistente10 === telPastor10;

            const regIglesiaNorm = normalizarTexto(reg.nombre_iglesia);
            const regPastorNorm = normalizarTexto(reg.nombre_pastor);
            const iglesiaValida = iglesiaNorm && iglesiaNorm !== 'iglesia pendiente de asignar';
            const mismaIglesiaYPastor = iglesiaValida && regIglesiaNorm === iglesiaNorm && regPastorNorm === pastorNorm;

            return mismoTelefono || mismaIglesiaYPastor;
        });

        if (yaExiste) {
            return res.status(409).send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="bg-light d-flex align-items-center justify-content-center vh-100"><div class="card p-4 text-center shadow-sm border-warning" style="max-width: 460px;"><h3 class="text-warning mb-3">Ese registro ya existe</h3><p class="text-muted">Ya hay un registro previo con estos datos en la zona <strong>${nombreZonaVisible}</strong>. No se guardó un duplicado.</p><a href="/" class="btn btn-success mt-2 fw-bold">Regresar al Inicio</a></div></body></html>`);
        }

        const { data: iglesiaData, error: iglesiaError } = await supabase
            .from('iglesias')
            .insert([{
                zona: zonaKey,
                nombre_pastor: (nombre_pastor || '').trim(),
                telefono_pastor: (telefono_pastor || '').trim(),
                correo_pastor: (correo_pastor && correo_pastor.trim() !== '') ? correo_pastor.trim() : 'Sin correo registrado',
                nombre_iglesia: (nombre_iglesia && nombre_iglesia.trim() !== '') ? nombre_iglesia.trim() : 'Iglesia pendiente de asignar',
                direccion: (direccion && direccion.trim() !== '') ? direccion.trim() : 'Dirección pendiente de registrar',
                nombre_lider: (nombre_lider && nombre_lider.trim() !== '') ? nombre_lider.trim() : 'Sin líder registrado',
                telefono_lider: (telefono_lider && telefono_lider.trim() !== '') ? telefono_lider.trim() : 'Sin teléfono',
                correo_lider: (correo_lider && correo_lider.trim() !== '') ? correo_lider.trim() : 'Sin correo registrado',
                num_cajas: parseInt(num_cajas) || 0,
                num_maestros: maestros ? Object.keys(maestros).length : 0,
                estado_semaforo: 'verde',
                observacion_semaforo: 'Completo',
                notificado_whatsapp: false,
                concentrado_realizado: false
            }])
            .select().single();

        if (iglesiaError) throw new Error(iglesiaError.message);
        const iglesiaId = iglesiaData.id;

        if (maestros) {
            const maestrosArray = Object.values(maestros)
                .filter(m => m.nombre && m.nombre.trim() !== '')
                .map(m => ({
                    iglesia_id: iglesiaId,
                    nombre: m.nombre.trim(),
                    telefono: (m.telefono && m.telefono.trim() !== '') ? m.telefono.trim() : 'Sin teléfono',
                    correo: (m.correo && m.correo.trim() !== '') ? m.correo.trim() : 'Sin correo registrado'
                }));
            if (maestrosArray.length > 0) await supabase.from('maestros').insert(maestrosArray);
        }

        if (guerreritos) {
            const lista = Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos);
            const arr = lista.filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '').map(g => ({
                iglesia_id: iglesiaId,
                nombre_guerrerito: g.nombre_guerrerito.trim(),
                nombre_tutor: (g.nombre_tutor && g.nombre_tutor.trim() !== '') ? g.nombre_tutor.trim() : 'Sin tutor registrado',
                telefono_tutor: (g.telefono_tutor && g.telefono_tutor.trim() !== '') ? g.telefono_tutor.trim() : 'Sin teléfono'
            }));
            if (arr.length > 0) await supabase.from('guerreritos_oracion').insert(arr);
        }

        if (guerreros) {
            const lista = Array.isArray(guerreros) ? guerreros : Object.values(guerreros);
            const arr = lista.filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '').map(gu => ({
                iglesia_id: iglesiaId,
                nombre_guerrero: gu.nombre_guerrero.trim(),
                telefono_guerrero: (gu.telefono_guerrero && gu.telefono_guerrero.trim() !== '') ? gu.telefono_guerrero.trim() : 'Sin teléfono'
            }));
            if (arr.length > 0) await supabase.from('guerreros_oracion').insert(arr);
        }

        res.send(`<!DOCTYPE html><html lang="es"><head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="bg-light d-flex align-items-center justify-content-center vh-100"><div class="card p-4 text-center shadow-sm" style="max-width: 450px;"><h3 class="text-success mb-3">¡Registro Exitoso!</h3><p class="text-muted">Los datos se han guardado correctamente.</p><a href="/" class="btn btn-success mt-2">Regresar</a></div></body></html>`);
    } catch (err) {
        res.status(500).send('Error al procesar registro: ' + err.message);
    }
});

app.get('/editar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { data: iglesia } = await supabase.from('iglesias').select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`).eq('id', id).maybeSingle();
        if (!iglesia) return res.status(404).send('Registro no encontrado.');
        res.render('editar', { iglesia });
    } catch (err) {
        res.status(500).send('Error interno.');
    }
});

app.post('/actualizar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, estado_semaforo, observacion_semaforo, maestros, guerreritos, guerreros } = req.body;

        await supabase.from('iglesias').update({
            nombre_pastor: (nombre_pastor || '').trim(),
            telefono_pastor: (telefono_pastor || '').trim(),
            correo_pastor: (correo_pastor && correo_pastor.trim() !== '') ? correo_pastor.trim() : 'Sin correo registrado',
            nombre_iglesia: (nombre_iglesia && nombre_iglesia.trim() !== '') ? nombre_iglesia.trim() : 'Iglesia pendiente de asignar',
            direccion: (direccion && direccion.trim() !== '') ? direccion.trim() : 'Dirección pendiente de registrar',
            nombre_lider: (nombre_lider && nombre_lider.trim() !== '') ? nombre_lider.trim() : 'Sin líder registrado',
            telefono_lider: (telefono_lider && telefono_lider.trim() !== '') ? telefono_lider.trim() : 'Sin teléfono',
            correo_lider: (correo_lider && correo_lider.trim() !== '') ? correo_lider.trim() : 'Sin correo registrado',
            num_cajas: parseInt(num_cajas) || 0,
            estado_semaforo: estado_semaforo || 'verde',
            observacion_semaforo: (observacion_semaforo || '').trim() || 'Completo'
        }).eq('id', id);

        await supabase.from('maestros').delete().eq('iglesia_id', id);
        await supabase.from('guerreritos_oracion').delete().eq('iglesia_id', id);
        await supabase.from('guerreros_oracion').delete().eq('iglesia_id', id);

        if (maestros) {
            const arr = Object.values(maestros).filter(m => m.nombre && m.nombre.trim() !== '').map(m => ({
                iglesia_id: id,
                nombre: m.nombre.trim(),
                telefono: (m.telefono && m.telefono.trim() !== '') ? m.telefono.trim() : 'Sin teléfono',
                correo: (m.correo && m.correo.trim() !== '') ? m.correo.trim() : 'Sin correo registrado'
            }));
            if (arr.length > 0) await supabase.from('maestros').insert(arr);
        }

        if (guerreritos) {
            const lista = Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos);
            const arr = lista.filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '').map(g => ({
                iglesia_id: id,
                nombre_guerrerito: g.nombre_guerrerito.trim(),
                nombre_tutor: (g.nombre_tutor && g.nombre_tutor.trim() !== '') ? g.nombre_tutor.trim() : 'Sin tutor registrado',
                telefono_tutor: (g.telefono_tutor && g.telefono_tutor.trim() !== '') ? g.telefono_tutor.trim() : 'Sin teléfono'
            }));
            if (arr.length > 0) await supabase.from('guerreritos_oracion').insert(arr);
        }

        if (guerreros) {
            const lista = Array.isArray(guerreros) ? guerreros : Object.values(guerreros);
            const arr = lista.filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '').map(gu => ({
                iglesia_id: id,
                nombre_guerrero: gu.nombre_guerrero.trim(),
                telefono_guerrero: (gu.telefono_guerrero && gu.telefono_guerrero.trim() !== '') ? gu.telefono_guerrero.trim() : 'Sin teléfono'
            }));
            if (arr.length > 0) await supabase.from('guerreros_oracion').insert(arr);
        }

        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Error al actualizar el registro.');
    }
});

app.post('/actualizar-semaforo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado_semaforo, observacion_semaforo } = req.body;
        await supabase.from('iglesias').update({ estado_semaforo, observacion_semaforo: (observacion_semaforo || '').trim() || 'Sin observaciones' }).eq('id', id);
        res.redirect('/admin');
    } catch (err) { res.status(500).send('Error'); }
});

app.post('/eliminar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        await supabase.from('maestros').delete().eq('iglesia_id', id);
        await supabase.from('guerreritos_oracion').delete().eq('iglesia_id', id);
        await supabase.from('guerreros_oracion').delete().eq('iglesia_id', id);
        await supabase.from('miembros_comunidad').delete().eq('iglesia_id', id);
        await supabase.from('iglesias').delete().eq('id', id);
        res.redirect('/admin');
    } catch (err) { res.status(500).send('Error al eliminar'); }
});

app.get('/exportar-excel', async (req, res) => {
    try {
        const zonaActual = req.session.zona || 'GENERAL';
        const nombreZonaVisible = NOMBRES_ZONAS[zonaActual] || zonaActual;
        const { data: registros } = await supabase.from('iglesias').select(`*, maestros(*), guerreritos_oracion(*), guerreros_oracion(*)`).eq('zona', zonaActual);

        let htmlTabla = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><h3>Reporte de Zona: ${nombreZonaVisible}</h3><table border="1"><tr style="background-color: #009639; color: #ffffff; font-weight: bold;"><th>#</th><th>Estado Semáforo</th><th>Observación</th><th>Iglesia</th><th>Dirección</th><th>Pastor</th><th>Tel. Pastor</th><th>Líder</th><th>Tel. Líder</th><th>Cajitas</th><th>Concentrado</th></tr>`;

        (registros || []).forEach((reg, index) => {
            const concTexto = reg.concentrado_realizado ? 'REALIZADO' : 'NO REALIZADO';
            htmlTabla += `<tr><td>${index + 1}</td><td>${(reg.estado_semaforo || 'verde').toUpperCase()}</td><td>${reg.observacion_semaforo || 'Completo'}</td><td>${reg.nombre_iglesia}</td><td>${reg.direccion}</td><td>${reg.nombre_pastor}</td><td>${reg.telefono_pastor}</td><td>${reg.nombre_lider}</td><td>${reg.telefono_lider}</td><td>${reg.num_cajas}</td><td>${concTexto}</td></tr>`;
        });

        htmlTabla += `</table></body></html>`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_${nombreZonaVisible.replace(/\s+/g, '_')}.xls`);
        res.status(200).send(htmlTabla);
    } catch (err) { res.status(500).send('Error al exportar'); }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
