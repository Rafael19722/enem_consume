const express = require("express");
const cors = require("cors");
const fs = require("fs");
const apiRoutes = require("./routes/apiRoutes");
const multer = require("multer");
const PDFDocument = require('pdfkit');
const path = require("path");

const upload = multer({ dest: "uploads/" });
const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

app.use("/api", apiRoutes);

app.listen(PORT, () => console.log(`Servidor rodando em  http://localhost:${PORT}`));