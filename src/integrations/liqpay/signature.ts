import { createHash, timingSafeEqual } from 'crypto'

export const encodeLiqPayData = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64')

export const decodeLiqPayData = <T>(data: string): T =>
  JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as T

export const createLiqPaySignature = (
  data: string,
  privateKey: string,
  algorithm: 'sha1' | 'sha3-256',
): string =>
  createHash(algorithm)
    .update(`${privateKey}${data}${privateKey}`)
    .digest('base64')

export const verifyLiqPaySignature = (
  data: string,
  signature: string,
  privateKey: string,
  algorithm: 'sha1' | 'sha3-256',
): boolean => {
  const expected = Buffer.from(createLiqPaySignature(data, privateKey, algorithm))
  const received = Buffer.from(signature)

  return expected.length === received.length && timingSafeEqual(expected, received)
}
