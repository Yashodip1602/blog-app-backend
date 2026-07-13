import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';

import { v2 as cloudinary } from 'cloudinary';
import {
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const awsRegion = process.env.AWS_REGION || 'ap-south-1';
const bucketName = process.env.AWS_BUCKET_NAME;

/**
 * Do not manually provide credentials here.
 *
 * AWS SDK automatically checks:
 * 1. Environment variables
 * 2. AWS credentials/config files
 * 3. EC2 IAM Role
 * 4. ECS Task Role
 */
const s3Client = new S3Client({
  region: awsRegion,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const testUploadConnection = async (): Promise<void> => {
  if (isProduction) {
    if (!bucketName) {
      throw new Error(
        'AWS_BUCKET_NAME is not set in environment variables.',
      );
    }

    try {
      await s3Client.send(
        new HeadBucketCommand({
          Bucket: bucketName,
        }),
      );

      console.log('AWS S3 bucket connection verified successfully.');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown AWS S3 error';

      console.error('AWS S3 bucket connection failed:', message);

      throw error;
    }

    return;
  }

  try {
    const result = await cloudinary.api.ping();

    if (result.status !== 'ok') {
      throw new Error('Cloudinary ping failed.');
    }

    console.log('Cloudinary connected successfully.');
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown Cloudinary error';

    console.error('Cloudinary connection failed:', message);

    throw error;
  }
};

/**
 * Converts the original filename into a safe filename.
 */
const sanitizeFilename = (filename: string): string => {
  const extension = path.extname(filename).toLowerCase();
  const originalName = path.basename(filename, extension);

  const safeName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${safeName || 'file'}${extension}`;
};

/**
 * Uploads a file and returns:
 *
 * Production: S3 object key
 * Development: Cloudinary secure URL
 */
export const uploadFile = async (part: any): Promise<string> => {
  if (!part?.filename) {
    throw new Error('File upload part must include a filename.');
  }

  if (!part?.file) {
    throw new Error('File upload part must include a readable file stream.');
  }

  if (isProduction) {
    if (!bucketName) {
      throw new Error(
        'AWS_BUCKET_NAME environment variable is required.',
      );
    }

    const safeFilename = sanitizeFilename(part.filename);
    const uniqueId = crypto.randomUUID();

    const fileKey = `uploads/${uniqueId}-${safeFilename}`;

    try {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: fileKey,
          Body: part.file,
          ContentType:
            part.mimetype || 'application/octet-stream',

          // Do not add:
          // ACL: 'public-read'
        },
      });

      await upload.done();

      // Save this key in your database.
      return fileKey;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown upload error';

      console.error('S3 file upload failed:', message);

      throw new Error(`S3 file upload failed: ${message}`);
    }
  }

  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'blogsphere_profiles',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url) {
          reject(new Error('Cloudinary did not return a secure URL.'));
          return;
        }

        resolve(result.secure_url);
      },
    );

    part.file.on('error', reject);
    part.file.pipe(uploadStream);
  });
};

/**
 * Generates a temporary URL for a private S3 object.
 */
export const getFileUrl = async (
  fileKey: string,
  expiresIn = 900,
): Promise<string> => {
  if (!isProduction) {
    // In development, fileKey may already be a Cloudinary URL.
    return fileKey;
  }

  if (!bucketName) {
    throw new Error(
      'AWS_BUCKET_NAME environment variable is required.',
    );
  }

  if (!fileKey) {
    throw new Error('File key is required.');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
  });
};