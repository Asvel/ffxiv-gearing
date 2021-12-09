const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const charCodeToValue: bigint[] = [];
for (let i = 0; i < charset.length; i++) {
  charCodeToValue[charset[i].charCodeAt(0)] = BigInt(i);
}

export function encode(n: bigint): string {
  let ret = '';
  do {
    ret = charset[n % 62n as any] + ret;
    n = n / 62n;  // eslint-disable-line no-param-reassign
  } while (n > 0);
  return ret;
}

export function decode(s: string): bigint {
  let ret = 0n;
  for (const char of s) {
    ret = ret * 62n + charCodeToValue[char.charCodeAt(0)];
  }
  return ret;
}
