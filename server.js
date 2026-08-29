const express = require('express');
const session = require('express-session');
const path = require('path');
const supabase = require('./db'); // Importamos la conexión centralizada
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de motor de vistas y carpetas estáticas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de sesiones
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

// Ruta POST para recibir y guardar el formulario en Supabase
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
      maestros, // Objeto/Array de maestros dinámicos
      guerrerito_nombre,
      guerrero_nombre,
      guerrero_telefono,
      tutor_nombre,
      tutor_telefono
    } = req.body;

    // 1. Calcular el número de maestros obligatorio según reglas de negocio
    const cajasInt = parseInt(num_cajas);
    let numMaestros = 2;
    if (cajasInt === 100) numMaestros = 3;
    if (cajasInt === 150) numMaestros = 4;

    // 2. Insertar en la tabla principal 'iglesias'
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

    // 3. Insertar los maestros asociados
    if (maestros) {
      const maestrosArray = Object.values(maestros).map(m => ({
        iglesia_id: iglesiaId,
        nombre: m.nombre,
        telefono: m.telefono,
        correo: m.correo
      }));

      const { error: maestrosError } = await supabase
        .from('maestros')
        .insert(maestrosArray);

      if (maestrosError) throw maestrosError;
    }

    // 4. Insertar Guerrerito de Oración (si se llenó)
    if (guerrerito_nombre) {
      await supabase.from('guerreritos_oracion').insert([{
        iglesia_id: iglesiaId,
        nombre: guerrerito_nombre
      }]);
    }

    // 5. Insertar Tutor (si se llenó)
    if (tutor_nombre) {
      await supabase.from('tutores').insert([{
        iglesia_id: iglesiaId,
        nombre: tutor_nombre,
        telefono: tutor_telefono || 'N/A'
      }]);
    }

    // Redirigir o mostrar éxito (por ahora renderizamos la misma vista con mensaje)
    res.send("<script>alert('¡Registro guardado exitosamente!'); window.location.href='/';</script>");

  } catch (error) {
    console.error("Error al guardar registro:", error);
    res.status(500).send("Ocurrió un error al procesar el registro en la base de datos: " + error.message);
  }
});

// Ruta de Login para Administradores
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
