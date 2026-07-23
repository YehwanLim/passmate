const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

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
  const cancelled = await prisma.user.updateMany({
    where: { id: userId, deletionRequestedAt: { not: null }, purgeClaimedAt: null },
    data: { deletionRequestedAt: null, purgeAt: null },
  });
  if (cancelled.count !== 1) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new AccountDeletionError("APPLICATION_USER_UNAVAILABLE", 403);
    throw new AccountDeletionError("ACCOUNT_DELETION_NOT_PENDING", 409);
  }

  return { deletionRequestedAt: null, purgeAt: null };
}

export async function purgeDueAccounts({ prisma, deleteAuthUser, now = new Date(), take = 100 }) {
  const reclaimableAt = new Date(now.getTime() - PURGE_CLAIM_TIMEOUT_MS);
  const users = await prisma.user.findMany({
    where: {
      purgeAt: { lte: now },
      OR: [{ purgeClaimedAt: null }, { purgeClaimedAt: { lte: reclaimableAt } }],
    },
    orderBy: { purgeAt: "asc" },
    take,
    select: { id: true },
  });

  let purged = 0;
  for (const user of users) {
    const claimedAt = new Date();
    const claim = await prisma.user.updateMany({
      where: {
        id: user.id,
        purgeAt: { lte: now },
        OR: [{ purgeClaimedAt: null }, { purgeClaimedAt: { lte: reclaimableAt } }],
      },
      data: { purgeClaimedAt: claimedAt },
    });
    if (claim.count !== 1) continue;

    try {
      await deleteAuthUser(user.id);
      const result = await prisma.user.deleteMany({ where: { id: user.id, purgeClaimedAt: claimedAt } });
      purged += result.count;
    } catch (error) {
      await prisma.user.updateMany({
        where: { id: user.id, purgeClaimedAt: claimedAt },
        data: { purgeClaimedAt: null },
      });
      throw error;
    }
  }

  return { purged };
}
