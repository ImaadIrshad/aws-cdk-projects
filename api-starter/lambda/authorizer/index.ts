import { verifyJwt } from 'common';

export const handler = async (event: any) => {
  const authHeader: string = event.authorizationToken || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  const result = verifyJwt(token, process.env.JWT_SECRET!);

  if (!result.valid) {
    // Must throw exactly 'Unauthorized' for API Gateway's TOKEN authorizer
    // to return 401; any other error becomes a 500.
    throw new Error('Unauthorized');
  }

  const sub = typeof result.payload?.sub === 'string' ? result.payload.sub : 'user';

  return {
    principalId: sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource: event.methodArn,
      }],
    },
    context: { sub },
  };
};
