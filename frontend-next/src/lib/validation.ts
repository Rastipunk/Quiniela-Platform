// Centralized form input constraints — single source of truth
// These should match backend Zod schemas to prevent client/server mismatch.

export const LIMITS = {
  // User profile
  username: { min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ },
  displayName: { max: 50 },
  firstName: { max: 100 },
  lastName: { max: 100 },
  bio: { max: 200 },
  password: { min: 8, max: 128 },

  // Pool
  poolName: { min: 3, max: 120 },
  poolDescription: { max: 500 },
  deadlineMinutes: { min: 0, max: 10080 }, // 7 days

  // Corporate
  companyName: { min: 2, max: 200 },
  welcomeMessage: { max: 1000 },
  invitationMessage: { max: 1000 },
  contactName: { max: 100 },
  contactPhone: { max: 30 },
  inquiryMessage: { max: 2000 },
  emailsArrayMax: 500,

  // Match
  goals: { min: 0, max: 99 },

  // Scoring
  pointsPerRule: { min: 0, max: 1000 },

  // Upload
  logoMaxBytes: 500 * 1024, // 500 KB
} as const;
