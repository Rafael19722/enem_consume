const axios = require("axios");

async function fetchQuestionByYear(year, limit) {

    const response = await axios.get(`https://api.enem.dev/v1/exams/${year}/questions?limit=${limit}`)

    return response.data;
}

module.exports = { fetchQuestionByYear };