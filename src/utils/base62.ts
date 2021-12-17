const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const charCodeToValue: bigint[] = [];
for (let i = 0; i < charset.length; i++) {
  charCodeToValue[charset[i].charCodeAt(0)] = BigInt(i);
}

export function encode(n: bigint): string {
  let ret = '';
  do {
    ret = charset[n % BigInt(62) as any] + ret;
    n = n / BigInt(62);  // eslint-disable-line no-param-reassign
  } while (n > 0);
  return ret;
}

export function decode(s: string): bigint {
  let ret = BigInt(0);
  for (const char of s) {
    ret = ret * BigInt(62) + charCodeToValue[char.charCodeAt(0)];
  }
  return ret;
}
