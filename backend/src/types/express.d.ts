/**
 * Augments Express Request with the authenticated user context populated by the
 * auth middleware.
 */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
