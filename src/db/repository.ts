import { desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  distributionOrders,
  encryptedSessions,
  financialTransactions,
  mediaItems,
  offlineVault,
  paymentMethods,
  platformConfig,
  users,
} from './schema.ts';
import {
  decryptAES256GCM,
  encryptAES256GCM,
  hashPasswordScrypt,
  signLedgerEntry,
} from '../lib/crypto.ts';

let seedPromise: Promise<void> | null = null;
let seededDone = false;

export async function ensureSeeded(): Promise<void> {
  if (seededDone) return;
  if (!seedPromise) {
    seedPromise = runInitialSeed()
      .then(() => {
        seededDone = true;
      })
      .catch((err) => {
        seedPromise = null;
        console.error('Database seed error:', err);
        throw new Error('Database initialization failed.', { cause: err });
      });
  }
  return seedPromise;
}

async function runInitialSeed(): Promise<void> {
  // 1. Seed Platform Config (65% Platform / 35% Artist, 200 000 FCFA Distribution Pack)
  const existingConfig = await db.select().from(platformConfig).limit(1);
  if (existingConfig.length === 0) {
    const encryptedVault = encryptAES256GCM(
      JSON.stringify({
        vaultTitle: 'CatalogsPDG — Coffre-Fort Direction Générale',
        clearanceLevel: 'TOP_SECRET_CEO_ONLY',
        auditNotes: 'Contrôle total des catalogues, commissions 65/35, retraits et dépôts.',
        initializedAt: new Date().toISOString(),
      })
    );
    await db.insert(platformConfig).values({
      platformSharePercent: 65,
      artistSharePercent: 35,
      distributionPackPrice: 200000,
      streamRateFcfa: 50,
      videoViewRateFcfa: 100,
      downloadRateFcfa: 250,
      treasuryBalance: 4875000,
      encryptedCeoVault: encryptedVault,
    });
  }

  // 2. Seed Private CEO User (server-side scrypt hash, never exposed to client)
  const ceoEmail = (process.env.CEO_EMAIL || 'theasteufa@gmail.com').toLowerCase();
  const ceoSecret = process.env.CEO_PASSWORD || '12(9)@steufa';

  const existingCeo = await db.select().from(users).where(eq(users.email, ceoEmail)).limit(1);
  let ceoId: number;
  if (existingCeo.length === 0) {
    const [insertedCeo] = await db
      .insert(users)
      .values({
        uid: 'ceo_vault_master_steufa',
        email: ceoEmail,
        displayName: 'Direction Générale Steufa',
        artistName: 'Steufa Executive',
        role: 'ceo',
        passwordHash: hashPasswordScrypt(ceoSecret),
        walletBalance: 4875000,
        totalEarned: 4875000,
        biometricEnabled: true,
        isActive: true,
      })
      .returning();
    ceoId = insertedCeo.id;
  } else {
    ceoId = existingCeo[0].id;
  }

  // 3. Seed Demo Artists if catalog is empty
  const existingMedia = await db.select().from(mediaItems).limit(1);
  if (existingMedia.length === 0) {
    const [artist1] = await db
      .insert(users)
      .values({
        uid: 'artist_koffi_solis',
        email: 'koffi.solis@steufastream.com',
        displayName: 'Koffi Solis',
        artistName: 'Koffi Solis',
        role: 'artist',
        passwordHash: hashPasswordScrypt('SteufaArtist2026!'),
        walletBalance: 642500,
        totalEarned: 985000,
        biometricEnabled: false,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: 'Koffi Solis' },
      })
      .returning();

    const [artist2] = await db
      .insert(users)
      .values({
        uid: 'artist_amina_kenza',
        email: 'amina.kenza@steufastream.com',
        displayName: 'Amina Kenza',
        artistName: 'Amina Kenza',
        role: 'artist',
        passwordHash: hashPasswordScrypt('SteufaArtist2026!'),
        walletBalance: 418000,
        totalEarned: 712000,
        biometricEnabled: false,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { displayName: 'Amina Kenza' },
      })
      .returning();

    // Seed Media Items with generated high-res artwork
    const seededItems = await db
      .insert(mediaItems)
      .values([
        {
          artistId: artist1.id,
          title: 'Minuit à Kinshasa',
          artistDisplay: 'Koffi Solis',
          mediaType: 'audio',
          genre: 'Afro-Électro',
          durationSec: 214,
          coverUrl: '/src/assets/images/cover_afro_synth_1794947039343.jpg',
          streamUrl: '/api/stream/1',
          mimeType: 'audio/wav',
          qualityAudio: 'FLAC Lossless 24-bit',
          qualityVideo: null,
          priceFcfa: 500,
          monetized: true,
          isPublished: true,
          isFeatured: true,
          isPrivateVault: false,
          playsCount: 18420,
          downloadsCount: 1420,
          grossRevenueFcfa: 1276000,
        },
        {
          artistId: artist2.id,
          title: 'Couronne de Bronze',
          artistDisplay: 'Amina Kenza',
          mediaType: 'audio',
          genre: 'Soul Urbaine',
          durationSec: 198,
          coverUrl: '/src/assets/images/cover_studio_gold_1794947040048.jpg',
          streamUrl: '/api/stream/2',
          mimeType: 'audio/wav',
          qualityAudio: '320kbps Master',
          qualityVideo: null,
          priceFcfa: 500,
          monetized: true,
          isPublished: true,
          isFeatured: true,
          isPrivateVault: false,
          playsCount: 14950,
          downloadsCount: 980,
          grossRevenueFcfa: 992500,
        },
        {
          artistId: artist1.id,
          title: 'Session Acoustique Studio Steufa (Clip 4K)',
          artistDisplay: 'Koffi Solis & Amina Kenza',
          mediaType: 'video',
          genre: 'Live Session',
          durationSec: 286,
          coverUrl: '/src/assets/images/thumb_live_session_1794947040676.jpg',
          streamUrl: '/api/stream/3',
          mimeType: 'audio/wav',
          qualityAudio: '320kbps AAC',
          qualityVideo: '4K Ultra HD 60fps',
          priceFcfa: 1000,
          monetized: true,
          isPublished: true,
          isFeatured: true,
          isPrivateVault: false,
          playsCount: 24100,
          downloadsCount: 2150,
          grossRevenueFcfa: 2947500,
        },
        {
          artistId: artist2.id,
          title: 'Horizon Nocturne — Clip Officiel',
          artistDisplay: 'Amina Kenza',
          mediaType: 'video',
          genre: 'Afro-Pop Cinéma',
          durationSec: 245,
          coverUrl: '/src/assets/images/thumb_cinematic_clip_1794947041062.jpg',
          streamUrl: '/api/stream/4',
          mimeType: 'audio/wav',
          qualityAudio: '320kbps AAC',
          qualityVideo: '1080p Full HD',
          priceFcfa: 1000,
          monetized: true,
          isPublished: true,
          isFeatured: false,
          isPrivateVault: false,
          playsCount: 11840,
          downloadsCount: 890,
          grossRevenueFcfa: 1406500,
        },
        {
          artistId: ceoId,
          title: 'Mastering Analogique — Master Exclusif Direction',
          artistDisplay: 'Steufa Executive Archive',
          mediaType: 'audio',
          genre: 'Collector Vault',
          durationSec: 262,
          coverUrl: '/src/assets/images/banner_artist_studio_1794947042295.jpg',
          streamUrl: '/api/stream/5',
          mimeType: 'audio/wav',
          qualityAudio: 'Studio Master 96kHz',
          qualityVideo: null,
          priceFcfa: 2500,
          monetized: true,
          isPublished: true,
          isFeatured: false,
          isPrivateVault: true,
          playsCount: 340,
          downloadsCount: 85,
          grossRevenueFcfa: 212500,
        },
      ])
      .returning();

    // Update streamUrl to match exact DB IDs
    for (const item of seededItems) {
      await db
        .update(mediaItems)
        .set({ streamUrl: `/api/stream/${item.id}` })
        .where(eq(mediaItems.id, item.id));
    }

    // Seed initial signed financial transactions
    const txPayload1 = {
      scope: 'platform',
      txType: 'distribution_pack',
      gross: 200000,
      platformShare: 130000,
      artistShare: 70000,
    };
    await db.insert(financialTransactions).values([
      {
        userId: artist1.id,
        scope: 'artist',
        txType: 'distribution_pack',
        grossAmountFcfa: 200000,
        platformShareFcfa: 130000,
        artistShareFcfa: 70000,
        paymentMethodCode: 'orange_money',
        accountReference: '+225 07••••42',
        status: 'completed',
        description: 'Pack Distribution Lancement (1 Son + 1 Clip) — Part Plateforme 65%',
        signatureHash: signLedgerEntry(txPayload1),
      },
      {
        userId: artist2.id,
        scope: 'artist',
        txType: 'stream_royalty',
        grossAmountFcfa: 50000,
        platformShareFcfa: 32500,
        artistShareFcfa: 17500,
        paymentMethodCode: 'wave_ci',
        accountReference: 'Royalties Streaming',
        status: 'completed',
        description: 'Règlement Royalties Streaming HD (65% Steufa / 35% Artiste)',
        signatureHash: signLedgerEntry({ scope: 'artist', txType: 'stream_royalty', gross: 50000 }),
      },
    ]);
  }

  // 4. Seed Payment Methods (Artist + CEO)
  const existingMethods = await db.select().from(paymentMethods).limit(1);
  if (existingMethods.length === 0) {
    await db.insert(paymentMethods).values([
      {
        name: 'Orange Money',
        code: 'orange_money',
        ownerScope: 'both',
        supportsDeposit: true,
        supportsWithdrawal: true,
        feePercent: 1,
        minAmount: 1000,
        maxAmount: 5000000,
        instructions: 'Numéro Mobile Money vérifié (+225 / +237 / +221)',
        isActive: true,
      },
      {
        name: 'MTN Mobile Money',
        code: 'mtn_momo',
        ownerScope: 'both',
        supportsDeposit: true,
        supportsWithdrawal: true,
        feePercent: 1,
        minAmount: 1000,
        maxAmount: 5000000,
        instructions: 'Compte MoMo actif avec validation USSD / Biométrique',
        isActive: true,
      },
      {
        name: 'Wave Transfert Instantané',
        code: 'wave_ci',
        ownerScope: 'both',
        supportsDeposit: true,
        supportsWithdrawal: true,
        feePercent: 0,
        minAmount: 500,
        maxAmount: 10000000,
        instructions: 'Zéro frais sur dépôt et retrait instantané 24/7',
        isActive: true,
      },
      {
        name: 'Virement Bancaire IBAN / UEMOA',
        code: 'bank_iban',
        ownerScope: 'both',
        supportsDeposit: true,
        supportsWithdrawal: true,
        feePercent: 0,
        minAmount: 25000,
        maxAmount: 100000000,
        instructions: 'RIB / IBAN complet avec code SWIFT/BIC',
        isActive: true,
      },
      {
        name: 'Carte Visa / Mastercard',
        code: 'visa_mc',
        ownerScope: 'artist',
        supportsDeposit: true,
        supportsWithdrawal: false,
        feePercent: 2,
        minAmount: 2000,
        maxAmount: 15000000,
        instructions: 'Paiement carte sécurisé 3D Secure pour packs distribution',
        isActive: true,
      },
      {
        name: 'Compte Trésorerie Direction PDG',
        code: 'ceo_treasury_wire',
        ownerScope: 'ceo',
        supportsDeposit: true,
        supportsWithdrawal: true,
        feePercent: 0,
        minAmount: 10000,
        maxAmount: 500000000,
        instructions: 'Canal chiffré réservé au compte Direction Générale PDG',
        isActive: true,
      },
    ]);
  }
}

export async function getPlatformConfig() {
  try {
    await ensureSeeded();
    const rows = await db.select().from(platformConfig).limit(1);
    return rows[0];
  } catch (err) {
    throw new Error('Failed to load platform configuration.', { cause: err });
  }
}

export async function getDecryptedCeoVaultNotes(encryptedCeoVault: string) {
  try {
    return JSON.parse(decryptAES256GCM(encryptedCeoVault));
  } catch {
    return { vaultTitle: 'CatalogsPDG', clearanceLevel: 'CEO_ONLY' };
  }
}

export async function getUserByEmail(email: string) {
  try {
    await ensureSeeded();
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return rows[0] || null;
  } catch (err) {
    throw new Error('User lookup failed.', { cause: err });
  }
}

export async function getOrCreateFirebaseUser(uid: string, email: string, displayName: string) {
  try {
    await ensureSeeded();
    const normalizedEmail = email.toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({ uid, displayName: displayName || existing[0].displayName })
        .where(eq(users.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split('@')[0],
        artistName: displayName || normalizedEmail.split('@')[0],
        role: 'artist',
        walletBalance: 250000, // Starter artist credit for testing distribution or withdrawals
        totalEarned: 0,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email: normalizedEmail },
      })
      .returning();
    return created;
  } catch (err) {
    throw new Error('Failed to synchronize user account.', { cause: err });
  }
}

export async function getPublicCatalog() {
  try {
    await ensureSeeded();
    const items = await db
      .select()
      .from(mediaItems)
      .where(sql`${mediaItems.isPublished} = true AND ${mediaItems.isPrivateVault} = false`)
      .orderBy(desc(mediaItems.isFeatured), desc(mediaItems.playsCount));
    const cfg = await getPlatformConfig();
    return {
      items,
      pricing: {
        platformSharePercent: cfg.platformSharePercent,
        artistSharePercent: cfg.artistSharePercent,
        distributionPackPrice: cfg.distributionPackPrice,
        streamRateFcfa: cfg.streamRateFcfa,
        videoViewRateFcfa: cfg.videoViewRateFcfa,
        downloadRateFcfa: cfg.downloadRateFcfa,
      },
    };
  } catch (err) {
    throw new Error('Failed to fetch streaming catalog.', { cause: err });
  }
}

export async function recordMediaMonetization(
  mediaId: number,
  actionType: 'play' | 'download',
  listenerUserId?: number,
  downloadFormat?: string
) {
  try {
    await ensureSeeded();
    const cfg = await getPlatformConfig();
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaId)).limit(1);
    if (!item) return null;

    let gross = 0;
    if (item.monetized) {
      if (actionType === 'download') {
        gross = Math.max(cfg.downloadRateFcfa, item.priceFcfa);
      } else {
        gross = item.mediaType === 'video' ? cfg.videoViewRateFcfa : cfg.streamRateFcfa;
      }
    }

    const platformShare = Math.round((gross * cfg.platformSharePercent) / 100);
    const artistShare = gross - platformShare;

    // Update media metrics
    await db
      .update(mediaItems)
      .set({
        playsCount: actionType === 'play' ? sql`${mediaItems.playsCount} + 1` : item.playsCount,
        downloadsCount:
          actionType === 'download' ? sql`${mediaItems.downloadsCount} + 1` : item.downloadsCount,
        grossRevenueFcfa: sql`${mediaItems.grossRevenueFcfa} + ${gross}`,
      })
      .where(eq(mediaItems.id, mediaId));

    if (gross > 0) {
      // Credit 65% to Platform Treasury
      await db
        .update(platformConfig)
        .set({
          treasuryBalance: sql`${platformConfig.treasuryBalance} + ${platformShare}`,
          updatedAt: new Date(),
        })
        .where(eq(platformConfig.id, cfg.id));

      // Credit 35% to Artist Wallet
      await db
        .update(users)
        .set({
          walletBalance: sql`${users.walletBalance} + ${artistShare}`,
          totalEarned: sql`${users.totalEarned} + ${artistShare}`,
        })
        .where(eq(users.id, item.artistId));

      // Record signed financial ledger entry
      await db.insert(financialTransactions).values({
        userId: item.artistId,
        scope: 'artist',
        txType: actionType === 'download' ? 'download_royalty' : 'stream_royalty',
        grossAmountFcfa: gross,
        platformShareFcfa: platformShare,
        artistShareFcfa: artistShare,
        paymentMethodCode: 'steufa_monetization',
        accountReference: `${item.mediaType.toUpperCase()} #${item.id}`,
        status: 'completed',
        description:
          actionType === 'download'
            ? `Téléchargement HD (${downloadFormat || '320kbps'}) — "${item.title}"`
            : `Lecture monétisée — "${item.title}"`,
        signatureHash: signLedgerEntry({
          mediaId,
          actionType,
          gross,
          platformShare,
          artistShare,
          ts: Date.now(),
        }),
      });
    }

    if (actionType === 'download' && listenerUserId) {
      await db.insert(offlineVault).values({
        userId: listenerUserId,
        mediaItemId: item.id,
        format: downloadFormat || (item.mediaType === 'video' ? 'MP4 1080p' : 'MP3 320kbps'),
        fileSizeMb: item.mediaType === 'video' ? 48 : 9,
      });
    }

    return {
      gross,
      platformShare,
      artistShare,
      platformSharePercent: cfg.platformSharePercent,
      artistSharePercent: cfg.artistSharePercent,
    };
  } catch (err) {
    throw new Error('Failed to record monetization event.', { cause: err });
  }
}

export function sanitizeUserForClient(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    artistName: user.artistName,
    role: user.role,
    walletBalance: user.walletBalance,
    totalEarned: user.totalEarned,
    biometricEnabled: user.biometricEnabled,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
