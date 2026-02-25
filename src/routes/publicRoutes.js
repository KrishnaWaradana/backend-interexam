const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

router.get("/coba-gratis", publicController.getDemoPackages);

module.exports = router;
