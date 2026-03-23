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
    req.user_id = payload.user_id;
    req.user_email = payload.email;
    req.user_name = payload.name;
    req.user = {
      id: payload.user_id,
      email: payload.email,
      name: payload.name
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
