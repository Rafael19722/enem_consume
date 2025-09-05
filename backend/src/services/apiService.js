const axios = require("axios");

async function fetchQuestionByYear(year, limit) {

    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}/questions?limit=${limit}`)

    return response.data;
}

async function getDataExams() {
    const response = await axios.get('https://api.enem.dev/v1/exams');

    return response.data;
}

async function getDisciplinesData(year) {
    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}`)

    return response.data;
}

async function getQuestionsByOffset(year, offset, limitQuestions) {
    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}/questions?offset=${offset}&limit=${limitQuestions}`)

    return response.data;
}

async function getQuestionsByLanguage(year, language) {
    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}/questions?language=${language}&limit=10`);

    return response.data;
}

module.exports = { fetchQuestionByYear, getDataExams, getDisciplinesData,  getQuestionsByOffset, getQuestionsByLanguage};