import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      const payload = jwt.verify(token, JWT_SECRET);
    
    // Suporte para payloads antigos (user_id) e novos (id)
    const userId = payload.id || payload.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user_id = userId;
    req.user_email = payload.email;
    req.user_name = payload.name;
    req.user = {
      id: userId,
      email: payload.email,
      name: payload.name
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
