# api-starter

A reusable REST API starter on AWS: full CRUD over DynamoDB, a shared Lambda Layer, and JWT-secured routes through a Lambda authorizer. Defined in CDK TypeScript.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/token` | none | Issues a JWT for a given `username` (demo only, see below) |
| GET | `/items` | JWT | List items |
| POST | `/items` | JWT | Create an item (`name` required, `description` optional) |
| GET | `/items/{id}` | JWT | Get one item (404 if missing) |
| PATCH | `/items/{id}` | JWT | Partial update of `name` / `description` (404 if missing) |
| DELETE | `/items/{id}` | JWT | Delete an item, returns 204 (404 if missing) |

```bash
API=<ApiUrl output>
TOKEN=$(curl -s -X POST ${API}auth/token -d '{"username":"alice"}' | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" ${API}items
```

Missing or invalid tokens get a 401.

## Design decisions

- **Shared Lambda Layer** holds response formatting, input validation and JWT sign/verify helpers. It is plain JavaScript on purpose: layer assets are not run through `NodejsFunction`'s esbuild step, so TypeScript would need custom bundling. Handlers import it as `common`, with an ambient type declaration in `types/`.
- **Layer must be listed as external.** Setting `bundling.externalModules` replaces the default list instead of extending it, so it needs both `@aws-sdk/*` and `common`.
- **Lambda authorizer over Cognito.** Keeps the starter self-contained and easy to read. The JWT (HS256) is verified with Node's built-in `crypto`, so the layer has no dependencies, and the signing secret lives in Secrets Manager.
- **Per-function IAM.** Read handlers get read access to the table, write handlers get write access.

## Limitations

- `POST /auth/token` issues a token for any username with no credential check. It stands in for a real identity provider, which is where Cognito or actual credential verification would go.
- The signing secret is injected as a Lambda environment variable (a CloudFormation dynamic reference). Fetching it at runtime would allow rotation without redeploying.
- `GET /items` uses a table scan and is not paginated.

## Run

```bash
npm ci
npm test
npx cdk deploy
npx cdk destroy
```
