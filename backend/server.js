const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { generalLimiter } = require('./middleware/rateLimiters');
app.use(generalLimiter);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Blackbeard\'s Tavern backend is running' });
});

// Rotas específicas (vamos adicionar depois)
const imageRoutes = require('./routes/image');
app.use('/api/image', imageRoutes);

const downloadRoutes = require('./routes/download');
app.use('/api/download', downloadRoutes);

const audioRoutes = require('./routes/audio');
app.use('/api/audio', audioRoutes);

const musicRoutes = require('./routes/music');
app.use('/api/music', musicRoutes);

const authRoutes = require('./modules/auth/authRoutes');
app.use('/api/auth', authRoutes);

const profileRoutes = require('./modules/profile/profileRoutes');
app.use('/api/profile', profileRoutes);

const feedRoutes = require('./modules/feed/feedRoutes');
app.use('/api/feed', feedRoutes);

const friendsRoutes = require('./modules/friends/friendsRoutes');
app.use('/api/friends', friendsRoutes);


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
