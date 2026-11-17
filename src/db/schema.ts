import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  artistName: text('artist_name'),
  role: text('role').notNull().default('listener'), // 'listener' | 'artist' | 'ceo'
  passwordHash: text('password_hash'),
  walletBalance: integer('wallet_balance').notNull().default(0),
  totalEarned: integer('total_earned').notNull().default(0),
  biometricEnabled: boolean('biometric_enabled').notNull().default(false),
  biometricCredentialId: text('biometric_credential_id'),
  biometricSecretHash: text('biometric_secret_hash'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const encryptedSessions = pgTable('encrypted_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  encryptedPayload: text('encrypted_payload').notNull(),
  biometricVerified: boolean('biometric_verified').notNull().default(false),
  userAgentHash: text('user_agent_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const platformConfig = pgTable('platform_config', {
  id: serial('id').primaryKey(),
  platformSharePercent: integer('platform_share_percent').notNull().default(65),
  artistSharePercent: integer('artist_share_percent').notNull().default(35),
  distributionPackPrice: integer('distribution_pack_price').notNull().default(200000),
  streamRateFcfa: integer('stream_rate_fcfa').notNull().default(50),
  videoViewRateFcfa: integer('video_view_rate_fcfa').notNull().default(100),
  downloadRateFcfa: integer('download_rate_fcfa').notNull().default(250),
  treasuryBalance: integer('treasury_balance').notNull().default(0),
  encryptedCeoVault: text('encrypted_ceo_vault').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  ownerScope: text('owner_scope').notNull().default('both'), // 'artist' | 'ceo' | 'both'
  supportsDeposit: boolean('supports_deposit').notNull().default(true),
  supportsWithdrawal: boolean('supports_withdrawal').notNull().default(true),
  feePercent: integer('fee_percent').notNull().default(0),
  minAmount: integer('min_amount').notNull().default(1000),
  maxAmount: integer('max_amount').notNull().default(50000000),
  instructions: text('instructions').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const mediaItems = pgTable('media_items', {
  id: serial('id').primaryKey(),
  artistId: integer('artist_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  artistDisplay: text('artist_display').notNull(),
  mediaType: text('media_type').notNull().default('audio'), // 'audio' | 'video'
  genre: text('genre').notNull().default('Afro-Fusion'),
  durationSec: integer('duration_sec').notNull().default(210),
  coverUrl: text('cover_url').notNull(),
  streamUrl: text('stream_url').notNull(),
  mimeType: text('mime_type').notNull().default('audio/wav'),
  qualityAudio: text('quality_audio').notNull().default('320kbps FLAC'),
  qualityVideo: text('quality_video').default('1080p HD'),
  priceFcfa: integer('price_fcfa').notNull().default(500),
  monetized: boolean('monetized').notNull().default(true),
  isPublished: boolean('is_published').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  isPrivateVault: boolean('is_private_vault').notNull().default(false),
  playsCount: integer('plays_count').notNull().default(0),
  downloadsCount: integer('downloads_count').notNull().default(0),
  grossRevenueFcfa: integer('gross_revenue_fcfa').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const distributionOrders = pgTable('distribution_orders', {
  id: serial('id').primaryKey(),
  artistId: integer('artist_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  packageType: text('package_type').notNull(), // '2_sons' | '1_son_1_clip' | '2_sons_2_clips'
  amountPaidFcfa: integer('amount_paid_fcfa').notNull(),
  platformRevenueFcfa: integer('platform_revenue_fcfa').notNull(),
  artistCreditFcfa: integer('artist_credit_fcfa').notNull(),
  dspTargets: text('dsp_targets').notNull(),
  itemsPayload: text('items_payload').notNull(),
  status: text('status').notNull().default('published'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const financialTransactions = pgTable('financial_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  scope: text('scope').notNull().default('artist'), // 'artist' | 'ceo' | 'platform'
  txType: text('tx_type').notNull(), // 'deposit' | 'withdrawal' | 'stream_royalty' | 'download_royalty' | 'distribution_pack' | 'ceo_adjustment'
  grossAmountFcfa: integer('gross_amount_fcfa').notNull(),
  platformShareFcfa: integer('platform_share_fcfa').notNull().default(0),
  artistShareFcfa: integer('artist_share_fcfa').notNull().default(0),
  paymentMethodCode: text('payment_method_code'),
  accountReference: text('account_reference'),
  status: text('status').notNull().default('completed'), // 'pending' | 'completed' | 'rejected'
  description: text('description').notNull(),
  signatureHash: text('signature_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const offlineVault = pgTable('offline_vault', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  mediaItemId: integer('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .notNull(),
  format: text('format').notNull(),
  fileSizeMb: integer('file_size_mb').notNull().default(12),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  mediaItems: many(mediaItems),
  sessions: many(encryptedSessions),
  distributions: many(distributionOrders),
  transactions: many(financialTransactions),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one }) => ({
  artist: one(users, {
    fields: [mediaItems.artistId],
    references: [users.id],
  }),
}));
