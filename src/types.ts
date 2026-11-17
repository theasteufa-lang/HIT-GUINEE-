export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  artistName: string | null;
  role: 'listener' | 'artist' | 'ceo';
  walletBalance: number;
  totalEarned: number;
  biometricEnabled: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface MediaItem {
  id: number;
  artistId: number;
  title: string;
  artistDisplay: string;
  mediaType: 'audio' | 'video';
  genre: string;
  durationSec: number;
  coverUrl: string;
  streamUrl: string;
  mimeType: string;
  qualityAudio: string;
  qualityVideo: string | null;
  priceFcfa: number;
  monetized: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isPrivateVault: boolean;
  playsCount: number;
  downloadsCount: number;
  grossRevenueFcfa: number;
  createdAt?: string;
}

export interface PlatformPricing {
  platformSharePercent: number;
  artistSharePercent: number;
  distributionPackPrice: number;
  streamRateFcfa: number;
  videoViewRateFcfa: number;
  downloadRateFcfa: number;
  treasuryBalance?: number;
}

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  ownerScope: 'artist' | 'ceo' | 'both';
  supportsDeposit: boolean;
  supportsWithdrawal: boolean;
  feePercent: number;
  minAmount: number;
  maxAmount: number;
  instructions: string;
  isActive: boolean;
}

export interface FinancialTransaction {
  id: number;
  userId: number | null;
  scope: string;
  txType: string;
  grossAmountFcfa: number;
  platformShareFcfa: number;
  artistShareFcfa: number;
  paymentMethodCode: string | null;
  accountReference: string | null;
  status: string;
  description: string;
  signatureHash: string;
  createdAt: string;
}

export interface DistributionOrder {
  id: number;
  artistId: number;
  packageType: '2_sons' | '1_son_1_clip' | '2_sons_2_clips';
  amountPaidFcfa: number;
  platformRevenueFcfa: number;
  artistCreditFcfa: number;
  dspTargets: string;
  itemsPayload: string;
  status: string;
  createdAt: string;
}

export interface OfflineVaultEntry {
  id: number;
  format: string;
  fileSizeMb: number;
  createdAt: string;
  mediaId: number;
  title: string;
  artistDisplay: string;
  mediaType: 'audio' | 'video';
  coverUrl: string;
}

export type AppSection =
  | 'discover'
  | 'videos'
  | 'downloads'
  | 'artist'
  | 'wallet'
  | 'catalogspdg';
