import { FastifyRequest, FastifyReply } from 'fastify';
import { uploadFile } from '../utils/upload';
import { registerUser, loginUser, getUserProfile, updateUserProfile } from '../service/auth.service';

export const register = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const parts = req.parts();
    let profile_photo_url: string | null = null;
    const body: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'profile_photo' && part.filename) {
          profile_photo_url = await uploadFile(part);
        } else {
          part.file.resume(); // discard other files
        }
      } else {
        body[part.fieldname] = part.value;
      }
    }

    body.profile_photo_url = profile_photo_url;

    const result = await registerUser(body);

    if (!result.success) {
      const { statusCode, ...responseBody } = result;
      return reply.status(statusCode).send(responseBody);
    }

    const token = await reply.jwtSign({ 
      id: result.data.id,
      role: result.role
    });

    return reply.status(result.statusCode).send({
      success: result.success,
      message: result.message,
      token,
      data: result.data,
    });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const login = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = req.body as any;

    const result = await loginUser(body);

    if (!result.success) {
      const { statusCode, ...responseBody } = result;
      return reply.status(statusCode).send(responseBody);
    }

    const token = await reply.jwtSign({ 
      id: result.user.id,
      role: result.role
    });

    return reply.status(result.statusCode).send({
      success: result.success,
      message: result.message,
      token,
      data: result.user,
    });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const getProfile = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.user as { id: string };

    const result = await getUserProfile(id);

    const { statusCode, ...responseBody } = result;
    return reply.status(statusCode).send(responseBody);
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const updateProfile = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = req.user as { id: string };

    const parts = req.parts();
    let profile_photo_url: string | null = null;
    const body: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'profile_photo' && part.filename) {
          profile_photo_url = await uploadFile(part);
        } else {
          part.file.resume();
        }
      } else {
        body[part.fieldname] = part.value;
      }
    }

    if (profile_photo_url) {
      body.profile_photo_url = profile_photo_url;
    }

    const result = await updateUserProfile(id, body);

    const { statusCode, ...responseBody } = result;
    return reply.status(statusCode).send(responseBody);
  } catch (error: any) {
    req.log.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error', error: error.message });
  }
};
