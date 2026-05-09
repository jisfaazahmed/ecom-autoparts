// Sri Lankan Rupee formatting
export const formatLKR = (amount: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatLKRCompact = (amount: number): string => {
  if (amount >= 1000000) {
    return `LKR ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `LKR ${(amount / 1000).toFixed(1)}K`;
  }
  return formatLKR(amount);
};
