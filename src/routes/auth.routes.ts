import { FastifyInstance } from 'fastify';
import { register, login, getProfile, updateProfile } from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';

export default async function authRoutes(app: FastifyInstance) {
  // Public routes
  app.post('/register', register);
  app.post('/login', login);

  // Protected routes
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', verifyJWT);
    
    protectedApp.get('/profile', getProfile);
    protectedApp.put('/profile', updateProfile);
  });
}
