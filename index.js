const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Configuración de plantillas y middlewares
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Configuración de Sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_samaritan',
  resave: false,
  saveUninitialized: false
}));

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Middleware Auth Admin
const requiereAuth = (req, res, next) => {
  if (req.session && req.session.esAdmin) {
    return next();
  }
  res.redirect('/admin-login');
};

// Rutas
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/admin-login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.esAdmin = true;
    return res.redirect('/admin');
  }

  res.render('admin-login', { error: 'Contraseña incorrecta' });
});

app.get('/admin', requiereAuth, async (req, res) => {
  try {
    const { data: registros, error } = await supabase
      .from('registros')
      .select(`
        *,
        maestros (*),
        guerreros_oracion (*),
        guerreritos_oracion (*),
        tutores (*)
      `)
      .order('id', { ascending: true });

    if (error) throw error;

    res.render('admin', { registros: registros || [] });
  } catch (error) {
    console.error("Error al cargar registros en /admin:", error);
    res.render('admin', { registros: [] });
  }
});

// RUTA PARA GUARDAR EL FORMULARIO DE REGISTRO
app.post('/guardar', async (req, res) => {
  try {
    const {
      nombre_pastor, telefono_pastor, correo_pastor,
      nombre_iglesia, direccion,
      nombre_lider, telefono_lider, correo_lider,
      num_cajas,
      maestro_nombre, maestro_telefono, maestro_correo,
      guerreros_oracion_nombre, guerreros_oracion_telefono,
      guerreritos_oracion,
      tutores_nombre, tutores_telefono
    } = req.body;

    // 1. Insertar Registro Principal
    const { data: registro, error: errorReg } = await supabase
      .from('registros')
      .insert([{
        nombre_pastor, telefono_pastor, correo_pastor,
        nombre_iglesia, direccion,
        nombre_lider, telefono_lider, correo_lider,
        num_cajas: Number(num_cajas || 0)
      }])
      .select()
      .single();

    if (errorReg) throw errorReg;
    const registro_id = registro.id;

    // 2. Insertar Maestros
    if (maestro_nombre && Array.isArray(maestro_nombre)) {
      const maestrosData = maestro_nombre
        .map((nombre, i) => ({
          registro_id,
          nombre,
          telefono: maestro_telefono ? maestro_telefono[i] : '',
          correo: maestro_correo ? maestro_correo[i] : ''
        }))
        .filter(m => m.nombre && m.nombre.trim() !== '');

      if (maestrosData.length > 0) {
        await supabase.from('maestros').insert(maestrosData);
      }
    }

    // 3. Insertar Guerreros de Oración
    if (guerreros_oracion_nombre && Array.isArray(guerreros_oracion_nombre)) {
      const guerrerosData = guerreros_oracion_nombre
        .map((nombre, i) => ({
          registro_id,
          nombre,
          telefono: guerreros_oracion_telefono ? guerreros_oracion_telefono[i] : ''
        }))
        .filter(g => g.nombre && g.nombre.trim() !== '');

      if (guerrerosData.length > 0) {
        await supabase.from('guerreros_oracion').insert(guerrerosData);
      }
    }

    // 4. Insertar Guerreritos de Oración
    if (guerreritos_oracion && Array.isArray(guerreritos_oracion)) {
      const guerreritosData = guerreritos_oracion
        .filter(nombre => nombre && nombre.trim() !== '')
        .map(nombre => ({ registro_id, nombre }));

      if (guerreritosData.length > 0) {
        await supabase.from('guerreritos_oracion').insert(guerreritosData);
      }
    }

    // 5. Insertar Tutores
    if (tutores_nombre && Array.isArray(tutores_nombre)) {
      const tutoresData = tutores_nombre
        .map((nombre, i) => ({
          registro_id,
          nombre,
          telefono: tutores_telefono ? tutores_telefono[i] : ''
        }))
        .filter(t => t.nombre && t.nombre.trim() !== '');

      if (tutoresData.length > 0) {
        await supabase.from('tutores').insert(tutoresData);
      }
    }

    res.redirect('/?exito=true');
  } catch (err) {
    console.error("Error al guardar registro:", err);
    res.status(500).send("Error interno al procesar el registro.");
  }
});

app.delete('/eliminar/:id', requiereAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar dependencias
    await supabase.from('maestros').delete().eq('registro_id', id);
    await supabase.from('guerreros_oracion').delete().eq('registro_id', id);
    await supabase.from('guerreritos_oracion').delete().eq('registro_id', id);
    await supabase.from('tutores').delete().eq('registro_id', id);

    // Eliminar registro padre
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error servidor:", err);
    return res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
