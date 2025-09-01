const { fetchQuestionByYear } = require("../services/apiService");
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun } = require("docx");
const path = require("path");

async function getQuestions(req, res) {
    try {
        const file = req.file;

        if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado"});

        const data = req.body.data ? JSON.parse(req.body.data) : {};

        const year = data.year;
        const limit = data.limit;
        const response = await fetchQuestionByYear(year, limit);

        console.log("olá");

        const questions = response.questions;

        const text = fs.readFileSync(file.path, "utf-8");

        let processedText = text;
        const matches = processedText.match(/:(?=\s)/g) || [];
        
        if (matches.length !== questions.length) {
            console.warn(`Aviso: ${matches.length} marcadores encontrados, mas ${questions.length} questões disponíveis`);
        }

        // Substitui cada : pelo contexto da questão correspondente
        for (let i = 0; i < Math.min(matches.length, questions.length); i++) {
            processedText = processedText.replace(/:(?=\s)/, questions[i].context);
        }

        // Cria o documento
        const doc = new Document({
            creator: "Enem",
            title: "Questões ENEM",
            description: `Questões do ENEM ${year}`,
            sections: []
        });

        doc.addSection({
            properties: {},
            children: [
                new Paragraph({
                    text: "Questões Processadas",
                    heading: "Title"
                }),
                new Paragraph({
                    text: processedText
                })
            ],
        });

        const buffer = await Packer.toBuffer(doc);
        
        fs.unlinkSync(file.path);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": "attachment; filename=processado.docx",
        });

        res.send(buffer);

    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            error: 'Erro interno',
            message: error.message 
    });
    }
}

module.exports = { getQuestions };