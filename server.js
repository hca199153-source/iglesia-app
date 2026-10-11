const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./db.js');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'secreto_super_seguro_iglesia',
    resave: false,
    saveUninitialized: false
}));

// Ruta Principal
app.get('/', (req, res) => {
    res.render('index');
});

// Inicio de Sesión
app.post('/login', (req, res) => {
    const { zona, password } = req.body;
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
app.get('/editar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).send('ID no válido.');

        const { data: iglesia, error } = await supabase
            .from('iglesias')
            .select(`*, maestros (*), guerreritos_oracion (*), guerreros_oracion (*)`)
            .eq('id', id)
            .maybeSingle();

        if (error || !iglesia) return res.status(404).send('Registro no encontrado.');

        res.render('editar', { iglesia });
    } catch (err) {
        res.status(500).send('Error interno: ' + err.message);
    }
});

// Actualizar Registro (Incluye actualización rápida del semáforo)
app.post('/actualizar-registro/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
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
            estado_semaforo,
            observacion_semaforo,
            maestros,
            guerreritos,
            guerreros
        } = req.body;

        const updateData = {
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
            estado_semaforo: estado_semaforo || 'verde',
            observacion_semaforo: observacion_semaforo || 'Completo'
        };

        const { error: iglesiaError } = await supabase
            .from('iglesias')
            .update(updateData)
            .eq('id', id);

        if (iglesiaError) throw new Error('Error al actualizar: ' + iglesiaError.message);

        // Si la petición viene de la vista /editar-registro reinsertamos tablas hijas
        if (maestros || guerreritos || guerreros) {
            await supabase.from('maestros').delete().eq('iglesia_id', id);
            await supabase.from('guerreritos_oracion').delete().eq('iglesia_id', id);
            await supabase.from('guerreros_oracion').delete().eq('iglesia_id', id);

            if (maestros) {
                const maestrosArray = Object.values(maestros)
                    .filter(m => m.nombre && m.nombre.trim() !== '')
                    .map(m => ({ iglesia_id: id, nombre: m.nombre, telefono: m.telefono, correo: m.correo || null }));
                if (maestrosArray.length > 0) await supabase.from('maestros').insert(maestrosArray);
            }

            if (guerreritos) {
                const listaGuerreritos = Array.isArray(guerreritos) ? guerreritos : Object.values(guerreritos);
                const guerreritosArray = listaGuerreritos
                    .filter(g => g.nombre_guerrerito && g.nombre_guerrerito.trim() !== '')
                    .map(g => ({ iglesia_id: id, nombre_guerrerito: g.nombre_guerrerito, nombre_tutor: g.nombre_tutor, telefono_tutor: g.telefono_tutor }));
                if (guerreritosArray.length > 0) await supabase.from('guerreritos_oracion').insert(guerreritosArray);
            }

            if (guerreros) {
                const listaGuerreros = Array.isArray(guerreros) ? guerreros : Object.values(guerreros);
                const guerrerosArray = listaGuerreros
                    .filter(gu => gu.nombre_guerrero && gu.nombre_guerrero.trim() !== '')
                    .map(gu => ({ iglesia_id: id, nombre_guerrero: gu.nombre_guerrero, telefono_guerrero: gu.telefono_guerrero }));
                if (guerrerosArray.length > 0) await supabase.from('guerreros_oracion').insert(guerrerosArray);
            }
        }

        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Error al actualizar: ' + err.message);
    }
});

// Ruta para actualizar ÚNICAMENTE el semáforo desde el modal flotante rápido
app.post('/actualizar-semaforo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado_semaforo, observacion_semaforo } = req.body;

        const { error } = await supabase
            .from('iglesias')
            .update({
                estado_semaforo,
                observacion_semaforo: observacion_semaforo || 'Sin observaciones'
            })
            .eq('id', id);

        if (error) throw new Error(error.message);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Error al actualizar semáforo: ' + err.message);
    }
});

// Eliminar Registro
app.post('/eliminar-registro/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await supabase.from('iglesias').delete().eq('id', id);
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Error al eliminar: ' + err.message);
    }
});

// Exportar a Excel
app.get('/exportar-excel', async (req, res) => {
    try {
        const zonaActual = req.session.zona || 'GENERAL';
        const { data: registros } = await supabase
            .from('iglesias')
            .select(`*, maestros(*), guerreritos_oracion(*), guerreros_oracion(*)`)
            .eq('zona', zonaActual);

        let htmlTabla = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>
            <h3>Reporte de Zona: ${zonaActual}</h3>
            <table border="1">
                <tr style="background-color: #009639; color: #ffffff; font-weight: bold;">
                    <th>#</th><th>Estado Semáforo</th><th>Observación / Faltante</th><th>Iglesia</th><th>Dirección</th><th>Pastor</th><th>Tel. Pastor</th><th>Correo Pastor</th><th>Líder</th><th>Tel. Líder</th><th>Correo Líder</th><th>Cajitas</th><th>Maestros</th><th>Guerreritos</th><th>Guerreros</th>
                </tr>`;

        registros.forEach((reg, index) => {
            let maestrosNombres = reg.maestros && reg.maestros.length > 0 ? reg.maestros.map(m => `${m.nombre} (${m.telefono})`).join('; ') : 'Sin maestros';
            let guerreritosNombres = reg.guerreritos_oracion && reg.guerreritos_oracion.length > 0 ? reg.guerreritos_oracion.map((g, idx) => `G${idx+1}: ${g.nombre_guerrerito}`).join(' | ') : 'Sin guerreritos';
            let guerrerosNombres = reg.guerreros_oracion && reg.guerreros_oracion.length > 0 ? reg.guerreros_oracion.map((gu, idx) => `A${idx+1}: ${gu.nombre_guerrero}`).join(' | ') : 'Sin guerreros';

            htmlTabla += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${(reg.estado_semaforo || 'verde').toUpperCase()}</td>
                    <td>${reg.observacion_semaforo || 'Completo'}</td>
                    <td>${reg.nombre_iglesia}</td>
                    <td>${reg.direccion}</td>
                    <td>${reg.nombre_pastor}</td>
                    <td>${reg.telefono_pastor}</td>
                    <td>${reg.correo_pastor || 'Sin correo'}</td>
                    <td>${reg.nombre_lider}</td>
                    <td>${reg.telefono_lider}</td>
                    <td>${reg.correo_lider || 'Sin correo'}</td>
                    <td>${reg.num_cajas}</td>
                    <td>${maestrosNombres}</td>
                    <td>${guerreritosNombres}</td>
                    <td>${guerrerosNombres}</td>
                </tr>`;
        });

        htmlTabla += `</table></body></html>`;

        res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_${zonaActual.replace(/\s+/g, '_')}.xls`);
        res.status(200).send(htmlTabla);
    } catch (err) {
        res.status(500).send('Error al exportar a Excel');
    }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
