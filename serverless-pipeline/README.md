# serverless-pipeline

An event-driven "upload, process, notify" pipeline on AWS, defined in CDK TypeScript.

```
            ┌────────┐  ObjectCreated  ┌─────────┐   batch   ┌───────────────────┐
 upload ──► │   S3   │ ──────────────► │   SQS   │ ────────► │ job-processor λ   │
            └────────┘                 └─────────┘           └─────────┬─────────┘
                                                                  │          │
                                                       put job    ▼          ▼  publish
                                                          ┌──────────────┐ ┌───────────────┐
                                                          │  DynamoDB    │ │ SNS           │
                                                          │  jobs table  │ │ job-complete  │
                                                          └──────┬───────┘ └───────────────┘
                                                                 │ get
                                  client ──► API Gateway ──► job-status λ
```

## What it does

1. A file uploaded to the S3 bucket emits an `ObjectCreated` event to an SQS queue.
2. The `job-processor` Lambda consumes the queue, writes a job record (`jobId`, `fileKey`, `status`, `createdAt`) to DynamoDB, and publishes a "Job Complete" message to an SNS topic.
3. The job can be looked up over HTTP.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/jobs/{jobId}` | Returns the job record, or 404 if it doesn't exist |
| GET | `/hello` | Health-check style endpoint |

## Failure handling and alerts

- **Retries and DLQ.** A message the processor fails on is retried; after 3 receives it moves to `jobs-dlq` (kept 14 days) with its original payload.
- **Partial batches.** The processor catches errors per record and reports only the failed ones, so one bad message doesn't re-run its neighbours. The SQS message id is used as `jobId`, so a retry overwrites its own record instead of duplicating it.
- **Alarms** (all notify the `pipeline-alerts` SNS topic):

  | Alarm | Fires when |
  |---|---|
  | Processing errors | the processor logged an `ERROR` line (counted by a log metric filter) |
  | Dead-letter queue | a message is waiting in `jobs-dlq` |
  | Processor crash | the invocation itself failed (timeout, out of memory) |
  | API server error | the API returned a 5xx |

  Handled errors never raise the Lambda `Errors` metric, which is why the first alarm counts log lines. To get emails, deploy with `npx cdk deploy -c alertEmail=you@example.com` and confirm the subscription.

### Debugging a failed job

The processor writes one JSON object per line, so Logs Insights can query fields directly. On the `/aws/lambda/job-processor` log group:

```
fields @timestamp, jobId, fileKey, errorName, errorMessage
| filter level = "ERROR"
| sort @timestamp desc
```

Once the cause is fixed, move the dead-lettered messages back to the main queue:

```bash
aws sqs start-message-move-task --source-arn <DeadLetterQueueArn output>
```

Not yet done: attaching a user to each log line. The S3 event doesn't identify who uploaded the file, so that needs an upload key or metadata convention first.

## Notes

- S3 to SQS decouples uploads from processing: bursts queue up instead of overwhelming the processor.
- The SNS topic has no subscribers by default; add an email or SQS subscription to receive notifications.
- AWS SDK v3 is provided by the Node.js 22 Lambda runtime, so it is marked external when bundling.

## Run

```bash
npm ci
npm test
npx cdk deploy

# upload a file, then query the job (jobId is visible in the jobs table)
aws s3 cp ./some-file.json s3://<BucketName output>/some-file.json
curl <ApiUrl output>jobs/<jobId>

npx cdk destroy
```
