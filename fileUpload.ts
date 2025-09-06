import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, existsSync } from "fs";
import { createHash } from "crypto";
import { exec } from 'child_process';
import { s3Creds } from './s3Creds';



// interface FileUploadStrategy {
//     uploadFile()
// }

export class FileUpload {
    // Hardcoded Backblaze B2 credentials

    private s3: S3Client;

    constructor(private filePath: string) {
        if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

        this.s3 = new S3Client({
            region: s3Creds.region,
            endpoint: `https://s3.${s3Creds.region}.backblazeb2.com`,
            credentials: {
                accessKeyId: s3Creds.accessKeyId,
                secretAccessKey: s3Creds.secretAccessKey,
            },
        });
    }

    private deleteFileFromLocal() {
        exec(`rm "${this.filePath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error deleting file: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`✅ File ${this.filePath} deleted successfully`);
        });
    }

    private async getLocalMd5(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const hash = createHash("md5");
            const stream = createReadStream(this.filePath);
            stream.on("data", (chunk) => hash.update(chunk));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", reject);
        });
    }

    private async getRemoteEtag(): Promise<string> {
        const head = await this.s3.send(
            new HeadObjectCommand({ Bucket: s3Creds.bucket, Key: this.filePath })
        );
        return head.ETag?.replace(/"/g, "") || "";
    }

    private async hasFileBeenUploadedCorrectly(): Promise<boolean> {
        const localMd5 = await this.getLocalMd5();
        const remoteEtag = await this.getRemoteEtag();
        return localMd5 === remoteEtag;
    }

    private async uploadToRemote() {
        await this.s3.send(
            new PutObjectCommand({
                Bucket: s3Creds.bucket,
                Key: this.filePath,
                Body: createReadStream(this.filePath),
            })
        );
        console.log(`⬆️ Uploaded ${this.filePath} to ${s3Creds.bucket}`);
    }

    public async execute(): Promise<void> {
        await this.uploadToRemote();

        let retries = 0;
        while (true) {
            if (await this.hasFileBeenUploadedCorrectly()) {
                console.log(`✅ Upload verified for ${this.filePath}`);
                this.deleteFileFromLocal();
                break;
            } else {
                if (retries++ >= 3) {
                    console.error(`❌ File upload failed after multiple attempts: ${this.filePath}`);
                    break;
                }
                console.log(`⚠️ File not uploaded correctly, retrying... (${retries})`);
                await this.uploadToRemote();
            }
        }
    }
}

