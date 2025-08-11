export const dbName = 'bizcivitas';
export const genders = ["male", "female", "other"];
export const roles = ["user", "core-member", "admin"];
export const membershipTypes = ["Core Membership", "Flagship Membership", "Industria Membership", "Digital Membership"];
export const feeTypes = ["annual", "registration", "community_launching", "meeting"];
export const paymentStatus = ["pending", "completed"]; // Added paymentStatus

export const membershipFees = {
  "Core Membership": {
    registration: 25000,
    annual: 300000,
    community_launching: 225000,
  },
  "Flagship Membership": {
    registration: 25000,
    annual: 300000,
    meeting: 25000,
  },
  "Industria Membership": {
    registration: 25000,
    annual: 300000,
    meeting: 25000,
  },
  "Digital Membership": {
    registration: 6999, // Treated as annual fee for 1 year
  },
};