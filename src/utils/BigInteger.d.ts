declare class BigIntegerInternal { }

export type BigInteger = BigIntegerInternal | number;

export function parseInt(string: string, radix?: number): BigInteger;
export function toString(n: BigInteger, radix?: number): string;
export function compareTo(a: BigInteger, b: BigInteger): number;
export function negate(a: BigInteger): BigInteger;
export function add(a: BigInteger, b: BigInteger): BigInteger;
export function subtract(a: BigInteger, b: BigInteger): BigInteger;
export function multiply(a: BigInteger, b: BigInteger): BigInteger;
export function divide(a: BigInteger, b: BigInteger): BigInteger;
export function remainder(a: BigInteger, b: BigInteger): BigInteger;
