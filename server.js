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
    secret: 'secreto_super_seguro_iglesia',
    resave: false,
    saveUninitialized: false
}));

// ESTADO GLOBAL DE LA APLICACIÓN (MANTENIMIENTO Y PAUSA)
let systemState = {
    status: 'active', // 'active', 'mantenimiento', 'fuera_tiempo'
    targetDate: null,  
    customMessage: ''
};

// MIDDLEWARE DE CONTROL DE ESTADO PÚBLICO
app.use((req, res, next) => {
    if (
        req.path.startsWith('/admin') ||
        req.path.startsWith('/dev-admin') ||
        req.path.startsWith('/login') ||
        req.path.startsWith('/logout') ||
        req.path.startsWith('/unirse-comunidad') ||
        req.path.startsWith('/procesar-unirse-comunidad') ||
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

// 3ª SECCIÓN: UNIRSE A LA COMUNIDAD Y GRUPOS DE WHATSAPP
app.get('/unirse-comunidad', async (req, res) => {
    try {
        const { data: iglesias } = await supabase.from('iglesias').select('id, nombre_iglesia, zona');
        res.render('unirse_comunidad', { iglesias: iglesias || [], registroExitoso: false, linkGrupo: null, rolSeleccionado: null });
    } catch (err) {
        res.status(500).send('Error al cargar la sección de comunidad: ' + err.message);
    }
});

app.post('/procesar-unirse-comunidad', async (req, res) => {
    try {
        const { nombre_completo, telefono, correo, rol, iglesia_id } = req.body;

        await supabase.from('miembros_comunidad').insert([{
            nombre_completo,
            telefono,
            correo: correo || null,
            rol,
            iglesia_id: iglesia_id ? parseInt(iglesia_id) : null
        }]);

        // Enlaces reales a tus grupos oficiales de WhatsApp
        const linksGrupos = {
            'pastor': 'https://chat.whatsapp.com/KgKlFqcwt2NFinwAvgqp22',
            'lider': 'https://chat.whatsapp.com/BlEFuksJSMuI5rrq7sfx6p',
            'maestro': 'https://chat.whatsapp.com/Io6FzfaTXeA3soWMb59dnW',
            'guerrero': 'https://chat.whatsapp.com/BlEFuksJSMuI5rrq7sfx6p' // Asignado a líderes por defecto o el que gustes
        };

        const linkCorrespondiente = linksGrupos[rol] || 'https://chat.whatsapp.com/KgKlFqcwt2NFinwAvgqp22';

        const { data: iglesias } = await supabase.from('iglesias').select('id, nombre_iglesia, zona');
        res.render('unirse_comunidad', { 
            iglesias: iglesias || [], 
            registroExitoso: true, 
            linkGrupo: linkCorrespondiente, 
            rolSeleccionado: rol,
            nombreUsuario: nombre_completo
        });

    } catch (err) {
        console.error('Error al registrar en comunidad:', err);
        res.status(500).send('Error al procesar el registro: ' + err.message);
    }
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

app.post('/dev-admin/cambiar-estado', (req, res) => {
    if (!req.session.isDev) return res.status(403).send('No autorizado');
    const { status, targetDate, customMessage } = req.body;
    systemState.status = status;
    systemState.targetDate = targetDate ? new Date(targetDate).getTime() : null;
    systemState.customMessage = customMessage || '';
    res.redirect('/dev-admin');
});

app.get('/dev-admin/logout', (req, res) => {
    req.session.isDev = false;
    res.redirect('/dev-admin');
});

// Inicio de Sesión (Zonas o Dev Console)
app.post('/login', (req, res) => {
    const { zona, password } = req.body;

    if (zona === 'dev_console') {
        if (password === 'dev2026') {
            req.session.isDev = true;
            return res.redirect('/admin');
        } else {
            return res.send(`<script>alert('Contraseña de Desarrollador incorrecta.');window.location.href = '/admin';</script>`);
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
        res.send(`<script>alert('Contraseña incorrecta.');window.location.href = '/admin';</script>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/admin'); });
});

app.get('/admin', async (req, res) => {
    try {
        const zonaActual = req.session.zona;
        if (!zonaActual) {
            return res.render('admin', { registros: [], zona: null, totalIglesias: 0, totalCajitas: 0, totalMaestros: 0, totalPastores: 0, totalGuerreritos: 0, totalGuerreros: 0 });
        }

        const { data: registros, error } = await supabase
            .from('iglesias')
            .select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`)
            .eq('zona', zonaActual);

        if (error) throw new Error(error.message);

        const totalIglesias = registros.length;
        const totalCajitas = registros.reduce((acc, curr) => acc + (parseInt(curr.num_cajas) || 0), 0);
        const totalMaestros = registros.reduce((acc, curr) => acc + (curr.maestros ? curr.maestros.length : 0), 0);
        const totalPastores = registros.filter(r => r.nombre_pastor && r.nombre_pastor.trim() !== '').length;
        const totalGuerreritos = registros.reduce((acc, curr) => acc + (curr.guerreritos_oracion ? curr.guerreritos_oracion.length : 0), 0);
        const totalGuerreros = registros.reduce((acc, curr) => acc + (curr.guerreros_oracion ? curr.guerreros_oracion.length : 0), 0);

        res.render('admin', { registros: registros || [], zona: zonaActual, totalIglesias, totalCajitas, totalMaestros, totalPastores, totalGuerreritos, totalGuerreros });
    } catch (err) {
        res.status(500).send('Error al cargar el panel: ' + err.message);
    }
});

app.post('/guardar-registro', async (req, res) => {
    try {
        const { zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, maestros, guerreritos, guerreros } = req.body;

        const { data: iglesiaData, error: iglesiaError } = await supabase
            .from('iglesias')
            .insert([{
                zona, nombre_pastor, telefono_pastor, correo_pastor: correo_pastor || null,
                nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider: correo_lider || null,
                num_cajas: parseInt(num_cajas) || 0, num_maestros: maestros ? Object.keys(maestros).length : 0,
                estado_semaforo: 'verde', observacion_semaforo: 'Completo'
            }])
            .select().single();

        if (iglesiaError) throw new Error('Error al guardar iglesia: ' + iglesiaError.message);
        const iglesiaId = iglesiaData.id;

        if (maestros) {
            const maestrosArray = Object.values(maestros).map(m => ({ iglesia_id: iglesiaId, nombre: m.nombre, telefono: m.telefono, correo: m.correo || null }));
            await supabase.from('maestros').insert(maestrosArray);
        }

        if (guerreritos) {
            const listaGuerreritos = Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos);
            const guerreritosArray = listaGuerreritos.map(g => ({ iglesia_id: iglesiaId, nombre_guerrerito: g.nombre_guerrerito, nombre_tutor: g.nombre_tutor, telefono_tutor: g.telefono_tutor })).filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '');
            if (guerreritosArray.length > 0) await supabase.from('guerreritos_oracion').insert(guerreritosArray);
        }

        if (guerreros) {
            const listaGuerreros = Array.isArray(guerreros) ? guerreros : Object.values(guerreros);
            const guerrerosArray = listaGuerreros.map(gu => ({ iglesia_id: iglesiaId, nombre_guerrero: gu.nombre_guerrero, telefono_guerrero: gu.telefono_guerrero })).filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '');
            if (guerrerosArray.length > 0) await supabase.from('guerreros_oracion').insert(guerrerosArray);
        }

        res.send(`<!DOCTYPE html><html lang="es"><head><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head><body class="bg-light d-flex align-items-center justify-content-center vh-100"><div class="card p-4 text-center shadow-sm" style="max-width: 450px;"><h3 class="text-success mb-3">¡Registro Exitoso!</h3><p class="text-muted">Los datos se han guardado correctamente.</p><a href="/" class="btn btn-success mt-2">Regresar</a></div></body></html>`);
    } catch (err) {
        res.status(500).send('Error al procesar: ' + err.message);
    }
});

app.get('/editar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { data: iglesia, error } = await supabase.from('iglesias').select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`).eq('id', id).maybeSingle();
        if (error || !iglesia) return res.status(404).send('Registro no encontrado.');
        res.render('editar', { iglesia });
    } catch (err) { res.status(500).send('Error interno: ' + err.message); }
});

app.post('/actualizar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, estado_semaforo, observacion_semaforo, maestros, guerreritos, guerreros } = req.body;

        await supabase.from('iglesias').update({ zona, nombre_pastor, telefono_pastor, correo_pastor: correo_pastor || null, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider: correo_lider || null, num_cajas: parseInt(num_cajas) || 0, estado_semaforo: estado_semaforo || 'verde', observacion_semaforo: observacion_semaforo || 'Completo' }).eq('id', id);

        if (maestros || guerreritos || guerreros) {
            await supabase.from('maestros').delete().eq('iglesia_id', id);
            await supabase.from('guerreritos_oracion').delete().eq('iglesia_id', id);
            await supabase.from('guerreros_oracion').delete().eq('iglesia_id', id);

            if (maestros) {
                const arr = Object.values(maestros).filter(m => m.nombre && m.nombre.trim() !== '').map(m => ({ iglesia_id: id, nombre: m.nombre, telefono: m.telefono, correo: m.correo || null }));
                if (arr.length > 0) await supabase.from('maestros').insert(arr);
            }
            if (guerreritos) {
                const arr = (Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos)).filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '').map(g => ({ iglesia_id: id, nombre_guerrerito: g.nombre_guerrerito, nombre_tutor: g.nombre_tutor, telefono_tutor: g.telefono_tutor }));
                if (arr.length > 0) await supabase.from('guerreritos_oracion').insert(arr);
            }
            if (guerreros) {
                const arr = (Array.isArray(guerreros) ? guerreros : Object.values(guerreros)).filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '').map(gu => ({ iglesia_id: id, nombre_guerrero: gu.nombre_guerrero, telefono_guerrero: gu.telefono_guerrero }));
                if (arr.length > 0) await supabase.from('guerreros_oracion').insert(arr);
            }
        }
        res.redirect('/admin');
    } catch (err) { res.status(500).send('Error al actualizar: ' + err.message); }
});

app.post('/actualizar-semaforo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado_semaforo, observacion_semaforo } = req.body;
        await supabase.from('iglesias').update({ estado_semaforo, observacion_semaforo: observacion_semaforo || 'Sin observaciones' }).eq('id', id);
        res.redirect('/admin');
    } catch (err) { res.status(500).send('Error al actualizar semáforo: ' + err.message); }
});

app.post('/eliminar-registro/:id', async (req, res) => {
    try {
        await supabase.from('iglesias').delete().eq('id', req.params.id);
        res.redirect('/admin');
    } catch (err) { res.status(500).send('Error al eliminar: ' + err.message); }
});

app.get('/exportar-excel', async (req, res) => {
    try {
        const zonaActual = req.session.zona || 'GENERAL';
        const { data: registros } = await supabase.from('iglesias').select(`*, maestros(*), guerreritos_oracion(*), guerreros_oracion(*)`).eq('zona', zonaActual);

        let htmlTabla = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><h3>Reporte de Zona: ${zonaActual}</h3><table border="1"><tr style="background-color: #009639; color: #ffffff; font-weight: bold;"><th>#</th><th>Estado Semáforo</th><th>Observación</th><th>Iglesia</th><th>Dirección</th><th>Pastor</th><th>Tel. Pastor</th><th>Líder</th><th>Tel. Líder</th><th>Cajitas</th></tr>`;

        registros.forEach((reg, index) => {
            htmlTabla += `<tr><td>${index + 1}</td><td>${(reg.estado_semaforo || 'verde').toUpperCase()}</td><td>${reg.observacion_semaforo || 'Completo'}</td><td>${reg.nombre_iglesia}</td><td>${reg.direccion}</td><td>${reg.nombre_pastor}</td><td>${reg.telefono_pastor}</td><td>${reg.nombre_lider}</td><td>${reg.telefono_lider}</td><td>${reg.num_cajas}</td></tr>`;
        });

        htmlTabla += `</table></body></html>`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_${zonaActual}.xls`);
        res.status(200).send(htmlTabla);
    } catch (err) { res.status(500).send('Error al exportar'); }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
