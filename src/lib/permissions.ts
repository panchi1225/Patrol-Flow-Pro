export type AppRole = 'admin' | 'safety' | 'field' | 'viewer';

export const isAdmin = (role?: AppRole | null) => role === 'admin';

export const canUseSafetyFeatures = (role?: AppRole | null) =>
  role === 'admin' || role === 'safety';

// safety は field の上位互換として扱う
export const canUseFieldFeatures = (role?: AppRole | null) =>
  role === 'admin' || role === 'safety' || role === 'field';

export const canManageUsers = (role?: AppRole | null) => isAdmin(role);
