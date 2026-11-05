import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import { formatResponse, validateItem } from 'common';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return formatResponse(400, { message: 'Invalid JSON body' });
  }

  const { valid, errors } = validateItem(body);
  if (!valid) {
    return formatResponse(400, { message: 'Validation failed', errors });
  }

  const { name, description } = body as { name: string; description?: string };
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await dynamo.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME!,
    Item: {
      id: { S: id },
      name: { S: name },
      ...(description ? { description: { S: description } } : {}),
      createdAt: { S: createdAt },
    },
  }));

  return formatResponse(201, { id, name, description, createdAt });
};
