const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export class AccountDeletionError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function nextPurgeAt(now) {
  return new Date(now.getTime() + DELETION_GRACE_PERIOD_MS);
}

export async function requestAccountDeletion({ prisma, userId, now = new Date() }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletionRequestedAt: true, purgeAt: true },
  });

  if (!user) throw new AccountDeletionError("APPLICATION_USER_UNAVAILABLE", 403);
  if (user.deletionRequestedAt && user.purgeAt) return user;

  const purgeAt = nextPurgeAt(now);
  return prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: now, purgeAt },
    select: { deletionRequestedAt: true, purgeAt: true },
  });
}

export async function cancelAccountDeletion({ prisma, userId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletionRequestedAt: true },
  });

  if (!user) throw new AccountDeletionError("APPLICATION_USER_UNAVAILABLE", 403);
  if (!user.deletionRequestedAt) throw new AccountDeletionError("ACCOUNT_DELETION_NOT_PENDING", 409);

  return prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: null, purgeAt: null },
    select: { deletionRequestedAt: true, purgeAt: true },
  });
}

export async function purgeDueAccounts({ prisma, deleteAuthUser, now = new Date(), take = 100 }) {
  const users = await prisma.user.findMany({
    where: { purgeAt: { lte: now } },
    orderBy: { purgeAt: "asc" },
    take,
    select: { id: true },
  });

  let purged = 0;
  for (const user of users) {
    await deleteAuthUser(user.id);
    const result = await prisma.user.deleteMany({ where: { id: user.id, purgeAt: { lte: now } } });
    purged += result.count;
  }

  return { purged };
}
