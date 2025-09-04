const express = require("express");
const router = express.Router();
const { getQuestionsNoModel, getYears, getSubjects, getQuestionsByDiscipline } = require("../controllers/apiController");


router.post("/questions-nomodel", getQuestionsNoModel);
router.get("/getYears", getYears);
router.get("/getSubjects", getSubjects);
router.get("/getQuestions", getQuestionsByDiscipline);


module.exports = router;