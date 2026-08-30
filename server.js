const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_samaritan_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Ruta principal (Formulario público)
app.get('/', (req, res) => {
  res.render('index', { error: null });
});

// Ruta POST para guardar el registro de la iglesia
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
      guerrero_nombre,
      guerrero_telefono,
      tutor_nombre,
      tutor_telefono
    } = req.body;

    const cajasInt = parseInt(num_cajas);
    let numMaestros = 2;
    if (cajasInt === 100) numMaestros = 3;
    if (cajasInt === 150) numMaestros = 4;

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
        num_cajas: cajasInt,
        num_maestros: numMaestros
      }])
      .select()
      .single();

    if (iglesiaError) throw iglesiaError;
    const iglesiaId = iglesiaData.id;

    if (maestros) {
      const maestrosArray = Object.values(maestros).map(m => ({
        iglesia_id: iglesiaId,
        nombre: m.nombre,
        telefono: m.telefono,
        correo: m.correo
      }));
      await supabase.from('maestros').insert(maestrosArray);
    }

    if (guerrerito_nombre) {
      await supabase.from('guerreritos_oracion').insert([{ iglesia_id: iglesiaId, nombre: guerrerito_nombre }]);
    }

    if (tutor_nombre) {
      await supabase.from('tutores').insert([{ iglesia_id: iglesiaId, nombre: tutor_nombre, telefono: tutor_telefono || 'N/A' }]);
    }

    res.send("<script>alert('¡Registro guardado exitosamente!'); window.location.href='/';</script>");
  } catch (error) {
    console.error("Error al guardar:", error);
    res.status(500).send("Error al procesar el registro: " + error.message);
  }
});

// Ruta GET para mostrar el Login de Administración
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Ruta POST para procesar el Login por Zona
app.post('/login', (req, res) => {
  const { zona, password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === adminPassword) {
    req.session.isAdmin = true;
    req.session.zona = zona;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Contraseña incorrecta. Intente de nuevo.' });
  }
});

// Ruta GET para el Panel de Administración (Filtrado por Zona)
app.get('/admin', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/login');
  }

  try {
    const zonaActual = req.session.zona;

    // Consultar exclusivamente las iglesias de la zona autenticada
    const { data: iglesias, error } = await supabase
      .from('iglesias')
      .select('*')
      .eq('zona', zonaActual)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.render('admin', { zona: zonaActual, iglesias: iglesias || [] });
  } catch (error) {
    console.error("Error al cargar panel admin:", error);
    res.status(500).send("Error al cargar los registros del panel.");
  }
});

// Ruta para Cerrar Sesión
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
