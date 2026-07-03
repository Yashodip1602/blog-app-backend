import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const testUploadConnection = async () => {
  if (isProduction) {
    const bucketName = process.env.AWS_BUCKET_NAME;

    if (!bucketName) {
      console.error('AWS_BUCKET_NAME is not set in environment variables.');
      return;
    }

    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log('AWS S3 bucket connection verified successfully.');
    } catch (error: any) {
      console.error('AWS S3 bucket connection failed. Please check your AWS credentials and bucket name.', error.message || error);
    }

    return;
  }

  try {
    const result = await cloudinary.api.ping();
    if (result.status === 'ok') {
      console.log('Cloudinary connected successfully.');
    } else {
      console.error('Cloudinary connection issue:', result);
    }
  } catch (error: any) {
    console.error('Cloudinary connection failed. Please check your credentials.', error.message);
  }
};

export const uploadFile = async (part: any): Promise<string> => {
  if (!part.filename) {
    throw new Error('File upload part must include a filename.');
  }

  if (isProduction) {
    const bucketName = process.env.AWS_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME environment variable is required for production uploads.');
    }

    const fileKey = `uploads/${Date.now()}-${part.filename}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: fileKey,
      Body: part.file,
      ContentType: part.mimetype || 'application/octet-stream',
      ACL: 'public-read' as const,
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    await upload.done();
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'blogsphere_profiles' },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        if (result && result.secure_url) {
          return resolve(result.secure_url);
        }
        reject(new Error('Failed to upload image to Cloudinary'));
      }
    );

    part.file.pipe(uploadStream);
  });
};
