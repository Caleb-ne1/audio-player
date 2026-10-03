import "dotenv/config";
import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,

  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },

  forcePathStyle: true,
});

const result = await s3.send(new ListBucketsCommand());

console.log("RustFS connection successful!");
console.log("Buckets:");

for (const bucket of result.Buckets ?? []) {
  console.log(`- ${bucket.Name}`);
}