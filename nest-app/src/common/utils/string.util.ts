/**
 * Generate a unique id for use with map as keys or any other purpose.
 * @param {number} length The length of the unique id
 * @param {boolean} numbers If true, the id will only contain numbers
 * @example uniqueId(10, true) // 1234567890
 * @example uniqueId(10, false) // 1234567890abcdefg
 * @example uniqueId(10) // 1234567890abcdefg
 * @example uniqueId() // 1234567890abcdefg
 * @returns string
 */
export function uniqueId(length = 20, numbers = false): string {
  let result = '';
  const characters = !numbers
    ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    : '0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
