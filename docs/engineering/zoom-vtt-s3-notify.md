# Zoom VTT → Hub warehouse (S3 notify)

**Ticket:** CPR-29 (platform notify + Hub Lambda)  
**Parent:** CPR-9  

S3 `ObjectCreated` on `zoom-recordings/*.vtt` invokes Content Hub `vtt_object_ingest` (no SQS on the hot path). Async failures go to Hub’s DLQ.

## Dev (wired)

| Item | Value |
|------|--------|
| Bucket | `cht-dev-session-assets` |
| Filter | prefix `zoom-recordings/`, suffix `.vtt` |
| Lambda | `arn:aws:lambda:us-east-1:233636046512:function:contenthub-dev-sync-vtt-object-ingest` |
| TF var | `vtt_object_ingest_lambda_arn` in `dev.github.tfvars` |

Platform TF (`s3-session-assets` module):

- `aws_lambda_permission` — `s3.amazonaws.com` → that function  
- `aws_s3_bucket_notification` — ObjectCreated:* with the filters above  

Hub owns: Lambda code, role `s3:GetObject` on `…/zoom-recordings/*`, async DLQ, `PLATFORM_EXPORT_TRANSCRIPT_BUCKET`.

## Platform / prod

Leave `vtt_object_ingest_lambda_arn` empty until Hub publishes `contenthub-*-sync-vtt-object-ingest` for that env, then set the ARN in `platform.github.tfvars` (or equivalent) and apply.

## Smoke (after apply)

1. Linked Program with Hub `export_sessions` row + `campaignId` set.  
2. Put a tiny `.vtt` at  
   `s3://cht-dev-session-assets/zoom-recordings/{programId}/{meetingId}/{fileId}.vtt`  
3. Expect one Lambda invoke; Hub row gets cue-stripped `transcript_text`.  
4. Same body again → hash skip.  
5. `.mp4` under same prefix → **no** invoke.  
6. `unlinked/…` or no session row → Lambda success, no insert.

Does **not** replace CPR-13 daily `platform_export_ingest` (backfill / late `campaignId`).
