import { FastifyRequest, FastifyReply } from 'fastify';

export const verifyJWT = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      success: false,
      message: 'Unauthorized access',
    });
  }
};
