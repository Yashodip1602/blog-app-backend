import User from "./user.model";
import Role from "./role.model";

// User belongs to Role
User.belongsTo(Role, {
    foreignKey: "role_id",
    as: "role"
});

// Role has many Users
Role.hasMany(User, {
    foreignKey: "role_id",
    as: "users"
});
