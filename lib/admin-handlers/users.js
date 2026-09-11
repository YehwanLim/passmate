import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";
import { positiveInt } from "../sanitize.js";

const SORT_FIELDS = { created_at: "createdAt", email: "email", name: "name", updated_at: "updatedAt" };

export default createAdminHandler({ route: "api/admin/users", methods: ["GET"] }, async ({ req, res }) => {
  const page = positiveInt(req.query?.page, 1, 100_000);
  const pageSize = positiveInt(req.query?.pageSize, 15, 100);
  const search = String(req.query?.search ?? "").trim().slice(0, 120);
  const sortField = SORT_FIELDS[req.query?.sortField] ?? "createdAt";
  const sortDir = req.query?.sortDir === "asc" ? "asc" : "desc";
  const where = search ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : {};
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { [sortField]: sortDir }, skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true,
        _count: { select: { analyses: true, projects: true, paymentEntitlements: true } },
      },
    }),
  ]);
  return res.status(200).json({
    total,
    users: users.map((user) => ({
      id: user.id, email: user.email, name: user.name ?? null, profile_image: user.avatarUrl ?? null,
      provider: null, role: user.role, created_at: user.createdAt, updated_at: user.updatedAt,
      analysis_count: user._count.analyses, project_count: user._count.projects,
      payment_count: user._count.paymentEntitlements,
    })),
  });
});
