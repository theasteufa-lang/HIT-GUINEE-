import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { decryptAES256GCM } from '../lib/crypto.ts';
import { db } from '../db/index.ts';
import { encryptedSessions, users } from '../db/schema.ts';
import { ensureSeeded, getOrCreateFirebaseUser } from '../db/repository.ts';

export interface AuthUserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  artistName: string | null;
  role: string;
  walletBalance: number;
  totalEarned: number;
  biometricEnabled: boolean;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  dbUser?: AuthUserRecord;
  sessionId?: string;
  biometricVerified?: boolean;
}

async function resolveSessionFromHeader(req: AuthRequest): Promise<void> {
  const authHeader = req.headers.authorization;
  const sessionHeader = req.headers['x-session-token'] as string | undefined;
  const token = sessionHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '');
  if (!token) return;

  await ensureSeeded();

  if (token.startsWith('enc_')) {
    const encryptedPart = token.slice(4);
    try {
      const decrypted = JSON.parse(decryptAES256GCM(encryptedPart)) as {
        sessionId: string;
        userId: number;
        role: string;
      };
      const [sess] = await db
        .select()
        .from(encryptedSessions)
        .where(eq(encryptedSessions.sessionId, decrypted.sessionId))
        .limit(1);

      if (!sess || sess.revoked || sess.expiresAt < new Date()) {
        return;
      }

      const [user] = await db.select().from(users).where(eq(users.id, sess.userId)).limit(1);
      if (!user || !user.isActive) return;

      req.dbUser = user;
      req.sessionId = sess.sessionId;
      req.biometricVerified = sess.biometricVerified;
    } catch {
      return;
    }
    return;
  }

  // Firebase ID token path
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const dbUser = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name || 'Artiste Steufa'
    );
    if (!dbUser.isActive) return;
    req.dbUser = dbUser;
    req.biometricVerified = false;
  } catch {
    return;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  await resolveSessionFromHeader(req);
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await resolveSessionFromHeader(req);
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Authentification requise ou session expirée.' });
  }
  next();
};

export const requireCeo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await resolveSessionFromHeader(req);
  if (!req.dbUser || req.dbUser.role !== 'ceo') {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  next();
};
