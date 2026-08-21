const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_super_seguro_123',
  resave: false,
  saveUninitialized: false
}));

// Middleware para verificar autenticación
function requerirAuth(req, res, next) {
  if (req.session && req.session.esAdmin) {
    return next();
  }
  res.redirect('/login');
}

// RUTA PRINCIPAL
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// LOGIN ADMIN
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === adminPassword) {
    req.session.esAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Contraseña incorrecta' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// GUARDAR REGISTRO
app.post('/guardar', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      nombre_pastor, telefono_pastor, correo_pastor,
      nombre_iglesia, direccion, num_cajas,
      nombre_lider, telefono_lider, correo_lider,
      maestro_nombre, maestro_telefono, maestro_correo
    } = req.body;

    await client.query('BEGIN');

    const resRegistro = await client.query(
      `INSERT INTO registros 
       (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, num_cajas, nombre_lider, telefono_lider, correo_lider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        nombre_pastor || null, telefono_pastor || null, correo_pastor || null,
        nombre_iglesia || null, direccion || null, parseInt(num_cajas, 10) || 50,
        nombre_lider || null, telefono_lider || null, correo_lider || null
      ]
    );

    const registroId = resRegistro.rows[0].id;

    let nombres = Array.isArray(maestro_nombre) ? maestro_nombre : (maestro_nombre ? [maestro_nombre] : []);
    let telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : (maestro_telefono ? [maestro_telefono] : []);
    let correos = Array.isArray(maestro_correo) ? maestro_correo : (maestro_correo ? [maestro_correo] : []);

    for (let i = 0; i < nombres.length; i++) {
      if (nombres[i] && nombres[i].trim() !== '') {
        await client.query(
          `INSERT INTO maestros (registro_id, nombre, telefono, correo) VALUES ($1, $2, $3, $4)`,
          [registroId, nombres[i] || null, telefonos[i] || null, correos[i] || null]
        );
      }
    }

    await client.query('COMMIT');
    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error SQL al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: `Error en BD: ${error.message}` });
  } finally {
    client.release();
  }
});

// PANEL ADMIN (Protegido con requerirAuth)
app.get('/admin', requerirAuth, async (req, res) => {
  try {
    const query = `
      SELECT r.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'nombre', m.nombre, 
                   'telefono', m.telefono, 
                   'correo', m.correo
                 )
               ) FILTER (WHERE m.id IS NOT NULL), '[]'
             ) as maestros
      FROM registros r
      LEFT JOIN maestros m ON r.id = m.registro_id
      GROUP BY r.id
      ORDER BY r.id ASC
    `;
    const result = await pool.query(query);
    res.render('admin', { registros: result.rows });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

// ELIMINAR REGISTRO
app.post('/eliminar/:id', requerirAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM registros WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Error al eliminar:", err);
    res.redirect('/admin');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
