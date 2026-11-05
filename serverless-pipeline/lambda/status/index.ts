import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  const jobId = event.pathParameters?.jobId;

  if (!jobId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Missing jobId' }),
    };
  }

  const result = await dynamo.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME!,
    Key: { jobId: { S: jobId } },
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Job ${jobId} not found` }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: result.Item.jobId.S,
      fileKey: result.Item.fileKey.S,
      status: result.Item.status.S,
      createdAt: result.Item.createdAt.S,
    }),
  };
};
