const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos PostgreSQL (Render / Local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Simulación simple de sesión (En producción usar express-session)
let adminAutenticado = false;

// 1. Ruta Principal: Formulario de Registro
app.get('/', (req, res) => {
  res.render('index', { mensaje: null });
});

// 2. Ruta para Guardar Registro (Transaccional)
app.post('/guardar', async (req, res) => {
  const {
    zona,
    nombre_pastor, telefono_pastor, correo_pastor,
    nombre_iglesia, direccion,
    nombre_lider, telefono_lider, correo_lider,
    num_cajas,
    maestro_nombre, maestro_telefono, maestro_correo
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insertar la iglesia principal incluyendo la zona
    const queryIglesia = `
      INSERT INTO registros_iglesias 
      (zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id;
    `;
    const valuesIglesia = [
      zona,
      nombre_pastor, telefono_pastor, correo_pastor || '',
      nombre_iglesia, direccion,
      nombre_lider, telefono_lider, correo_lider || '',
      num_cajas
    ];

    const resultIglesia = await client.query(queryIglesia, valuesIglesia);
    const iglesiaId = resultIglesia.rows[0].id;

    // Insertar maestros asociados (si existen)
    if (maestro_nombre) {
      const nombres = Array.isArray(maestro_nombre) ? maestro_nombre : [maestro_nombre];
      const telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : [maestro_telefono];
      const correos = Array.isArray(maestro_correo) ? maestro_correo : [maestro_correo];

      for (let i = 0; i < nombres.length; i++) {
        if (nombres[i].trim() !== '') {
          const queryMaestro = `
            INSERT INTO maestros (iglesia_id, nombre, telefono, correo) 
            VALUES ($1, $2, $3, $4);
          `;
          await client.query(queryMaestro, [iglesiaId, nombres[i], telefonos[i], correos[i] || '']);
        }
      }
    }

    await client.query('COMMIT');
    res.render('index', { mensaje: '¡Registro guardado exitosamente!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar el registro:', error);
    res.render('index', { mensaje: 'Hubo un error al procesar el registro. Intente nuevamente.' });
  } finally {
    client.release();
  }
});

// 3. Ruta Vista de Login de Administrador
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 4. Ruta Procesar Login
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const passwordAdminSecreta = process.env.ADMIN_PASS || 'admin123'; // Cambiar en producción

  if (password === passwordAdminSecreta) {
    adminAutenticado = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Contraseña incorrecta. Intente de nuevo.' });
  }
});

// 5. Ruta Panel de Administración (Protegida)
app.get('/admin', async (req, res) => {
  if (!adminAutenticado) {
    return res.redirect('/login');
  }

  try {
    // Obtener iglesias
    const iglesiasResult = await pool.query('SELECT * FROM registros_iglesias ORDER BY fecha_registro DESC');
    const iglesias = iglesiasResult.rows;

    // Obtener maestros
    const maestrosResult = await pool.query('SELECT * FROM maestros');
    const maestros = maestrosResult.rows;

    res.render('admin', { iglesias, maestros });
  } catch (error) {
    console.error('Error al cargar el panel administrativo:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// 6. Ruta Eliminar Registro
app.post('/admin/eliminar/:id', async (req, res) => {
  if (!adminAutenticado) {
    return res.redirect('/login');
  }

  const { id } = req.params;
  try {
    // Gracias a ON DELETE CASCADE configurado en SQL, se borran los maestros automáticamente
    await pool.query('DELETE FROM registros_iglesias WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).send('Error al eliminar el registro');
  }
});

// 7. Ruta Cerrar Sesión
app.get('/logout', (req, res) => {
  adminAutenticado = false;
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
