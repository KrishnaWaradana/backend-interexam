const express = require("express");
const router = express.Router();
const landingController = require("../controllers/landingController");

router.get("/pakets", landingController.getPublicPackages);

module.exports = router;
