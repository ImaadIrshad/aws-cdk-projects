import { formatResponse, generateJwt } from 'common';

const TOKEN_TTL_SECONDS = 3600;

// Demo-only stand-in for a real identity provider: issues a token for any
// username with no password check. Wire this up to real credential
// verification before using this pattern beyond a starter/demo.
export const handler = async (event: any) => {
  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return formatResponse(400, { message: 'Invalid JSON body' });
  }

  const { username } = body as { username?: unknown };
  if (typeof username !== 'string' || username.trim().length === 0) {
    return formatResponse(400, { message: '"username" is required and must be a non-empty string' });
  }

  const token = generateJwt({ sub: username }, process.env.JWT_SECRET!, TOKEN_TTL_SECONDS);

  return formatResponse(200, { token, expiresIn: TOKEN_TTL_SECONDS });
};
