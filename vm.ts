import { exec } from 'child_process';
import { FileUpload } from './fileUpload';

export class VM {
    constructor(private name: string) {
        console.log(`VM ${name} created`);
    }

    createSnapshot() {
        console.log(`Creating snapshot for VM ${this.name}`);
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

        new FileUpload(`/home/user/.local/share/libvirt/qemu/${this.name}.qcow2`).execute().then(() => {
            console.log(`Snapshot for VM ${this.name} uploaded successfully`);
        }).catch(err => {
            console.error(`Error uploading snapshot for VM ${this.name}: ${err}`);
        });

    }
}

export class Manager {
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