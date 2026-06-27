import Role from "../models/role.model";

export async function seedRoles() {
  const roles = [
    {
      role: "SUPER_ADMIN",
      code: "super_admin",
      description: "System Super Administrator",
    },
    {
      role: "ADMIN",
      code: "admin",
      description: "Blog Administrator",
    },
    {
      role: "AUTHOR",
      code: "author",
      description: "Blog Author",
    },
    {
      role: "VIEWER",
      code: "viewer",
      description: "Default Blog User",
    },
  ];

  for (const item of roles) {
    await Role.findOrCreate({
      where: {
        code: item.code,
      },
      defaults: {
        role: item.role,
        code: item.code,
        description: item.description,
      },
    });
  }

  console.log("Roles seeded successfully");
}