const { fetchQuestionByYear, getDataExams, getDisciplinesData } = require("../services/apiService");
const fs = require("fs");
const PDFDocument = require('pdfkit');
const path = require("path");

async function getQuestionsNoModel(req, res) {
    try {
        const {year, limit} = req.body;
        console.log(year)
        const response = await fetchQuestionByYear(year, limit);
        const questions = response.questions;
        
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

module.exports = { getQuestionsNoModel, getYears, getSubjects };