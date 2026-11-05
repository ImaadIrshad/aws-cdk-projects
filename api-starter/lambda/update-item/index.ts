import { DynamoDBClient, UpdateItemCommand, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { formatResponse, validatePartialItem } from 'common';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  const id = event.pathParameters?.id;

  if (!id) {
    return formatResponse(400, { message: 'Missing id' });
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return formatResponse(400, { message: 'Invalid JSON body' });
  }

  const { valid, errors } = validatePartialItem(body);
  if (!valid) {
    return formatResponse(400, { message: 'Validation failed', errors });
  }

  const { name, description } = body as { name?: string; description?: string };
  const updateNames: Record<string, string> = {};
  const updateValues: Record<string, { S: string }> = {};
  const setClauses: string[] = [];

  if (name !== undefined) {
    setClauses.push('#name = :name');
    updateNames['#name'] = 'name';
    updateValues[':name'] = { S: name };
  }

  if (description !== undefined) {
    setClauses.push('#description = :description');
    updateNames['#description'] = 'description';
    updateValues[':description'] = { S: description };
  }

  try {
    const result = await dynamo.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME!,
      Key: { id: { S: id } },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: updateNames,
      ExpressionAttributeValues: updateValues,
      ReturnValues: 'ALL_NEW',
    }));

    return formatResponse(200, {
      id: result.Attributes!.id.S,
      name: result.Attributes!.name.S,
      description: result.Attributes!.description?.S,
      createdAt: result.Attributes!.createdAt.S,
    });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return formatResponse(404, { message: `Item ${id} not found` });
    }
    throw err;
  }
};
