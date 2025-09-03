const express = require("express");
const router = express.Router();
const { getQuestionsNoModel, getYears, getSubjects } = require("../controllers/apiController");


router.post("/questions-nomodel", getQuestionsNoModel);
router.get("/getYears", getYears);
router.get("/getSubjects", getSubjects);


module.exports = router;