const express = require("express");
const router = express.Router();
const { getQuestionsNoModel, getYears, getSubjects, getQuestionsByDiscipline, verifyQuestions } = require("../controllers/apiController");


router.post("/questions-nomodel", getQuestionsNoModel);
router.get("/getYears", getYears);
router.get("/getSubjects", getSubjects);
router.get("/getQuestions", getQuestionsByDiscipline);
router.get("/verifyQuestions", verifyQuestions);


module.exports = router;