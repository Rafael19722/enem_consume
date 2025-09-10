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
        const margin = 40;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const columnWidth = (pageWidth - (margin * 3)) / 2;

        res.setHeader('Content-Disposition', 'attachment; filename="questoes-enem.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        // Configurações de fonte
        doc.font('Helvetica');
        
        let leftY = margin;
        let rightY = margin;

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            // Decide em qual coluna tentar primeiro
            const leftSpace = pageHeight - margin - leftY;
            const rightSpace = pageHeight - margin - rightY;
            let useLeftColumn = leftSpace >= rightSpace;
            
            let x = useLeftColumn ? margin : margin + columnWidth + margin;
            let currentY = useLeftColumn ? leftY : rightY;

            // 🔹 Estimar altura da questão antes
            const estimatedHeight = await estimateQuestionHeight(doc, question, columnWidth);

            // Se não couber na coluna atual, tenta a outra
            if (currentY + estimatedHeight > pageHeight - margin) {
                useLeftColumn = !useLeftColumn;
                x = useLeftColumn ? margin : margin + columnWidth + margin;
                currentY = useLeftColumn ? leftY : rightY;

                // Se ainda assim não couber, cria nova página
                if (currentY + estimatedHeight > pageHeight - margin) {
                    doc.addPage();
                    leftY = margin;
                    rightY = margin;
                    useLeftColumn = true;
                    x = margin;
                    currentY = leftY;
                }
            }

            // 🔹 Agora processa a questão
            const result = await processQuestion(doc, question, x, currentY, columnWidth, pageHeight, margin);

            // Atualizar Y da coluna usada
            if (useLeftColumn) {
                leftY = result.finalY + 20;
            } else {
                rightY = result.finalY + 20;
            }
        }

        doc.end();

    } catch (error) {
        console.error('Erro detalhado:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Erro interno',
                message: error.message 
            });
        }
    }
}

function processTextWithBreak(doc, text, x, startY, columnWidth, maxY) {
    let currentY = startY;
    let remainingText = null;
    
    // Calcular quantas linhas cabem
    const lineHeight = doc.currentLineHeight();
    const availableLines = Math.floor((maxY - currentY) / lineHeight);
    
    if (availableLines <= 0) {
        return { finalY: currentY, remainingText: text };
    }
    
    // Quebrar texto em linhas
    const lines = doc.splitTextToSize(text, columnWidth, {});
    const linesThatFit = lines.slice(0, availableLines);
    const remainingLines = lines.slice(availableLines);
    
    // Adicionar linhas que cabem
    doc.text(linesThatFit.join('\n'), x, currentY, {
        width: columnWidth,
        align: 'justify'
    });
    
    currentY += linesThatFit.length * lineHeight;
    
    // Se sobrou texto, preparar para continuar
    if (remainingLines.length > 0) {
        remainingText = remainingLines.join('\n');
    }
    
    return { finalY: currentY, remainingText };
}

async function estimateQuestionHeight(doc, question, columnWidth) {
    let height = 0;
    
    // Título
    height += 20;
    
    // Contexto
    if (question.context) {
        const cleanContext = cleanText(question.context);
        if (cleanContext) {
            const contextHeight = doc.heightOfString(cleanContext, {
                width: columnWidth,
                align: 'justify'
            });
            height += contextHeight + 10;
        }
        
        if (extractImageUrl(question.context)) {
            height += 100; // Altura estimada para imagem
        }
    }

    // Introdução das alternativas
    if (question.alternativesIntroduction) {
        const introHeight = doc.heightOfString(question.alternativesIntroduction, {
            width: columnWidth
        });
        height += introHeight + 10;
    }
    
    // Alternativas
    for (const alt of question.alternatives) {
        if (extractImageUrl(alt.text || alt.file)) {
            height += 80; // Altura estimada para imagem
        } else {
            const altText = `${alt.letter}) ${cleanText(alt.text)}`;
            const altHeight = doc.heightOfString(altText, { 
                width: columnWidth,
                align: 'justify' 
            });
            height += altHeight + 5;
        }
    }
    
    height += 15; // Espaço extra
    return height;
}

async function processQuestion(doc, question, x, startY, columnWidth, pageHeight, margin) {
    let currentY = startY;
    const maxY = pageHeight - margin;
    let hasOverflow = false;
    let fullyProcessed = true;
    
    if (currentY > maxY - 50) { 
        return { finalY: currentY, overflow: true, processed: false };
    }
    
    // Título
    doc.fontSize(12).font('Helvetica-Bold')
       .text(question.title, x, currentY, {
           width: columnWidth,
           align: 'left'
       });
    currentY += 20;

    // Contexto
    if (question.context) {
        const imageUrl = extractImageUrl(question.context);
        const cleanContext = cleanText(question.context);
        
        doc.fontSize(10).font('Helvetica');
        
        if (cleanContext) {
            const textHeight = doc.heightOfString(cleanContext, {
                width: columnWidth,
                align: 'justify'
            });
            
            if (currentY + textHeight > maxY) {
                hasOverflow = true;
                fullyProcessed = false;
            } else {
                doc.text(cleanContext, x, currentY, {
                    width: columnWidth,
                    align: 'justify'
                });
                currentY += textHeight + 10;
            }
        }
        
        if (imageUrl && currentY < maxY - 100) { 
            currentY += 5;
            const imageHeight = await addImageToPDF(doc, imageUrl, x, currentY, columnWidth);
            currentY += imageHeight + 10;
        } else if (imageUrl) {
            hasOverflow = true;
        }
    }

    // Introdução das alternativas
    if (question.alternativesIntroduction && currentY < maxY - 30) {
        const introHeight = doc.heightOfString(question.alternativesIntroduction, {
            width: columnWidth
        });
        
        if (currentY + introHeight > maxY) {
            hasOverflow = true;
        } else {
            doc.text(question.alternativesIntroduction, x, currentY, {
                width: columnWidth,
                align: 'justify'
            });
            currentY += introHeight + 10;
        }
    }

    // Alternativas
    doc.fontSize(10);
    for (const alt of question.alternatives) {
        if (currentY > maxY - 30) { 
            hasOverflow = true;
            fullyProcessed = false;
            break;
        }
        
        const altImageUrl = extractImageUrl(alt.text || alt.file);
        const cleanAltText = cleanText(alt.text);
        
        if (altImageUrl) {
            doc.text(`${alt.letter}) `, x, currentY);
            const textWidth = doc.widthOfString(`${alt.letter}) `);
            
            if (currentY > maxY - 100) {
                hasOverflow = true;
                fullyProcessed = false;
                break;
            }
            
            const imageHeight = await addImageToPDF(doc, altImageUrl, x + textWidth, currentY - 2, columnWidth - textWidth - 5);
            currentY += Math.max(20, imageHeight) + 8;
            
        } else if (cleanAltText) {
            const altText = `${alt.letter}) ${cleanAltText}`;
            const altHeight = doc.heightOfString(altText, { 
                width: columnWidth,
                align: 'justify' 
            });
            
            if (currentY + altHeight > maxY) {
                hasOverflow = true;
                fullyProcessed = false;
                break;
            }
            
            doc.text(altText, x, currentY, {
                width: columnWidth,
                align: 'justify'
            });
            currentY += altHeight + 5;
        }
    }

    return { 
        finalY: currentY, 
        overflow: hasOverflow, 
        processed: fullyProcessed 
    };
}

function cleanText(text) {
    if (!text) return '';
    
    // Remover marcações HTML e Markdown
    let cleaned = text.replace(/!\[.*?\]\(.*?\)/g, '')
                     .replace(/<img[^>]*>/g, '')
                     .replace(/<[^>]*>/g, '')
                     .replace(/\*\*(.*?)\*\*/g, '$1') // negrito
                     .replace(/\*(.*?)\*/g, '$1');    // itálico
    
    // Remover múltiplos espaços e normalizar
    cleaned = cleaned.replace(/\s+/g, ' ')
                    .replace(/\\n/g, '\n')
                    .trim();
    
    return cleaned;
}

function extractImageUrl(text) {
    if (!text) return null;
    
    const patterns = [
        /!\[.*?\]\((.*?)\)/,
        /<img[^>]+src="([^">]+)"/,
        /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    return null;
}

async function addImageToPDF(doc, imageUrl, x, y, maxWidth) {
    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const imageBuffer = Buffer.from(response.data);
        const dimensions = sizeOf(imageBuffer);
        
        // Limitar tamanho máximo para alternativas
        const maxHeight = 60; // Reduzido para alternativas
        const ratio = Math.min(
            maxWidth / dimensions.width,
            maxHeight / dimensions.height,
            1
        );
        
        const width = dimensions.width * ratio;
        const height = dimensions.height * ratio;
        
        // Centralizar verticalmente com o texto
        doc.image(imageBuffer, x, y + 2, { width, height });
        return height;
        
    } catch (error) {
        console.error('Erro ao carregar imagem:', error);
        doc.fontSize(8).text('[Imagem]', x, y);
        return 12;
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