import { FastifyInstance } from 'fastify';
import { deleteFile, getSignedUrl, uploadFile } from '../utils/upload';

export default async function uploadRoutes(app: FastifyInstance) {
  app.post('/profile', async (req, reply) => {
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        const objectKey = await uploadFile(part, { folder: 'profiles' });
        const signedUrl = await getSignedUrl(objectKey);

        return reply.status(201).send({
          success: true,
          message: 'Profile image uploaded successfully',
          data: {
            key: objectKey,
            url: signedUrl,
          },
        });
      }
    }

    return reply.status(400).send({
      success: false,
      message: 'No file was provided',
    });
  });

  app.delete('/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    await deleteFile(decodeURIComponent(key));

    return reply.send({
      success: true,
      message: 'Object deleted successfully',
    });
  });
}
