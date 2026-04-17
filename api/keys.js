export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.json({
    groqApiKey: process.env.GROQ_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    sabmanovaId: process.env.SABMANOVA_ID || '',
    hfToken: process.env.HF_TOKEN || '',
    cloudflareApiKey: process.env.CLOUDFLARE_API_KEY || ''
  });
}
