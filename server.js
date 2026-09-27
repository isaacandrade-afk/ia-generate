const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Inicializa o Firebase Admin usando variáveis de ambiente do servidor
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Trata quebras de linha na chave privada se configurada como string
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
  })
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.send('IA Studio Backend Online e Seguro!');
});

// Rota para gerar imagens em lote com segurança
app.post('/api/gerar-lote', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Não autorizado. Token ausente." });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const { prompts } = req.body;
        if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
            return res.status(400).json({ error: "Nenhum prompt fornecido." });
        }

        const qtd = prompts.length;
        const userRef = db.collection('usuarios').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        let creditosAtuais = userDoc.data().creditos ?? 200;

        if (creditosAtuais < qtd) {
            return res.status(403).json({ error: `Créditos insuficientes. Você tem ${creditosAtuais} e tentou usar ${qtd}.` });
        }

        // Debita os créditos de forma segura
        const novoSaldo = creditosAtuais - qtd;
        await userRef.update({ creditos: novoSaldo });

        // Aqui você usaria sua chave secreta da API (ex: process.env.OPENAI_API_KEY)
        const resultadosGerados = prompts.map((prompt, index) => ({
            id: index + 1,
            prompt: prompt,
            url: `https://picsum.photos/seed/${encodeURIComponent(prompt)}/800/800`
        }));

        return res.status(200).json({
            sucesso: true,
            creditosRestantes: novoSaldo,
            resultados: resultadosGerados
        });

    } catch (error) {
        console.error("Erro no backend:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
