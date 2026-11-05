import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { formatResponse } from 'common';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  const id = event.pathParameters?.id;

  if (!id) {
    return formatResponse(400, { message: 'Missing id' });
  }

  const result = await dynamo.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME!,
    Key: { id: { S: id } },
  }));

  if (!result.Item) {
    return formatResponse(404, { message: `Item ${id} not found` });
  }

  return formatResponse(200, {
    id: result.Item.id.S,
    name: result.Item.name.S,
    description: result.Item.description?.S,
    createdAt: result.Item.createdAt.S,
  });
};
