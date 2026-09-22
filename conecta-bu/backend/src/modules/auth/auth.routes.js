const { Router } = require("express");
const { loginGoogle, me, logout } = require("./auth.controller");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireFields } = require("../../common/validators/validate");

const router = Router();

// RF-001
router.post("/google", requireFields(["idToken"]), loginGoogle);

// RF-002
router.get("/me", authMiddleware, me);
router.post("/logout", authMiddleware, logout);

module.exports = router;
