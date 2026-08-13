const express = require('express');
const path = require('path');
const app = express();

// Configuración del motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔴 SERVIR ARCHIVOS ESTÁTICOS (imágenes, CSS, etc. desde /public)
app.use(express.static(path.join(__dirname, 'public')));

// Ruta Principal (Formulario de Registro)
app.get('/', (req, res) => {
  res.render('index', { 
    mensajeExito: null, 
    mensajeError: null 
  });
});

// Ruta para Guardar el Formulario
app.post('/guardar', async (req, res) => {
  try {
    // Aquí va la lógica de inserción en tu BD (ej. Supabase)
    res.render('index', { 
      mensajeExito: '¡Registro guardado con éxito!', 
      mensajeError: null 
    });
  } catch (error) {
    res.render('index', { 
      mensajeExito: null, 
      mensajeError: 'Ocurrió un error al guardar los datos.' 
    });
  }
});

// Puerto del Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
