import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const dynamo = new DynamoDBClient({});
const sns = new SNSClient({});

export const handler = async (event: any) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const s3Event = body.Records?.[0];

    const jobId = randomUUID();
    const key = s3Event?.s3?.object?.key || 'unknown';

    // Save to DynamoDB
    await dynamo.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME!,
      Item: {
        jobId: { S: jobId },
        fileKey: { S: key },
        status: { S: 'processed' },
        createdAt: { S: new Date().toISOString() },
      },
    }));

    // Notify via SNS
    await sns.send(new PublishCommand({
      TopicArn: process.env.TOPIC_ARN!,
      Message: `Job ${jobId} processed file: ${key}`,
      Subject: 'Job Complete',
    }));

    console.log(`Processed job ${jobId} for file ${key}`);
  }
};