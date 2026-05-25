export function formatCurrency(amount: number, currency: string = "RWF") {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatAreaSqm(areaSqm: number) {
  return `${new Intl.NumberFormat("en-RW", {
    maximumFractionDigits: 2,
  }).format(areaSqm)} m²`;
}
