import { Op } from 'sequelize';
import User from '../models/user.model';
import Role from '../models/role.model';
import { hashPassword, comparePassword } from '../utils/hashPassword';
import { getSignedUrl } from '../utils/upload';

export interface ServiceResponse {
  statusCode: number;
  success: boolean;
  message?: string;
  data?: any;
  token?: string;
  error?: string;
  role?: string;
}

const serializeUserForResponse = async (user: User): Promise<any> => {
  const plainUser = user.toJSON();
  const photoKey = plainUser.profile_photo_url || null;
  const expiresInSeconds = parseInt(process.env.S3_PRESIGNED_URL_TTL_SECONDS || '3600', 10);

  if (photoKey) {
    try {
      const signedUrl = await getSignedUrl(photoKey, expiresInSeconds);
      return {
        ...plainUser,
        profile_photo_key: photoKey,
        profile_photo_url: signedUrl,
        profile_photo_url_expires_in: expiresInSeconds > 0 ? expiresInSeconds : null,
      };
    } catch (error) {
      return {
        ...plainUser,
        profile_photo_key: photoKey,
        profile_photo_url: null,
        profile_photo_url_expires_in: expiresInSeconds > 0 ? expiresInSeconds : null,
      };
    }
  }

  return {
    ...plainUser,
    profile_photo_key: photoKey,
    profile_photo_url: null,
    profile_photo_url_expires_in: null,
  };
};

export const registerUser = async (data: any): Promise<ServiceResponse> => {
  const { full_name, phone_no, email, password, profile_photo_url } = data;

  if (!full_name || !phone_no || !email || !password) {
    return { statusCode: 400, success: false, message: 'All fields are required' };
  }

  const existingUser = await User.findOne({
    where: {
      [Op.or]: [{ email }, { phone_no }],
    },
  });

  if (existingUser) {
    return { statusCode: 400, success: false, message: 'Email or Phone Number already exists' };
  }

  const totalUser = await User.count();
  const roleCode = totalUser === 0 ? 'super_admin' : 'viewer';
  const role = await Role.findOne({ where: { code: roleCode } });
  const roleId = role ? role.id : undefined;
  if (!roleId) {
    return { statusCode: 400, success: false, message: 'Default role not found. Please seed roles first.' };
  }

  const hashedPassword = await hashPassword(password);

  const newUser = await User.create({
    full_name,
    phone_no,
    email,
    role_id: roleId,
    password: hashedPassword,
    profile_photo_url,
  });

  return {
    statusCode: 201,
    success: true,
    message: 'User registered successfully',
    data: await serializeUserForResponse(newUser),
    role: role?.role,
  };
};

export const loginUser = async (data: any): Promise<Omit<ServiceResponse, 'token'> & { user?: any }> => {
  const { email, password } = data;

  if (!email || !password) {
    return { statusCode: 400, success: false, message: 'Email and password are required' };
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return { statusCode: 401, success: false, message: 'Invalid credentials' };
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    return { statusCode: 401, success: false, message: 'Invalid credentials' };
  }

  const role = await Role.findByPk(user.role_id);

  return {
    statusCode: 200,
    success: true,
    message: 'Login successful',
    user: await serializeUserForResponse(user),
    role: role?.role,
  };
};

export const getUserProfile = async (id: string): Promise<ServiceResponse> => {
  const user = await User.findByPk(id);
  if (!user) {
    return { statusCode: 404, success: false, message: 'User not found' };
  }

  return { statusCode: 200, success: true, data: await serializeUserForResponse(user) };
};

export const updateUserProfile = async (id: string, data: any): Promise<ServiceResponse> => {
  const { full_name, phone_no, email, password, profile_photo_url } = data;

  const user = await User.findByPk(id);
  if (!user) {
    return { statusCode: 404, success: false, message: 'User not found' };
  }

  if (email || phone_no) {
    const orConditions: any[] = [];
    if (email) orConditions.push({ email });
    if (phone_no) orConditions.push({ phone_no });

    const duplicate = await User.findOne({
      where: {
        [Op.or]: orConditions,
        id: { [Op.ne]: id },
      },
    });

    if (duplicate) {
      return { statusCode: 400, success: false, message: 'Email or Phone Number already in use by another account' };
    }
  }

  const updates: any = {};
  if (full_name) updates.full_name = full_name;
  if (phone_no) updates.phone_no = phone_no;
  if (email) updates.email = email;
  if (profile_photo_url !== undefined) updates.profile_photo_url = profile_photo_url;
  if (password) updates.password = await hashPassword(password);

  await user.update(updates);

  return {
    statusCode: 200,
    success: true,
    message: 'Profile updated successfully',
    data: await serializeUserForResponse(user),
  };
};
