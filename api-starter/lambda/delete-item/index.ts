import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { formatResponse } from 'common';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  const id = event.pathParameters?.id;

  if (!id) {
    return formatResponse(400, { message: 'Missing id' });
  }

  const result = await dynamo.send(new DeleteItemCommand({
    TableName: process.env.TABLE_NAME!,
    Key: { id: { S: id } },
    ReturnValues: 'ALL_OLD',
  }));

  if (!result.Attributes) {
    return formatResponse(404, { message: `Item ${id} not found` });
  }

  return { statusCode: 204, headers: {}, body: '' };
};
