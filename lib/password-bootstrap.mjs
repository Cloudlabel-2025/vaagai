// Salted hash of the one-time credential requested for existing crew accounts.
export const initialPasswordHash = "scrypt:e4c7a4979dfb736ae31ef493d4ac3a97:73c365d4a7ceb41ee662dd1226b2b3c75263dd793281a322a9b330f9ea329e231f2201a8864a66ffe6446b0db2c4618b8662ca83ef2306b13f8655564e8da2ab";
export async function initializePasswordCredentials(users) {
  return users.updateMany({ passwordHash: { $exists: false } }, { $set: {
    passwordHash: initialPasswordHash, mustChangePassword: true, passwordVersion: 1,
  } });
}
