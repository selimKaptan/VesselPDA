export function safeFixed(val: any, digits: number = 1): string {
  const num = Number(val);
  return isNaN(num) ? "0" : num.toFixed(digits);
}

export function safeLocale(val: any): string {
  const num = Number(val);
  return isNaN(num) ? "0" : num.toLocaleString();
}
