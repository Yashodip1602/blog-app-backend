import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import type { MultipartFile } from '@fastify/multipart';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl as generateSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config';

dotenv.config({ quiet: true });

const awsRegion = config.aws.region || process.env.AWS_REGION || 'us-east-1';
const bucketName = config.aws.bucketName || process.env.AWS_BUCKET_NAME || '';
const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || process.env.S3_CLOUDFRONT_DOMAIN || '';
const defaultPresignedUrlTtl = parseInt(process.env.S3_PRESIGNED_URL_TTL_SECONDS || '3600', 10);
const defaultMaxFileSizeBytes = config.upload.maxFileSizeMB * 1024 * 1024;

/**
 * AWS SDK v3 resolves credentials from environment variables, shared config,
 * or IAM roles attached to EC2/ECS. This keeps production deployments secure.
 */
const s3Client = new S3Client({
  region: awsRegion,
});

export interface S3UploadOptions {
  folder?: string;
  allowedMimeTypes?: string[];
  maxFileSizeBytes?: number;
}

export interface S3UploadFileLike {
  filename?: string;
  mimetype?: string;
  file: Readable;
}

class S3StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'S3StorageError';
  }
}

/**
 * Validate file metadata prior to upload.
 */
export const validateFile = (
  file: { filename?: string; mimetype?: string },
  options: S3UploadOptions = {},
): void => {
  if (!file?.filename) {
    throw new S3StorageError('A filename is required.');
  }

  const allowedMimeTypes = options.allowedMimeTypes || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxFileSizeBytes = options.maxFileSizeBytes || defaultMaxFileSizeBytes;

  if (!allowedMimeTypes.includes(file.mimetype || '')) {
    throw new S3StorageError(
      `Unsupported file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
    );
  }

  if (maxFileSizeBytes <= 0) {
    throw new S3StorageError('Maximum file size must be greater than zero.');
  }

  if (!file.filename.trim()) {
    throw new S3StorageError('Filename cannot be empty.');
  }
};

/**
 * Convert the original filename into a safe, deterministic value.
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
 * Build a private S3 object key using a folder structure.
 */
const buildObjectKey = (folder: string, filename: string): string => {
  const safeFolder = folder.replace(/^\/+|\/+$/g, '').trim();
  const safeFilename = sanitizeFilename(filename);
  const uniqueSuffix = crypto.randomUUID();
  const finalName = `${uniqueSuffix}-${safeFilename}`;

  return safeFolder ? `${safeFolder}/${finalName}` : finalName;
};

/**
 * Wrap a stream with size validation so oversized uploads fail before reaching S3.
 */
const createSizeLimitedStream = (
  source: Readable,
  maxFileSizeBytes: number,
): Readable => {
  let transferredBytes = 0;

  const sizeLimitedStream = new Transform({
    transform(chunk, _encoding, callback) {
      const chunkSize = chunk.byteLength;
      const nextTotal = transferredBytes + chunkSize;

      if (nextTotal > maxFileSizeBytes) {
        callback(new Error(`File exceeds the maximum allowed size of ${maxFileSizeBytes} bytes.`));
        return;
      }

      transferredBytes = nextTotal;
      callback(null, chunk);
    },
  });

  source.on('error', (error) => {
    sizeLimitedStream.destroy(error);
  });

  source.pipe(sizeLimitedStream);
  return sizeLimitedStream;
};

/**
 * Upload an incoming multipart file to S3 and return the private object key.
 * The database stores the object key only, never a public URL.
 */
export const uploadFile = async (
  part: MultipartFile | S3UploadFileLike,
  options: S3UploadOptions = {},
): Promise<string> => {
  if (!part?.file) {
    throw new S3StorageError('A readable file stream is required.');
  }

  const fileInfo = {
    filename: 'filename' in part ? part.filename : undefined,
    mimetype: 'mimetype' in part ? part.mimetype : undefined,
  };

  validateFile(fileInfo, options);

  if (!bucketName) {
    throw new S3StorageError('AWS_BUCKET_NAME is not configured.');
  }

  const maxFileSizeBytes = options.maxFileSizeBytes || defaultMaxFileSizeBytes;
  const folder = options.folder || 'uploads';
  const objectKey = buildObjectKey(folder, fileInfo.filename || 'file');
  const limitedStream = createSizeLimitedStream(part.file, maxFileSizeBytes);

  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: objectKey,
        Body: limitedStream,
        ContentType: fileInfo.mimetype || 'application/octet-stream',
      },
    });

    await upload.done();
    return objectKey;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    throw new S3StorageError(`S3 upload failed: ${message}`, error);
  }
};

/**
 * Return either a presigned URL (temporary) or a non-expiring public URL.
 * For truly permanent access, configure S3_PUBLIC_BASE_URL or S3_CLOUDFRONT_DOMAIN.
 */
export const getSignedUrl = async (
  fileKey: string,
  expiresInSeconds = defaultPresignedUrlTtl,
): Promise<string> => {
  if (!fileKey) {
    throw new S3StorageError('A file key is required.');
  }

  if (!bucketName) {
    throw new S3StorageError('AWS_BUCKET_NAME is not configured.');
  }

  if (expiresInSeconds <= 0 || Boolean(publicBaseUrl)) {
    const normalizedBase = publicBaseUrl.replace(/\/+$/g, '');

    if (normalizedBase) {
      const cleanKey = encodeURI(fileKey).replace(/%2F/g, '/');
      return `${normalizedBase}/${cleanKey}`;
    }

    const cleanKey = encodeURIComponent(fileKey).replace(/%2F/g, '/');
    return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${cleanKey}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });

  return generateSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });
};

/**
 * Delete a previously uploaded object from S3.
 */
export const deleteFile = async (fileKey: string): Promise<void> => {
  if (!fileKey) {
    return;
  }

  if (!bucketName) {
    throw new S3StorageError('AWS_BUCKET_NAME is not configured.');
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown S3 delete error';
    throw new S3StorageError(`S3 delete failed: ${message}`, error);
  }
};

/**
 * Replace an existing object by deleting the old key and uploading a new one.
 */
export const updateFile = async (
  existingKey: string | null | undefined,
  part: MultipartFile | S3UploadFileLike,
  options: S3UploadOptions = {},
): Promise<string> => {
  if (existingKey) {
    await deleteFile(existingKey);
  }

  return uploadFile(part, options);
};

/**
 * Verify S3 connectivity at startup.
 */
export const testUploadConnection = async (): Promise<void> => {
  if (!bucketName) {
    throw new S3StorageError('AWS_BUCKET_NAME is not configured.');
  }

  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: bucketName,
      }),
    );
    console.log('AWS S3 bucket connection verified successfully.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AWS S3 error';
    throw new S3StorageError(`AWS S3 bucket connection failed: ${message}`, error);
  }
};