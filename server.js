const express = require('express');
const session = require('express-session');
const path = require('path');
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

// ESTADO GLOBAL DE LA APLICACIÓN
let systemState = {
    status: 'active', // 'active', 'mantenimiento', 'fuera_tiempo'
    targetDate: null,  
    customMessage: ''
};

// MIDDLEWARE DE CONTROL DE ESTADO PÚBLICO Y SEGURIDAD
app.use((req, res, next) => {
    const rutasLibres = ['/admin', '/admin-comunidad', '/dev-admin', '/dev-admin/login', '/login', '/logout', '/unirse-comunidad', '/procesar-unirse-comunidad', '/public', '/images', '/css'];
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
        let iglesiaIdEncontrada = null;

        if (telLimpio.length >= 10) {
            const { data: iglesiasMatch } = await supabase.from('iglesias').select('id, telefono_pastor, telefono_lider');
            if (iglesiasMatch) {
                const encontrada = iglesiasMatch.find(i => {
                    const telP = (i.telefono_pastor || '').replace(/\D/g, '');
                    const telL = (i.telefono_lider || '').replace(/\D/g, '');
                    return (telP && telP.endsWith(telLimpio.slice(-10))) || (telL && telL.endsWith(telLimpio.slice(-10)));
                });
                if (encontrada) iglesiaIdEncontrada = encontrada.id;
            }

            if (!iglesiaIdEncontrada) {
                const { data: maestrosMatch } = await supabase.from('maestros').select('iglesia_id, telefono');
                if (maestrosMatch) {
                    const maestroEncontrado = maestrosMatch.find(m => {
                        const telM = (m.telefono || '').replace(/\D/g, '');
                        return telM && telM.endsWith(telLimpio.slice(-10));
                    });
                    if (maestroEncontrado) iglesiaIdEncontrada = maestroEncontrado.iglesia_id;
                }
            }
        }

        if (!iglesiaIdEncontrada) {
            return res.render('unirse_comunidad', { 
                registroExitoso: false, 
                linkGrupo: null, 
                rolSeleccionado: rol,
                nombreUsuario: null,
                errorMensaje: 'Número no válido o no registrado en el sistema previo.'
            });
        }

        await supabase.from('miembros_comunidad').insert([{
            nombre_completo: (nombre_completo || '').trim(),
            telefono: telLimpio,
            correo: (correo && correo.trim() !== '') ? correo.trim() : 'Sin correo registrado',
            rol,
            iglesia_id: iglesiaIdEncontrada
        }]);

        const linksGrupos = {
            'pastor': 'https://chat.whatsapp.com/KgKlFqcwt2NFinwAvgqp22',
            'lider': 'https://chat.whatsapp.com/BlEFuksJSMuI5rrq7sfx6p',
            'maestro': 'https://chat.whatsapp.com/Io6FzfaTXeA3soWMb59dnW',
            'guerrero': 'https://chat.whatsapp.com/DFETFvqOMHLCDLIuTag7AT'
        };

        res.render('unirse_comunidad', { 
            registroExitoso: true, 
            linkGrupo: linksGrupos[rol] || linksGrupos['pastor'], 
            rolSeleccionado: rol,
            nombreUsuario: nombre_completo,
            errorMensaje: null
        });
    } catch (err) {
        console.error('Error al registrar en comunidad:', err);
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
// PANEL DE PROGRAMADOR (DEV-ADMIN)
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
        res.render('dev_login', { error: 'Contraseña de desarrollador incorrecta.' });
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
            return res.redirect('/dev-admin');
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
        "carlos_a_carrillo": "carlos2026"
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
        if (!zonaActual) return res.render('admin', { registros: [], zona: null, totalIglesias: 0, totalCajitas: 0, totalMaestros: 0, totalPastores: 0, totalGuerreritos: 0, totalGuerreros: 0 });

        const { data: registros } = await supabase.from('iglesias').select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`).eq('zona', zonaActual);

        const regs = registros || [];
        res.render('admin', { 
            registros: regs, 
            zona: zonaActual, 
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

// GUARDAR REGISTRO (CON MANEJO SEGURO DE CAMPOS OPCIONALES)
app.post('/guardar-registro', async (req, res) => {
    try {
        const { zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, maestros, guerreritos, guerreros } = req.body;

        const { data: iglesiaData, error: iglesiaError } = await supabase
            .from('iglesias')
            .insert([{
                zona: (zona && zona.trim() !== '') ? zona : 'san_andres', 
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
                notificado_whatsapp: false
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

// ACTUALIZAR REGISTRO
app.post('/actualizar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, estado_semaforo, observacion_semaforo, maestros, guerreritos, guerreros } = req.body;

        await supabase.from('iglesias').update({ 
            zona, 
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
        console.error("Error al actualizar:", err);
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
        const { data: registros } = await supabase.from('iglesias').select(`*, maestros(*), guerreritos_oracion(*), guerreros_oracion(*)`).eq('zona', zonaActual);

        let htmlTabla = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><h3>Reporte de Zona: ${zonaActual}</h3><table border="1"><tr style="background-color: #009639; color: #ffffff; font-weight: bold;"><th>#</th><th>Estado Semáforo</th><th>Observación</th><th>Iglesia</th><th>Dirección</th><th>Pastor</th><th>Tel. Pastor</th><th>Líder</th><th>Tel. Líder</th><th>Cajitas</th></tr>`;

        (registros || []).forEach((reg, index) => {
            htmlTabla += `<tr><td>${index + 1}</td><td>${(reg.estado_semaforo || 'verde').toUpperCase()}</td><td>${reg.observacion_semaforo || 'Completo'}</td><td>${reg.nombre_iglesia}</td><td>${reg.direccion}</td><td>${reg.nombre_pastor}</td><td>${reg.telefono_pastor}</td><td>${reg.nombre_lider}</td><td>${reg.telefono_lider}</td><td>${reg.num_cajas}</td></tr>`;
        });

        htmlTabla += `</table></body></html>`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_${zonaActual}.xls`);
        res.status(200).send(htmlTabla);
    } catch (err) { res.status(500).send('Error al exportar'); }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
