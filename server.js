const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Tratamento seguro da chave privada para evitar erros de formatação na Vercel
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

// Inicialização segura do Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    })
  });
}

const db = admin.firestore();

// Inicialização da OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rota de teste para verificar se o backend está online
app.get('/', (req, res) => {
  res.status(200).send('IA Studio Backend Online e Seguro!');
});

// Rota principal para geração de imagens
app.post('/api/gerar-lote', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { prompt, count = 1 } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'O prompt é obrigatório.' });
    }

    // Consulta de créditos no Firestore
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    let credits = 10; // Créditos padrão se o documento não existir
    if (userDoc.exists) {
      credits = userDoc.data().credits || 0;
    }

    if (credits < count) {
      return res.status(403).json({ error: 'Créditos insuficientes.' });
    }

    // Chamada oficial à API DALL-E da OpenAI
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });

    const imageUrl = response.data[0].url;

    // Atualiza os créditos do utilizador
    await userRef.set({ credits: credits - count }, { merge: true });

    return res.status(200).json({ 
      success: true, 
      images: [imageUrl],
      remainingCredits: credits - count 
    });

  } catch (error) {
    console.error('Erro no servidor:', error);
    return res.status(500).json({ error: error.message || 'Erro interno no servidor.' });
  }
});

module.exports = app;
