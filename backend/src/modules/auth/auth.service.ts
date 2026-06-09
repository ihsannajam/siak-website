import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/jwt';

/** Aggregates a user's roles + flattened permissions for the token payload. */
async function loadUserAuthData(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw ApiError.notFound('User tidak ditemukan');

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.name),
      ),
    ),
  ];
  return { user, roles, permissions };
}

async function issueTokens(userId: string, username: string, roles: string[], permissions: string[]) {
  const accessToken = signAccessToken({ sub: userId, username, roles, permissions });

  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, tokenId });

  // store hashed-by-uniqueness refresh token for rotation/revocation
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username }, { email: username }],
      },
    });
    if (!user) throw ApiError.unauthorized('Username atau password salah');
    if (!user.isActive) throw ApiError.forbidden('Akun tidak aktif');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Username atau password salah');

    const { roles, permissions } = await loadUserAuthData(user.id);
    const tokens = await issueTokens(user.id, user.username, roles, permissions);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions,
      },
    };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Refresh token tidak valid');
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
    });
    if (!stored || stored.revokedAt || stored.token !== refreshToken) {
      throw ApiError.unauthorized('Refresh token sudah tidak berlaku');
    }
    if (stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token kedaluwarsa');
    }

    // rotate: revoke the old token
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { user, roles, permissions } = await loadUserAuthData(payload.sub);
    return issueTokens(user.id, user.username, roles, permissions);
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { id: payload.tokenId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* token already invalid — nothing to revoke */
    }
  },

  async me(userId: string) {
    const { user, roles, permissions } = await loadUserAuthData(userId);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions,
    };
  },
};
