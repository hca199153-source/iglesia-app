const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la base de datos PostgreSQL (compatible con Supabase / Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

// Configuración de EJS y Middlewares
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// RUTAS DE LA APLICACIÓN
// ==========================================

// 1. Formulario Principal de Registro
app.get('/', (req, res) => {
  res.render('index', { mensaje: null, error: null });
});

// 2. Guardar Registro (Iglesia + Maestros de forma Transaccional)
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

    // Insertar la iglesia incluyendo la zona
    const queryIglesia = `
      INSERT INTO registros_iglesias 
      (zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;
    const valuesIglesia = [
      zona, nombre_pastor, telefono_pastor, correo_pastor,
      nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas
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
          await client.query(queryMaestro, [iglesiaId, nombres[i], telefonos[i], correos[i]]);
        }
      }
    }

    await client.query('COMMIT');
    res.render('index', { mensaje: '¡Registro guardado exitosamente!', error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar el registro:', err);
    res.render('index', { mensaje: null, error: 'Hubo un error al procesar el registro. Inténtalo de nuevo.' });
  } finally {
    client.release();
  }
});

// 3. Vista de Login para Administración
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 4. Procesar Login
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASS || 'SecretoAdmin2026';

  if (password === adminPass) {
    // Redirección simple al panel (en producción se recomienda usar sesiones o JWT)
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Contraseña incorrecta. Inténtalo nuevamente.' });
  }
});

// 5. Panel de Administración (Listado de Registros)
app.get('/admin', async (req, res) => {
  try {
    const queryIglesias = `
      ri.*, 
      COALESCE(
        json_agg(
          json_build_object('id', m.id, 'nombre', m.nombre, 'telefono', m.telefono, 'correo', m.correo)
        ) FILTER (WHERE m.id IS NOT NULL), '[]'
      ) as maestros
    FROM registros_iglesias ri
    LEFT JOIN maestros m ON ri.id = m.iglesia_id
    GROUP BY ri.id
    ORDER BY ri.fecha_creacion DESC;
  `;
    const result = await pool.query(queryIglesias);
    res.render('admin', { iglesias: result.rows });
  } catch (err) {
    console.error('Error al cargar el panel de administración:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// 6. Eliminar Registro
app.post('/admin/eliminar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Gracias a la restricción ON DELETE CASCADE en la base de datos, 
    // al borrar la iglesia se eliminan automáticamente sus maestros asociados.
    await pool.query('DELETE FROM registros_iglesias WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error al eliminar el registro:', err);
    res.status(500).send('Error al eliminar el registro');
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
