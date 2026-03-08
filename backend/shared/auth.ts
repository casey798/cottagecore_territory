import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { JwtPayload } from './types';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const USER_POOL_ID = process.env.USER_POOL_ID || '';

let client: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000,
    });
  }
  return client;
}

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
      if (!key) {
        reject(new Error('Signing key not found'));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid token format');
  }

  const signingKey = await getSigningKey(decoded.header);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      signingKey,
      {
        issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
        algorithms: ['RS256'],
      },
      (err, payload) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(payload as unknown as JwtPayload);
      }
    );
  });
}

export function requireAdmin(claims: JwtPayload): void {
  const groups = claims['cognito:groups'] || [];
  if (!groups.some((g) => g.toLowerCase() === 'admin')) {
    throw new Error('Forbidden: admin group required');
  }
}

export function isAdmin(event: APIGatewayProxyEvent): boolean {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return false;
  const groups: string[] = (claims['cognito:groups'] as string || '').split(',').filter(Boolean);
  return groups.some((g) => g.toLowerCase() === 'admin');
}

export function extractUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    throw new Error('No authorization claims found');
  }
  return claims.sub as string;
}

export function extractClaims(event: APIGatewayProxyEvent): JwtPayload {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    throw new Error('No authorization claims found');
  }
  return claims as unknown as JwtPayload;
}
