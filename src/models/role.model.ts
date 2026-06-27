import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface RoleAttributes {
  id: string;
  role: string;
  code: string;
  description: string;
  created_at?: Date;
  updated_at?: Date;
}

export class Role extends Model {
  public id!: string;
  public role!: string;
  public code!: string;
  public description!: string;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;

}

Role.init(
  { 
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  },
  {
    sequelize,
    tableName: 'roles',
    timestamps: true,
    underscored: true,
  }
);

export default Role;
