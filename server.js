const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de motor de vistas y carpetas estáticas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de sesiones para el login de administradores
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_samaritan_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Cambiar a true si usas HTTPS estricto en producción
}));

// Ruta principal provisional (Formulario público)
app.get('/', (req, res) => {
  res.render('index', { error: null });
});

// Ruta de Login para Administradores
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
