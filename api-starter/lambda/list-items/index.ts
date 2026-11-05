import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { formatResponse } from 'common';

const dynamo = new DynamoDBClient({});

export const handler = async () => {
  const result = await dynamo.send(new ScanCommand({
    TableName: process.env.TABLE_NAME!,
  }));

  const items = (result.Items ?? []).map((item) => ({
    id: item.id.S,
    name: item.name.S,
    description: item.description?.S,
    createdAt: item.createdAt.S,
  }));

  return formatResponse(200, { items });
};
