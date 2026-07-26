import { requireAuthenticatedUser } from "./auth.js";
import prisma from "./prisma.js";

export async function requireAdministrator(req, res) {
  const authenticatedUser = await requireAuthenticatedUser(req);
  if (!authenticatedUser) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: authenticatedUser.id },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return authenticatedUser;
}
