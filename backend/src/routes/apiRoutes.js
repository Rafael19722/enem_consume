const express = require("express");
const multer = require("multer");
const router = express.Router();
const { getQuestions } = require("../controllers/apiController");

const upload = multer({ dest: "uploads/" });

router.post("/questions", upload.single("file"), getQuestions);

module.exports = router;