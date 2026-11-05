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
