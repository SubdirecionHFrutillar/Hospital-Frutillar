// Datos de compilación: versión para invalidar caché de CSS/JS y año para el pie de página.
module.exports = () => ({
  version: Date.now().toString(36),
  year: new Date().getFullYear(),
});
