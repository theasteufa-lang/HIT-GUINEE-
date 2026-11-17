import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Request, Response } from 'express';
import { desc, eq, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  distributionOrders,
  encryptedSessions,
  financialTransactions,
  mediaItems,
  offlineVault,
  paymentMethods,
  platformConfig,
  users,
} from './src/db/schema.ts';
import {
  ensureSeeded,
  getDecryptedCeoVaultNotes,
  getOrCreateFirebaseUser,
  getPlatformConfig,
  getPublicCatalog,
  getUserByEmail,
  recordMediaMonetization,
  sanitizeUserForClient,
} from './src/db/repository.ts';
import {
  encryptAES256GCM,
  hashPasswordScrypt,
  hashString,
  signLedgerEntry,
  verifyPasswordScrypt,
} from './src/lib/crypto.ts';
import {
  generateStudioAudioWav,
  getUploadedMediaPath,
  saveUploadedMediaBase64,
} from './src/lib/mediaStream.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { AuthRequest, optionalAuth, requireAuth, requireCeo } from './src/middleware/auth.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

async function createEncryptedSessionToken(
  user: typeof users.$inferSelect,
  req: Request,
  biometricVerified = false
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const uaHash = hashString(req.headers['user-agent'] || 'steufa-client');
  const payload = JSON.stringify({
    sessionId,
    userId: user.id,
    role: user.role,
    issuedAt: Date.now(),
  });
  const encryptedPayload = encryptAES256GCM(payload);

  await db.insert(encryptedSessions).values({
    sessionId,
    userId: user.id,
    encryptedPayload,
    biometricVerified,
    userAgentHash: uaHash,
    expiresAt,
    revoked: false,
  });

  return {
    token: `enc_${encryptedPayload}`,
    sessionId,
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// 1. AUTHENTICATION, ENCRYPTED SESSIONS & BIOMETRIC ENDPOINTS
// ---------------------------------------------------------------------------

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { email, password, displayName, artistName, role } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      artistName?: string;
      role?: string;
    };

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, nom complet et mot de passe requis.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse email.' });
    }

    // Never allow registering directly as CEO
    const safeRole = role === 'listener' ? 'listener' : 'artist';

    const [created] = await db
      .insert(users)
      .values({
        uid: `local_${crypto.randomUUID()}`,
        email: normalizedEmail,
        displayName: displayName.trim(),
        artistName: (artistName || displayName).trim(),
        role: safeRole,
        passwordHash: hashPasswordScrypt(password),
        walletBalance: safeRole === 'artist' ? 200000 : 25000,
        totalEarned: 0,
        biometricEnabled: false,
        isActive: true,
      })
      .returning();

    const session = await createEncryptedSessionToken(created, req, false);
    return res.status(201).json({
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      biometricVerified: false,
      user: sanitizeUserForClient(created),
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Adresse email et mot de passe requis.' });
    }

    const user = await getUserByEmail(email.trim().toLowerCase());
    if (!user || !user.passwordHash || !verifyPasswordScrypt(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Compte suspendu par la direction.' });
    }

    const session = await createEncryptedSessionToken(user, req, false);
    return res.json({
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      biometricVerified: false,
      user: sanitizeUserForClient(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Échec de connexion.' });
  }
});

app.post('/api/auth/firebase', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ error: 'Token Firebase manquant.' });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name || 'Artiste Steufa'
    );
    if (!user.isActive) {
      return res.status(403).json({ error: 'Compte suspendu.' });
    }

    const session = await createEncryptedSessionToken(user, req, false);
    return res.json({
      token: session.token,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      biometricVerified: false,
      user: sanitizeUserForClient(user),
    });
  } catch (err) {
    console.error('Firebase auth error:', err);
    return res.status(401).json({ error: 'Validation Google Sign-In échouée.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!;
    const [freshUser] = await db.select().from(users).where(eq(users.id, dbUser.id)).limit(1);
    const activeSessions = await db
      .select({
        sessionId: encryptedSessions.sessionId,
        biometricVerified: encryptedSessions.biometricVerified,
        expiresAt: encryptedSessions.expiresAt,
        createdAt: encryptedSessions.createdAt,
      })
      .from(encryptedSessions)
      .where(sql`${encryptedSessions.userId} = ${dbUser.id} AND ${encryptedSessions.revoked} = false`)
      .orderBy(desc(encryptedSessions.createdAt))
      .limit(10);

    return res.json({
      user: sanitizeUserForClient(freshUser),
      biometricVerified: Boolean(req.biometricVerified),
      currentSessionId: req.sessionId || null,
      activeSessions,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Impossible de charger la session.' });
  }
});

app.post('/api/auth/biometric/register', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { credentialId, biometricPin } = req.body as {
      credentialId?: string;
      biometricPin?: string;
    };
    const dbUser = req.dbUser!;
    const credId = credentialId || `webauthn_${crypto.randomUUID()}`;
    const secretHash = biometricPin
      ? hashPasswordScrypt(biometricPin)
      : hashPasswordScrypt(credId);

    const [updated] = await db
      .update(users)
      .set({
        biometricEnabled: true,
        biometricCredentialId: credId,
        biometricSecretHash: secretHash,
      })
      .where(eq(users.id, dbUser.id))
      .returning();

    if (req.sessionId) {
      await db
        .update(encryptedSessions)
        .set({ biometricVerified: true })
        .where(eq(encryptedSessions.sessionId, req.sessionId));
    }

    return res.json({
      user: sanitizeUserForClient(updated),
      biometricVerified: true,
      credentialId: credId,
    });
  } catch (err) {
    console.error('Biometric register error:', err);
    return res.status(500).json({ error: 'Activation biométrique échouée.' });
  }
});

app.post('/api/auth/biometric/verify', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { credentialId, biometricPin } = req.body as {
      credentialId?: string;
      biometricPin?: string;
    };
    const dbUser = req.dbUser!;
    const [fresh] = await db.select().from(users).where(eq(users.id, dbUser.id)).limit(1);

    if (!fresh.biometricEnabled) {
      return res.status(400).json({ error: 'Biométrie non configurée sur ce compte.' });
    }

    const validWebAuthn =
      credentialId && fresh.biometricCredentialId && credentialId === fresh.biometricCredentialId;
    const validPin =
      biometricPin &&
      fresh.biometricSecretHash &&
      verifyPasswordScrypt(biometricPin, fresh.biometricSecretHash);

    if (!validWebAuthn && !validPin) {
      return res.status(401).json({ error: 'Vérification biométrique refusée.' });
    }

    if (req.sessionId) {
      await db
        .update(encryptedSessions)
        .set({ biometricVerified: true })
        .where(eq(encryptedSessions.sessionId, req.sessionId));
    }

    return res.json({ biometricVerified: true });
  } catch (err) {
    console.error('Biometric verify error:', err);
    return res.status(500).json({ error: 'Erreur de vérification biométrique.' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.sessionId) {
      await db
        .update(encryptedSessions)
        .set({ revoked: true })
        .where(eq(encryptedSessions.sessionId, req.sessionId));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
  }
});

app.post('/api/auth/sessions/:sessionId/revoke', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.sessionId);
    await db
      .update(encryptedSessions)
      .set({ revoked: true })
      .where(
        sql`${encryptedSessions.sessionId} = ${targetId} AND ${encryptedSessions.userId} = ${req.dbUser!.id}`
      );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Session revoke error:', err);
    return res.status(500).json({ error: 'Impossible de révoquer la session.' });
  }
});

// ---------------------------------------------------------------------------
// 2. PUBLIC STREAMING CATALOG & HIGH-SPEED HTTP 206 STREAMING SERVER
// ---------------------------------------------------------------------------

app.get('/api/catalog', optionalAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getPublicCatalog();
    return res.json(data);
  } catch (err) {
    console.error('Catalog error:', err);
    return res.status(500).json({ error: 'Impossible de charger le catalogue.' });
  }
});

app.get('/api/stream/:id', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const mediaId = Number(req.params.id);
    if (!Number.isFinite(mediaId)) {
      return res.status(400).end();
    }

    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
    if (!item) {
      return res.status(404).end();
    }

    // Check if an uploaded binary file exists
    const uploadedPath = item.streamUrl.startsWith('/uploads/')
      ? getUploadedMediaPath(item.streamUrl.replace('/uploads/', ''))
      : null;

    if (uploadedPath && fs.existsSync(uploadedPath)) {
      const stat = fs.statSync(uploadedPath);
      const totalSize = stat.size;
      const range = req.headers.range;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', item.mimeType || 'audio/mpeg');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': chunkSize,
        });
        fs.createReadStream(uploadedPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Length': totalSize });
        fs.createReadStream(uploadedPath).pipe(res);
      }
      return;
    }

    // High-speed studio audio WAV streaming with HTTP 206 Range support
    const wavBuffer = generateStudioAudioWav(item.id, 18);
    const totalLength = wavBuffer.length;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'audio/wav');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? Math.min(parseInt(parts[1], 10), totalLength - 1) : totalLength - 1;
      const chunk = wavBuffer.subarray(start, end + 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Content-Length': chunk.length,
      });
      res.end(chunk);
    } else {
      res.writeHead(200, { 'Content-Length': totalLength });
      res.end(wavBuffer);
    }
  } catch (err) {
    console.error('Streaming error:', err);
    res.status(500).end();
  }
});

app.get('/api/download/:id', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const mediaId = Number(req.params.id);
    const format = String(req.query.format || 'MP3 320kbps');
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }

    const slug = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const uploadedPath = item.streamUrl.startsWith('/uploads/')
      ? getUploadedMediaPath(item.streamUrl.replace('/uploads/', ''))
      : null;

    if (uploadedPath && fs.existsSync(uploadedPath)) {
      const ext = path.extname(uploadedPath) || '.bin';
      res.setHeader('Content-Disposition', `attachment; filename="${slug}${ext}"`);
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      return fs.createReadStream(uploadedPath).pipe(res);
    }

    const wavBuffer = generateStudioAudioWav(item.id, 18);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${slug}_${format.replace(/\s+/g, '_')}.wav"`
    );
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', wavBuffer.length);
    return res.end(wavBuffer);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Téléchargement impossible.' });
  }
});

app.post('/api/media/:id/play', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const mediaId = Number(req.params.id);
    const result = await recordMediaMonetization(mediaId, 'play', req.dbUser?.id);
    if (!result) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }
    return res.json(result);
  } catch (err) {
    console.error('Play monetization error:', err);
    return res.status(500).json({ error: 'Erreur de monétisation lecture.' });
  }
});

app.post('/api/media/:id/download', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const mediaId = Number(req.params.id);
    const { format } = req.body as { format?: string };
    const result = await recordMediaMonetization(mediaId, 'download', req.dbUser?.id, format);
    if (!result) {
      return res.status(404).json({ error: 'Média introuvable.' });
    }
    return res.json({
      ...result,
      downloadUrl: `/api/download/${mediaId}?format=${encodeURIComponent(format || '320kbps')}`,
    });
  } catch (err) {
    console.error('Download monetization error:', err);
    return res.status(500).json({ error: 'Erreur de téléchargement.' });
  }
});

app.get('/api/vault/offline', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        id: offlineVault.id,
        format: offlineVault.format,
        fileSizeMb: offlineVault.fileSizeMb,
        createdAt: offlineVault.createdAt,
        mediaId: mediaItems.id,
        title: mediaItems.title,
        artistDisplay: mediaItems.artistDisplay,
        mediaType: mediaItems.mediaType,
        coverUrl: mediaItems.coverUrl,
      })
      .from(offlineVault)
      .innerJoin(mediaItems, eq(offlineVault.mediaItemId, mediaItems.id))
      .where(eq(offlineVault.userId, req.dbUser!.id))
      .orderBy(desc(offlineVault.createdAt));

    return res.json({ items: rows });
  } catch (err) {
    console.error('Offline vault error:', err);
    return res.status(500).json({ error: 'Impossible de charger les téléchargements.' });
  }
});

// ---------------------------------------------------------------------------
// 3. ARTIST STUDIO, 200 000 FCFA DISTRIBUTOR & SECURE FINANCIAL WALLET
// ---------------------------------------------------------------------------

app.get('/api/artist/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.dbUser!.id;
    const cfg = await getPlatformConfig();
    const [freshUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    const myMedia = await db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.artistId, userId))
      .orderBy(desc(mediaItems.createdAt));

    const myDistributions = await db
      .select()
      .from(distributionOrders)
      .where(eq(distributionOrders.artistId, userId))
      .orderBy(desc(distributionOrders.createdAt));

    const myTransactions = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.userId, userId))
      .orderBy(desc(financialTransactions.createdAt))
      .limit(40);

    const methods = await db
      .select()
      .from(paymentMethods)
      .where(
        sql`${paymentMethods.isActive} = true AND (${paymentMethods.ownerScope} = 'artist' OR ${paymentMethods.ownerScope} = 'both')`
      )
      .orderBy(paymentMethods.id);

    const totalPlays = myMedia.reduce((acc, m) => acc + m.playsCount, 0);
    const totalDownloads = myMedia.reduce((acc, m) => acc + m.downloadsCount, 0);
    const totalGross = myMedia.reduce((acc, m) => acc + m.grossRevenueFcfa, 0);

    return res.json({
      user: sanitizeUserForClient(freshUser),
      config: {
        platformSharePercent: cfg.platformSharePercent,
        artistSharePercent: cfg.artistSharePercent,
        distributionPackPrice: cfg.distributionPackPrice,
        streamRateFcfa: cfg.streamRateFcfa,
        videoViewRateFcfa: cfg.videoViewRateFcfa,
        downloadRateFcfa: cfg.downloadRateFcfa,
      },
      stats: {
        totalPlays,
        totalDownloads,
        totalGross,
        artistNetEarned: freshUser.totalEarned,
        platformCutEarned: Math.round((totalGross * cfg.platformSharePercent) / 100),
        walletBalance: freshUser.walletBalance,
        releasesCount: myMedia.length,
      },
      media: myMedia,
      distributions: myDistributions,
      transactions: myTransactions,
      paymentMethods: methods,
    });
  } catch (err) {
    console.error('Artist dashboard error:', err);
    return res.status(500).json({ error: 'Impossible de charger le tableau de bord artiste.' });
  }
});

app.post('/api/artist/upload', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!;
    const {
      title,
      mediaType,
      genre,
      durationSec,
      priceFcfa,
      qualityAudio,
      qualityVideo,
      fileBase64,
      fileName,
      mimeType,
      coverUrl,
    } = req.body as {
      title?: string;
      mediaType?: 'audio' | 'video';
      genre?: string;
      durationSec?: number;
      priceFcfa?: number;
      qualityAudio?: string;
      qualityVideo?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      coverUrl?: string;
    };

    if (!title || !mediaType) {
      return res.status(400).json({ error: 'Titre et type de média requis.' });
    }

    const defaultCover =
      mediaType === 'video'
        ? '/src/assets/images/thumb_cinematic_clip_1794947041062.jpg'
        : '/src/assets/images/cover_afro_synth_1794947039343.jpg';

    let finalStreamUrl = '';
    let finalMime = mimeType || (mediaType === 'video' ? 'video/mp4' : 'audio/wav');

    if (fileBase64 && fileName) {
      const ext = path.extname(fileName) || (mediaType === 'video' ? '.mp4' : '.mp3');
      const safeFile = `media_${dbUser.id}_${Date.now()}${ext}`;
      saveUploadedMediaBase64(safeFile, fileBase64);
      finalStreamUrl = `/uploads/${safeFile}`;
    }

    const [inserted] = await db
      .insert(mediaItems)
      .values({
        artistId: dbUser.id,
        title: title.trim(),
        artistDisplay: dbUser.artistName || dbUser.displayName,
        mediaType,
        genre: genre || 'Afro-Fusion',
        durationSec: Number(durationSec) || 205,
        coverUrl: coverUrl || defaultCover,
        streamUrl: finalStreamUrl || '/api/stream/0',
        mimeType: finalMime,
        qualityAudio: qualityAudio || '320kbps FLAC',
        qualityVideo: mediaType === 'video' ? qualityVideo || '1080p HD' : null,
        priceFcfa: Number(priceFcfa) || 500,
        monetized: true,
        isPublished: true,
        isFeatured: false,
        isPrivateVault: false,
      })
      .returning();

    if (!finalStreamUrl) {
      const [updated] = await db
        .update(mediaItems)
        .set({ streamUrl: `/api/stream/${inserted.id}` })
        .where(eq(mediaItems.id, inserted.id))
        .returning();
      return res.status(201).json({ item: updated });
    }

    return res.status(201).json({ item: inserted });
  } catch (err) {
    console.error('Artist upload error:', err);
    return res.status(500).json({ error: 'Publication du média échouée.' });
  }
});

app.post('/api/distributor/launch', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!;
    const {
      packageType,
      paymentSource,
      paymentMethodCode,
      accountReference,
      dspTargets,
      items,
    } = req.body as {
      packageType?: '2_sons' | '1_son_1_clip' | '2_sons_2_clips';
      paymentSource?: 'wallet' | 'direct_payment';
      paymentMethodCode?: string;
      accountReference?: string;
      dspTargets?: string[];
      items?: Array<{
        title: string;
        mediaType: 'audio' | 'video';
        genre: string;
        fileBase64?: string;
        fileName?: string;
        mimeType?: string;
      }>;
    };

    if (!packageType || !items || items.length < 2) {
      return res.status(400).json({ error: 'Sélectionnez un pack et au moins 2 objets à distribuer.' });
    }

    const cfg = await getPlatformConfig();
    const packPrice = cfg.distributionPackPrice; // Default: 200 000 FCFA

    const [freshUser] = await db.select().from(users).where(eq(users.id, dbUser.id)).limit(1);
    if (paymentSource !== 'direct_payment' && freshUser.walletBalance < packPrice) {
      return res.status(400).json({
        error: `Solde insuffisant (${freshUser.walletBalance} FCFA). Requis : ${packPrice} FCFA ou utilisez un paiement direct.`,
      });
    }

    // 65% Platform / 35% Artist Promo Allocation
    const platformRevenue = Math.round((packPrice * cfg.platformSharePercent) / 100);
    const artistAllocation = packPrice - platformRevenue;

    if (paymentSource !== 'direct_payment') {
      await db
        .update(users)
        .set({ walletBalance: sql`${users.walletBalance} - ${packPrice}` })
        .where(eq(users.id, dbUser.id));
    }

    // Credit 65% to Platform Treasury
    await db
      .update(platformConfig)
      .set({
        treasuryBalance: sql`${platformConfig.treasuryBalance} + ${platformRevenue}`,
        updatedAt: new Date(),
      })
      .where(eq(platformConfig.id, cfg.id));

    // Publish distributed items
    const publishedItems = [];
    for (const entry of items) {
      let finalStreamUrl = '';
      if (entry.fileBase64 && entry.fileName) {
        const ext = path.extname(entry.fileName) || (entry.mediaType === 'video' ? '.mp4' : '.mp3');
        const safeFile = `dist_${dbUser.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
        saveUploadedMediaBase64(safeFile, entry.fileBase64);
        finalStreamUrl = `/uploads/${safeFile}`;
      }
      const cover =
        entry.mediaType === 'video'
          ? '/src/assets/images/thumb_live_session_1794947040676.jpg'
          : '/src/assets/images/cover_studio_gold_1794947040048.jpg';

      const [createdMedia] = await db
        .insert(mediaItems)
        .values({
          artistId: dbUser.id,
          title: entry.title.trim(),
          artistDisplay: freshUser.artistName || freshUser.displayName,
          mediaType: entry.mediaType,
          genre: entry.genre || 'Afro-Fusion',
          durationSec: entry.mediaType === 'video' ? 240 : 205,
          coverUrl: cover,
          streamUrl: finalStreamUrl || '/api/stream/0',
          mimeType: entry.mimeType || (entry.mediaType === 'video' ? 'video/mp4' : 'audio/wav'),
          qualityAudio: '320kbps FLAC',
          qualityVideo: entry.mediaType === 'video' ? '4K Ultra HD' : null,
          priceFcfa: entry.mediaType === 'video' ? 1000 : 500,
          monetized: true,
          isPublished: true,
          isFeatured: true,
          isPrivateVault: false,
        })
        .returning();

      if (!finalStreamUrl) {
        const [patched] = await db
          .update(mediaItems)
          .set({ streamUrl: `/api/stream/${createdMedia.id}` })
          .where(eq(mediaItems.id, createdMedia.id))
          .returning();
        publishedItems.push(patched);
      } else {
        publishedItems.push(createdMedia);
      }
    }

    const targets = dspTargets?.length
      ? dspTargets
      : ['Steufa Stream', 'Spotify', 'YouTube Music', 'Apple Music', 'Boomplay'];

    const [order] = await db
      .insert(distributionOrders)
      .values({
        artistId: dbUser.id,
        packageType,
        amountPaidFcfa: packPrice,
        platformRevenueFcfa: platformRevenue,
        artistCreditFcfa: artistAllocation,
        dspTargets: JSON.stringify(targets),
        itemsPayload: JSON.stringify(
          publishedItems.map((i) => ({ id: i.id, title: i.title, mediaType: i.mediaType }))
        ),
        status: 'published',
      })
      .returning();

    await db.insert(financialTransactions).values({
      userId: dbUser.id,
      scope: 'artist',
      txType: 'distribution_pack',
      grossAmountFcfa: packPrice,
      platformShareFcfa: platformRevenue,
      artistShareFcfa: artistAllocation,
      paymentMethodCode: paymentMethodCode || 'wallet_steufa',
      accountReference: accountReference || 'Portefeuille Artiste',
      status: 'completed',
      description: `Distribution (${packageType}) — ${publishedItems.length} objets publiés (${cfg.platformSharePercent}% Plateforme)`,
      signatureHash: signLedgerEntry({
        orderId: order.id,
        artistId: dbUser.id,
        packPrice,
        platformRevenue,
      }),
    });

    return res.status(201).json({
      order,
      publishedItems,
      split: {
        gross: packPrice,
        platformShare: platformRevenue,
        artistAllocation,
      },
    });
  } catch (err) {
    console.error('Distribution launch error:', err);
    return res.status(500).json({ error: 'Échec du lancement de la distribution.' });
  }
});

app.get('/api/wallet/methods', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isCeo = req.dbUser!.role === 'ceo';
    const methods = await db
      .select()
      .from(paymentMethods)
      .where(
        isCeo
          ? eq(paymentMethods.isActive, true)
          : sql`${paymentMethods.isActive} = true AND (${paymentMethods.ownerScope} = 'artist' OR ${paymentMethods.ownerScope} = 'both')`
      )
      .orderBy(paymentMethods.id);

    return res.json({ methods });
  } catch (err) {
    console.error('Wallet methods error:', err);
    return res.status(500).json({ error: 'Impossible de charger les moyens de paiement.' });
  }
});

app.post('/api/wallet/deposit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!;
    const { amountFcfa, paymentMethodCode, accountReference } = req.body as {
      amountFcfa?: number;
      paymentMethodCode?: string;
      accountReference?: string;
    };

    const amount = Number(amountFcfa);
    if (!Number.isFinite(amount) || amount < 500) {
      return res.status(400).json({ error: 'Montant minimum de dépôt : 500 FCFA.' });
    }
    if (!paymentMethodCode || !accountReference) {
      return res.status(400).json({ error: 'Moyen de dépôt et référence requis.' });
    }

    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.code, paymentMethodCode))
      .limit(1);

    if (!method || !method.isActive || !method.supportsDeposit) {
      return res.status(400).json({ error: 'Moyen de dépôt indisponible.' });
    }

    const [updatedUser] = await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
      .where(eq(users.id, dbUser.id))
      .returning();

    const [tx] = await db
      .insert(financialTransactions)
      .values({
        userId: dbUser.id,
        scope: dbUser.role === 'ceo' ? 'ceo' : 'artist',
        txType: 'deposit',
        grossAmountFcfa: amount,
        platformShareFcfa: 0,
        artistShareFcfa: amount,
        paymentMethodCode,
        accountReference: accountReference.trim(),
        status: 'completed',
        description: `Dépôt sécurisé via ${method.name}`,
        signatureHash: signLedgerEntry({
          userId: dbUser.id,
          amount,
          txType: 'deposit',
          ts: Date.now(),
        }),
      })
      .returning();

    return res.json({
      user: sanitizeUserForClient(updatedUser),
      transaction: tx,
    });
  } catch (err) {
    console.error('Deposit error:', err);
    return res.status(500).json({ error: 'Dépôt impossible.' });
  }
});

app.post('/api/wallet/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dbUser = req.dbUser!;
    const { amountFcfa, paymentMethodCode, accountReference } = req.body as {
      amountFcfa?: number;
      paymentMethodCode?: string;
      accountReference?: string;
    };

    const amount = Number(amountFcfa);
    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: 'Montant minimum de retrait : 1 000 FCFA.' });
    }
    if (!paymentMethodCode || !accountReference) {
      return res.status(400).json({ error: 'Moyen de retrait et compte bénéficiaire requis.' });
    }

    const [freshUser] = await db.select().from(users).where(eq(users.id, dbUser.id)).limit(1);
    if (freshUser.biometricEnabled && !req.biometricVerified) {
      return res.status(403).json({
        error: 'Validation biométrique requise pour autoriser ce retrait.',
        requiresBiometric: true,
      });
    }

    if (freshUser.walletBalance < amount) {
      return res.status(400).json({ error: 'Solde insuffisant pour ce retrait.' });
    }

    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.code, paymentMethodCode))
      .limit(1);

    if (!method || !method.isActive || !method.supportsWithdrawal) {
      return res.status(400).json({ error: 'Moyen de retrait indisponible.' });
    }

    const fee = Math.round((amount * method.feePercent) / 100);
    const netAmount = amount - fee;

    const [updatedUser] = await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} - ${amount}` })
      .where(eq(users.id, dbUser.id))
      .returning();

    const [tx] = await db
      .insert(financialTransactions)
      .values({
        userId: dbUser.id,
        scope: dbUser.role === 'ceo' ? 'ceo' : 'artist',
        txType: 'withdrawal',
        grossAmountFcfa: amount,
        platformShareFcfa: fee,
        artistShareFcfa: netAmount,
        paymentMethodCode,
        accountReference: accountReference.trim(),
        status: 'completed',
        description: `Retrait sécurisé vers ${method.name} (${accountReference.trim()})`,
        signatureHash: signLedgerEntry({
          userId: dbUser.id,
          amount,
          txType: 'withdrawal',
          ts: Date.now(),
        }),
      })
      .returning();

    return res.json({
      user: sanitizeUserForClient(updatedUser),
      transaction: tx,
    });
  } catch (err) {
    console.error('Withdrawal error:', err);
    return res.status(500).json({ error: 'Retrait impossible.' });
  }
});

// ---------------------------------------------------------------------------
// 4. PRIVATE INVISIBLE CEO VAULT ("CATALOGSPDG") — STRICTLY PROTECTED
// ---------------------------------------------------------------------------

app.get('/api/catalogspdg/overview', requireCeo, async (_req: AuthRequest, res: Response) => {
  try {
    const cfg = await getPlatformConfig();
    const vaultMetadata = await getDecryptedCeoVaultNotes(cfg.encryptedCeoVault);

    const allMedia = await db.select().from(mediaItems).orderBy(desc(mediaItems.createdAt));
    const allUsersRaw = await db.select().from(users).orderBy(desc(users.createdAt));
    const allUsers = allUsersRaw.map(sanitizeUserForClient);
    const allMethods = await db.select().from(paymentMethods).orderBy(paymentMethods.id);
    const allTransactions = await db
      .select()
      .from(financialTransactions)
      .orderBy(desc(financialTransactions.createdAt))
      .limit(100);
    const allOrders = await db
      .select()
      .from(distributionOrders)
      .orderBy(desc(distributionOrders.createdAt))
      .limit(50);

    return res.json({
      config: {
        id: cfg.id,
        platformSharePercent: cfg.platformSharePercent,
        artistSharePercent: cfg.artistSharePercent,
        distributionPackPrice: cfg.distributionPackPrice,
        streamRateFcfa: cfg.streamRateFcfa,
        videoViewRateFcfa: cfg.videoViewRateFcfa,
        downloadRateFcfa: cfg.downloadRateFcfa,
        treasuryBalance: cfg.treasuryBalance,
        updatedAt: cfg.updatedAt,
      },
      vaultMetadata,
      media: allMedia,
      users: allUsers,
      paymentMethods: allMethods,
      transactions: allTransactions,
      distributionOrders: allOrders,
    });
  } catch (err) {
    console.error('CEO overview error:', err);
    return res.status(500).json({ error: 'Erreur coffre-fort direction.' });
  }
});

app.patch('/api/catalogspdg/config', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const cfg = await getPlatformConfig();
    const {
      platformSharePercent,
      distributionPackPrice,
      streamRateFcfa,
      videoViewRateFcfa,
      downloadRateFcfa,
      auditNotes,
    } = req.body as {
      platformSharePercent?: number;
      distributionPackPrice?: number;
      streamRateFcfa?: number;
      videoViewRateFcfa?: number;
      downloadRateFcfa?: number;
      auditNotes?: string;
    };

    const nextPlatformPct =
      platformSharePercent !== undefined
        ? Math.min(100, Math.max(0, Number(platformSharePercent)))
        : cfg.platformSharePercent;
    const nextArtistPct = 100 - nextPlatformPct;

    const currentVault = await getDecryptedCeoVaultNotes(cfg.encryptedCeoVault);
    const nextEncryptedVault = encryptAES256GCM(
      JSON.stringify({
        ...currentVault,
        auditNotes: auditNotes !== undefined ? auditNotes : currentVault.auditNotes,
        lastModifiedAt: new Date().toISOString(),
      })
    );

    const [updated] = await db
      .update(platformConfig)
      .set({
        platformSharePercent: nextPlatformPct,
        artistSharePercent: nextArtistPct,
        distributionPackPrice:
          distributionPackPrice !== undefined
            ? Number(distributionPackPrice)
            : cfg.distributionPackPrice,
        streamRateFcfa:
          streamRateFcfa !== undefined ? Number(streamRateFcfa) : cfg.streamRateFcfa,
        videoViewRateFcfa:
          videoViewRateFcfa !== undefined ? Number(videoViewRateFcfa) : cfg.videoViewRateFcfa,
        downloadRateFcfa:
          downloadRateFcfa !== undefined ? Number(downloadRateFcfa) : cfg.downloadRateFcfa,
        encryptedCeoVault: nextEncryptedVault,
        updatedAt: new Date(),
      })
      .where(eq(platformConfig.id, cfg.id))
      .returning();

    return res.json({ config: updated });
  } catch (err) {
    console.error('CEO config update error:', err);
    return res.status(500).json({ error: 'Modification configuration impossible.' });
  }
});

app.post('/api/catalogspdg/payment-methods', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      code,
      ownerScope,
      supportsDeposit,
      supportsWithdrawal,
      feePercent,
      minAmount,
      maxAmount,
      instructions,
    } = req.body as {
      name?: string;
      code?: string;
      ownerScope?: 'artist' | 'ceo' | 'both';
      supportsDeposit?: boolean;
      supportsWithdrawal?: boolean;
      feePercent?: number;
      minAmount?: number;
      maxAmount?: number;
      instructions?: string;
    };

    if (!name || !code) {
      return res.status(400).json({ error: 'Nom et code du moyen de paiement requis.' });
    }

    const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const [created] = await db
      .insert(paymentMethods)
      .values({
        name: name.trim(),
        code: cleanCode,
        ownerScope: ownerScope || 'both',
        supportsDeposit: supportsDeposit ?? true,
        supportsWithdrawal: supportsWithdrawal ?? true,
        feePercent: Number(feePercent) || 0,
        minAmount: Number(minAmount) || 1000,
        maxAmount: Number(maxAmount) || 50000000,
        instructions: instructions || 'Canal configuré par la Direction Générale.',
        isActive: true,
      })
      .returning();

    return res.status(201).json({ method: created });
  } catch (err) {
    console.error('Create payment method error:', err);
    return res.status(500).json({ error: 'Impossible de créer le moyen de paiement.' });
  }
});

app.patch('/api/catalogspdg/payment-methods/:id', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<typeof paymentMethods.$inferInsert>;
    const [updated] = await db
      .update(paymentMethods)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.ownerScope !== undefined ? { ownerScope: body.ownerScope } : {}),
        ...(body.supportsDeposit !== undefined ? { supportsDeposit: body.supportsDeposit } : {}),
        ...(body.supportsWithdrawal !== undefined
          ? { supportsWithdrawal: body.supportsWithdrawal }
          : {}),
        ...(body.feePercent !== undefined ? { feePercent: Number(body.feePercent) } : {}),
        ...(body.minAmount !== undefined ? { minAmount: Number(body.minAmount) } : {}),
        ...(body.maxAmount !== undefined ? { maxAmount: Number(body.maxAmount) } : {}),
        ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .where(eq(paymentMethods.id, id))
      .returning();

    return res.json({ method: updated });
  } catch (err) {
    console.error('Update payment method error:', err);
    return res.status(500).json({ error: 'Mise à jour impossible.' });
  }
});

app.delete('/api/catalogspdg/payment-methods/:id', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete payment method error:', err);
    return res.status(500).json({ error: 'Suppression impossible.' });
  }
});

app.post('/api/catalogspdg/media', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      artistDisplay,
      mediaType,
      genre,
      priceFcfa,
      isPrivateVault,
      isFeatured,
      monetized,
    } = req.body as {
      title?: string;
      artistDisplay?: string;
      mediaType?: 'audio' | 'video';
      genre?: string;
      priceFcfa?: number;
      isPrivateVault?: boolean;
      isFeatured?: boolean;
      monetized?: boolean;
    };

    if (!title) {
      return res.status(400).json({ error: 'Titre requis.' });
    }

    const cover =
      mediaType === 'video'
        ? '/src/assets/images/thumb_cinematic_clip_1794947041062.jpg'
        : '/src/assets/images/banner_artist_studio_1794947042295.jpg';

    const [created] = await db
      .insert(mediaItems)
      .values({
        artistId: req.dbUser!.id,
        title: title.trim(),
        artistDisplay: artistDisplay || 'Steufa Executive Archive',
        mediaType: mediaType || 'audio',
        genre: genre || 'Exclusive',
        durationSec: 225,
        coverUrl: cover,
        streamUrl: '/api/stream/0',
        mimeType: mediaType === 'video' ? 'video/mp4' : 'audio/wav',
        qualityAudio: 'Studio Master 96kHz',
        qualityVideo: mediaType === 'video' ? '4K Ultra HD' : null,
        priceFcfa: Number(priceFcfa) || 1500,
        monetized: monetized ?? true,
        isPublished: true,
        isFeatured: isFeatured ?? false,
        isPrivateVault: isPrivateVault ?? true,
      })
      .returning();

    const [updated] = await db
      .update(mediaItems)
      .set({ streamUrl: `/api/stream/${created.id}` })
      .where(eq(mediaItems.id, created.id))
      .returning();

    return res.status(201).json({ item: updated });
  } catch (err) {
    console.error('CEO add media error:', err);
    return res.status(500).json({ error: 'Ajout au catalogue privé impossible.' });
  }
});

app.patch('/api/catalogspdg/media/:id', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<typeof mediaItems.$inferInsert>;
    const [updated] = await db
      .update(mediaItems)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.artistDisplay !== undefined ? { artistDisplay: body.artistDisplay } : {}),
        ...(body.genre !== undefined ? { genre: body.genre } : {}),
        ...(body.priceFcfa !== undefined ? { priceFcfa: Number(body.priceFcfa) } : {}),
        ...(body.monetized !== undefined ? { monetized: body.monetized } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        ...(body.isPrivateVault !== undefined ? { isPrivateVault: body.isPrivateVault } : {}),
      })
      .where(eq(mediaItems.id, id))
      .returning();

    return res.json({ item: updated });
  } catch (err) {
    console.error('CEO update media error:', err);
    return res.status(500).json({ error: 'Modification média impossible.' });
  }
});

app.delete('/api/catalogspdg/media/:id', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(mediaItems).where(eq(mediaItems.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error('CEO delete media error:', err);
    return res.status(500).json({ error: 'Suppression média impossible.' });
  }
});

app.patch('/api/catalogspdg/users/:id', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { isActive, role, walletAdjustment } = req.body as {
      isActive?: boolean;
      role?: string;
      walletAdjustment?: number;
    };

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const newBalance =
      walletAdjustment !== undefined
        ? Math.max(0, target.walletBalance + Number(walletAdjustment))
        : target.walletBalance;

    const [updated] = await db
      .update(users)
      .set({
        ...(isActive !== undefined ? { isActive } : {}),
        ...(role !== undefined && target.role !== 'ceo' ? { role } : {}),
        walletBalance: newBalance,
      })
      .where(eq(users.id, id))
      .returning();

    if (walletAdjustment) {
      await db.insert(financialTransactions).values({
        userId: target.id,
        scope: 'ceo',
        txType: 'ceo_adjustment',
        grossAmountFcfa: Math.abs(Number(walletAdjustment)),
        platformShareFcfa: 0,
        artistShareFcfa: Number(walletAdjustment),
        paymentMethodCode: 'ceo_treasury_wire',
        accountReference: `Ajustement PDG (${target.email})`,
        status: 'completed',
        description: `Ajustement manuel Direction Générale (${Number(walletAdjustment) >= 0 ? '+' : ''}${walletAdjustment} FCFA)`,
        signatureHash: signLedgerEntry({ targetId: target.id, walletAdjustment, ts: Date.now() }),
      });
    }

    return res.json({ user: sanitizeUserForClient(updated) });
  } catch (err) {
    console.error('CEO update user error:', err);
    return res.status(500).json({ error: 'Mise à jour utilisateur impossible.' });
  }
});

app.post('/api/catalogspdg/treasury/transaction', requireCeo, async (req: AuthRequest, res: Response) => {
  try {
    const { txType, amountFcfa, paymentMethodCode, accountReference, notes } = req.body as {
      txType?: 'deposit' | 'withdrawal';
      amountFcfa?: number;
      paymentMethodCode?: string;
      accountReference?: string;
      notes?: string;
    };

    const amount = Number(amountFcfa);
    if (!txType || !Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: 'Type et montant valide requis (min 1 000 FCFA).' });
    }

    const cfg = await getPlatformConfig();
    if (txType === 'withdrawal' && cfg.treasuryBalance < amount) {
      return res.status(400).json({ error: 'Trésorerie plateforme insuffisante pour ce retrait.' });
    }

    const nextTreasury =
      txType === 'deposit' ? cfg.treasuryBalance + amount : cfg.treasuryBalance - amount;

    await db
      .update(platformConfig)
      .set({ treasuryBalance: nextTreasury, updatedAt: new Date() })
      .where(eq(platformConfig.id, cfg.id));

    const [tx] = await db
      .insert(financialTransactions)
      .values({
        userId: req.dbUser!.id,
        scope: 'ceo',
        txType,
        grossAmountFcfa: amount,
        platformShareFcfa: amount,
        artistShareFcfa: 0,
        paymentMethodCode: paymentMethodCode || 'ceo_treasury_wire',
        accountReference: accountReference || 'Trésorerie PDG',
        status: 'completed',
        description:
          notes ||
          (txType === 'deposit'
            ? `Injection Trésorerie PDG (${paymentMethodCode || 'Virement'})`
            : `Retrait Trésorerie PDG vers ${accountReference || 'Compte Direction'}`),
        signatureHash: signLedgerEntry({
          scope: 'ceo',
          txType,
          amount,
          ts: Date.now(),
        }),
      })
      .returning();

    return res.json({ treasuryBalance: nextTreasury, transaction: tx });
  } catch (err) {
    console.error('CEO treasury transaction error:', err);
    return res.status(500).json({ error: 'Opération trésorerie PDG impossible.' });
  }
});

// ---------------------------------------------------------------------------
// 5. VITE / STATIC SPA SERVING ON PORT 3000
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Steufa Stream server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
