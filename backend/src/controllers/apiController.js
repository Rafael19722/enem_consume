const { fetchQuestionByYear, getDataExams, getDisciplinesData, getQuestionsByOffset, getQuestionsByLanguage } = require("../services/apiService");
const fs = require("fs");
const PDFDocument = require('pdfkit');
const sizeOf = require('image-size').default;
const axios = require('axios');
const https = require('https');
const path = require("path");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getQuestionsNoModel(req, res) {

    try {
        const { questions } = req.body;
        
        const doc = new PDFDocument();
        
        res.setHeader('Content-Disposition', 'attachment; filename="questoes-enem.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        
        doc.pipe(res);

        for (const question of questions) {
            doc.fontSize(16).text(question.title, { underline: true });
            doc.moveDown(0.5);
            
            const imageUrl = extractImageUrl(question.context);
            
            if (imageUrl) {
                doc.fontSize(12).text(removeLastLine(question.context));
                doc.moveDown(0.5);
                await addImageToPDF(doc, imageUrl);
            } else if (question.context) {
                doc.fontSize(12).text(question.context);
                doc.moveDown(0.5);
            }

            /*if (question.files) {
                const imageUrl = extractImageUrl(question.files);
                await addImageToPDF(doc, imageUrl);
            }*/
            
            if (question.alternativesIntroduction) {
                doc.fontSize(12).text(question.alternativesIntroduction);
                doc.moveDown(0.5);
            }
            
            // Use for...of para alternativas também
            for (const alt of question.alternatives) {
                const altImageUrl = extractImageUrl(alt.file);
                const verifyAlternative = true;
                if (altImageUrl) {
                    doc.text(`${alt.letter}) `);
                    await addImageToPDF(doc, altImageUrl, verifyAlternative);
                } else {
                    doc.text(`${alt.letter}) ${alt.text}`);
                }
                doc.moveDown(0.3);
            }
            
            doc.moveDown(1);
            doc.addPage(); // Adiciona nova página para próxima questão
        }
        
        doc.end();

        doc.on('end', () => {
            console.log('PDF gerado com sucesso para o cliente.');
        });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
        });
    }
}

function extractImageUrl(text) {
    if (!text || typeof text !== 'string') return null;
    
    // Para Markdown: ![](url)
    const markdownMatch = text.match(/!\[.*?\]\((.*?)\)/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1];
    }
    
    // Verificar se é URL de imagem direta
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const isDirectImageUrl = imageExtensions.some(ext => 
        text.toLowerCase().includes(ext.toLowerCase())
    );
    
    if (isDirectImageUrl) {
        return text;
    }
    
    return null;
}

async function addImageToPDF(doc, imageUrl, verifyAlternative = false) {
    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            httpsAgent: httpsAgent,
            timeout: 10000
        });

        const imageBuffer = Buffer.from(response.data);

        const dimensions = sizeOf(imageBuffer);
        
        // Adicionar imagem com tamanho apropriado
        if (verifyAlternative) {
            doc.image(imageBuffer, {
                width: dimensions.width,
                height: 50
            });
        } else {
            doc.image(imageBuffer, {
                width: dimensions.width,
                height: dimensions.height
            });
        }
        
        doc.moveDown(0.5);
        
    } catch (error) {
        console.error('Erro ao carregar imagem:', imageUrl, error);
        doc.text(`[Imagem não carregada: ${imageUrl}]`);
    }
}

function removeLastLine(text) {
    const lines = text.split('\n');
    lines.pop(); 
    return lines.join('\n');
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

async function getQuestionsByDiscipline(filter) {
    try {

        let discipline = filter.discipline;
        let year = filter.year;
        let limit = filter.limit;

        let randomNumbers = [];
        let randomNumber = 0;
        let questions = [];
        let err = {};

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
                return 15;
            }
        }

        let choosenNumbers = [];

        do {

            bruteQuestions.forEach((question, index) => {
                if (randomNumbers.includes(question.index)) {
                    if (question.language) {
                        if (question.language == discipline) {
                            if (!questions.includes(question)) {
                                questions.push(question);
                                choosenNumbers.push(question.index);
                            }
                        }
                    } else {
                        if (!questions.includes(question)) {
                            questions.push(question);
                            choosenNumbers.push(question.index);
                        }
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

async function verifyQuestions(req, res) {
    try {
        let {discipline, year} = req.query;

        if (discipline == "Inglês") {
            discipline = "ingles";
        } else if (discipline == "Espanhol") {
            discipline = "espanhol";
        }
    
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
        } else if (discipline == "ingles" || discipline == "espanhol") {
            offset = 1
            limitQuestions = 5
        }

        let questions = [];
        let bruteQuestions;
        let response;

        if (discipline != "ingles" && discipline != "espanhol") {
            const response = await getQuestionsByOffset(year, offset, limitQuestions);

            bruteQuestions = response.questions;

            bruteQuestions.forEach((question, index) => {
                if (question.discipline == discipline) {
                    questions.push(question);
                } 
            });

        } else {
            const response = await getQuestionsByLanguage(year, discipline);

            bruteQuestions = response.questions;

            bruteQuestions.forEach((question, index) => {
                if (question.language == discipline) {
                    questions.push(question);
                } 
            });
        }
            
    
        return res.json(questions);

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

module.exports = { getQuestionsNoModel, getYears, getSubjects, getQuestionsByDiscipline, verifyQuestions };