const { fetchQuestionByYear, getDataExams, getDisciplinesData, getQuestionsByOffset } = require("../services/apiService");
const fs = require("fs");
const PDFDocument = require('pdfkit');
const path = require("path");

async function getQuestionsNoModel(req, res) {
    try {
        const {discipline, year, limit} = req.body;
        console.log(year)
        const response = await getQuestionsByDiscipline(discipline, year, limit);
        const questions = response;
        
        const doc = new PDFDocument();
        
        // Configurar headers para download
        res.setHeader('Content-Disposition', 'attachment; filename="questoes-enem.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        
        // Pipe do PDF para a response
        doc.pipe(res);

        // Adicionar conteúdo ao PDF
        questions.forEach(question => {
            doc.fontSize(16).text(question.title, { underline: true });
            doc.moveDown(0.5);
            
            doc.fontSize(12).text(question.context);
            doc.moveDown(0.5);
            
            doc.fontSize(12).text(question.alternativesIntroduction);
            doc.moveDown(0.5);
            
            question.alternatives.forEach(alt => {
                doc.text(`${alt.letter}) ${alt.text}`);
            });
            
            doc.moveDown(1);
        });
        
        // Finalizar o PDF
        doc.end();

        // Adicionar um listener para o evento 'finish' no stream de resposta
        // Isso garante que a resposta só seja encerrada após todos os dados do PDF serem enviados
        res.on('finish', () => {
            console.log('PDF enviado com sucesso para o cliente.');
        });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
    });
    }

    
}

async function getYears(req, res) {
    try {

        const years = [];

        const response = await getDataExams();

        response.forEach((exam, index) => {
            years.push(exam.year);
        })

        res.json(years);

    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
        });
    }
}

async function getSubjects(req, res) {
    try {
        const { year } = req.query;

        const disciplines = [];
        const disciplinesValues = [];

        const response = await getDisciplinesData(year);

        response.disciplines.forEach((subject, index) => {
            disciplinesValues.push(subject.value);
            disciplines.push(subject.label);
        })
        response.languages.forEach((language, index) => {
            disciplines.push(language.label);
        })
        
        res.json([disciplines, disciplinesValues]);

    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
    });
    }
}

async function getQuestionsByDiscipline(discipline, year, limit) {
    try {

        let offset = "";
        let limitQuestions = 44;

        if (discipline == "linguagens") {
            offset = 6;
            limitQuestions = 39;
        } else if (discipline == "ciencias-humanas") {
            offset = 46;
        } else if (discipline == "ciencias-natureza") {
            offset = 91;
        } else if (discipline == "matematica") {
            offset = 136;
        } else {
            offset = 1
            limitQuestions = 10
        }
    
        const response = await getQuestionsByOffset(year, offset, limitQuestions);
        const bruteQuestions = response.questions;

        let randomNumbers = [];
        let randomNumber = 0;
        let questions = [];

        if (offset != 1 && limit <= 44) {
            for (let i = 0; i < limit; i++) {
                randomNumber = randomInt(offset, limitQuestions + offset);
                if (!randomNumbers.includes(randomNumber)) {
                    randomNumbers.push(randomNumber);
                } else {
                    i --;
                }
            }
        } else {
            if (limit < 5) {
                for (let i = 0; i < limit; i++) {
                    randomNumber = randomInt(offset, 5);
                    if (!randomNumbers.includes(randomNumber)) {
                        randomNumbers.push(randomNumber);
                    } else {
                        i --;
                    }
                }
            } else if (limit == 5) {
                for (let i = 0; i < 5; i++) {
                    randomNumbers.push(i);
                }
            } else {
                return res.status(500).json({ 
                    error: 'A quantidade de questões é superior a que existem no banco' 
                });
            }
        }

        let choosenNumbers = [];

        do {

            bruteQuestions.forEach((question, index) => {
                if (randomNumbers.includes(question.index)) {
                    if (!questions.includes(question)) {
                        questions.push(question);
                        choosenNumbers.push(question.index);
                    }
                } 
            });

            if (choosenNumbers.length < randomNumbers.length) {
                lengthRandom = randomNumbers.length;
                randomNumbers.forEach((number, index) => {
                    if (!choosenNumbers.includes(number)) {
                        randomNumbers.splice(index, 1);
                        while (randomNumbers.length < lengthRandom) {
                            randomNumber = randomInt(offset, limitQuestions + offset);
                            if (!randomNumbers.includes(randomNumber)) {
                                randomNumbers.push(randomNumber);
                                break;
                            }
                        }
                    }
                })
            }
            
        } while (questions.length < limit);

        return questions;


    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
        });
    }

}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { getQuestionsNoModel, getYears, getSubjects, getQuestionsByDiscipline };