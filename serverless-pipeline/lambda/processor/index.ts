import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const dynamo = new DynamoDBClient({});
const sns = new SNSClient({});

interface SqsRecord {
  messageId: string;
  body: string;
}

// One JSON object per line so CloudWatch Logs Insights can query fields directly.
function log(level: 'INFO' | 'ERROR', message: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ level, message, ...fields })}\n`);
}

export const handler = async (event: { Records: SqsRecord[] }) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    // The SQS message id is stable across retries, so a retried message
    // overwrites its own job record instead of creating a duplicate.
    const jobId = record.messageId;
    let fileKey = 'unknown';

    try {
      const body = JSON.parse(record.body);
      fileKey = body.Records?.[0]?.s3?.object?.key || 'unknown';

      await dynamo.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME!,
        Item: {
          jobId: { S: jobId },
          fileKey: { S: fileKey },
          status: { S: 'processed' },
          createdAt: { S: new Date().toISOString() },
        },
      }));

      await sns.send(new PublishCommand({
        TopicArn: process.env.TOPIC_ARN!,
        Message: `Job ${jobId} processed file: ${fileKey}`,
        Subject: 'Job Complete',
      }));

      log('INFO', 'Job processed', { jobId, fileKey });
    } catch (err) {
      const error = err as Error;
      log('ERROR', 'Job processing failed', {
        jobId,
        fileKey,
        errorName: error.name,
        errorMessage: error.message,
      });
      // Only this message is retried (and eventually dead-lettered), not the whole batch.
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
