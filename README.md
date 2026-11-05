# aws-cdk-projects

Backend projects on AWS, defined entirely as infrastructure-as-code with **AWS CDK (TypeScript)**. Each folder is an independent CDK app with its own dependencies, tests and deploy.

## Projects

| Project | What it is | AWS services |
|---|---|---|
| [`serverless-pipeline/`](serverless-pipeline) | Event-driven pipeline: a file upload triggers async processing, persists a job record, and notifies subscribers. Includes a job-status API. | S3, SQS, Lambda, DynamoDB, SNS, API Gateway |
| [`api-starter/`](api-starter) | Reusable REST API starter: full CRUD, a shared Lambda Layer, and JWT-secured routes through a Lambda authorizer. | API Gateway, Lambda, Lambda Layers, DynamoDB, Secrets Manager |

## Conventions

- One CDK stack per project, bundled with esbuild (`NodejsFunction`), Node.js 22 runtime.
- Infrastructure is covered by CDK `Template` assertion tests (`npm test` in each project).
- Resources use `RemovalPolicy.DESTROY` so everything can be torn down with `npx cdk destroy`. These are demo projects, not production defaults.

## Running a project

```bash
cd <project>
npm ci
npm test
npx cdk synth      # no AWS calls
npx cdk deploy     # needs AWS credentials and a bootstrapped account/region
npx cdk destroy
```

## Planned

- Observability for the pipeline: DLQ, structured logs with user context, CloudWatch alarms
- CI with GitHub Actions (tests and `cdk diff` on pull requests)
- A migration demo: bringing manually created resources under CDK

## Background

The two projects were first prototyped in a personal learning repo and moved here as clean snapshots, so this repo's history starts at the move.
