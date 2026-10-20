// Pasa a next() los errores de un manejador async (Express 4 no lo hace solo).
const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

module.exports = { manejar };
