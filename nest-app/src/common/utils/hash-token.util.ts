// auth/utils/hash-token.util.ts
import * as bcrypt from 'bcrypt';

export const hashToken = async (token: string): Promise<string> => {
  const salt = await bcrypt.genSalt();

  return await bcrypt.hash(token, salt);
};

export const compareTokens = async (
  token: string,
  hashed: string,
): Promise<boolean> => {
  return await bcrypt.compare(token, hashed);
};
