const express = require('express');
const path = require('path');
const {
  ensureModelLoaded,
  getModelStatus,
  evaluatePerplexity
} = require('./lib/distilgpt2-service.js');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '16kb' }));

app.get('/api/perplexity/status', (req, res) => {
  res.json(getModelStatus());
});

app.post('/api/perplexity', async (req, res) => {
  try {
    const text = req.body && typeof req.body.text === 'string' ? req.body.text : '';
    const result = await evaluatePerplexity(text);
    res.json(result);
  } catch (err) {
    const status = err && err.statusCode ? err.statusCode : 500;
    res.status(status).json({
      error: err && err.message ? err.message : 'Failed to evaluate perplexity with DistilGPT-2.'
    });
  }
});

app.use(express.static(path.join(__dirname), {
  extensions: ['html']
}));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  next();
});

app.listen(PORT, HOST, () => {
  console.log(`Unprompted listening on http://${HOST}:${PORT}`);
  // Pre-warm DistilGPT-2 in the background so first user query is instant
  ensureModelLoaded().catch(err => {
    console.error('[Unprompted] DistilGPT-2 pre-warm warning:', err.message || err);
  });
});
