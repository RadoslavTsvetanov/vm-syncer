import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import * as libvirt from "@pulumi/libvirt";


import { createReadStream } from "fs";
import { createHash } from "crypto";


import { exec } from "child_process";


interface AsyncExecutable {
    execute(): Promise<void>
}

class FileUpload implements AsyncExecutable {
    private bucket = "my-bucket";
    private s3 = new S3Client({ region: "us-east-1" });
    constructor(private filePath: string) {

    }


    deleteFileFromLocal() {
        exec(`rm ${this.filePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error deleting file: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`File ${this.filePath} deleted successfully`);
        });
    }



    async hasFileHasBeenUploadedCorrectly() {
        const localMd5 = await new Promise<string>((resolve, reject) => {
            const hash = createHash("md5");
            const stream = createReadStream(this.filePath);
            stream.on("data", chunk => hash.update(chunk));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", reject);
        });

        const s3Etag = (await this.getMetadataFromRemote()).ETag?.replace(/"/g, "") || "";

        return localMd5 === s3Etag;

    }

    async getMetadataFromRemote(
    ) {

        return await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.filePath }));

    }

    async uploadToRemote() {
        await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.filePath, Body: createReadStream(this.filePath) }));
    }



    async execute(): Promise<void> {
        await this.uploadToRemote();
        let retires = 0
        while (true) {

            if (await this.hasFileHasBeenUploadedCorrectly()) {
                this.deleteFileFromLocal();
                break
            } else {
                if(retires++ > 3) {
                    console.error("File upload failed after multiple attempts" + this.filePath);
                    break;
                }
                console.log("File not uploaded correctly, retrying...");
                await this.uploadToRemote();
            }
        }
    }

}

class StorageUploader {
}

class VM {
    constructor(private name: string) {
        console.log(`VM ${name} created`);
    }

    createSnapshot() {
        exec(`
           virsh -c qemu:///session snapshot-create-as ${this.name} "$(date +%Y-%m-%d_%H-%M-%S)" \
  --description "Snapshot taken on $(date)"
            `,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                    return;
                }

            });

            // new FileUpload(`/home/user/.local/share/libvirt/qemu/${this.name}.qcow2`).execute().then(() => {
            //     console.log(`Snapshot for VM ${this.name} uploaded successfully`);
            // }).catch(err => {
            //     console.error(`Error uploading snapshot for VM ${this.name}: ${err}`);
            // });

    }
}

class Manager {
private vms: VM[] = []
    constructor() {

        this.vms.push(new VM("archlinux-4"));

    }


    watch() {
        setInterval(() => {
            this.vms.forEach(vm => {
                vm.createSnapshot()
            });
        }, 3600000); 
    }
}



new Manager().watch()