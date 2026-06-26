import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const testCloudinaryConnection = async () => {
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
