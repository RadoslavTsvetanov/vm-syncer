import { exec } from 'child_process';
import { FileUpload } from './fileUpload';
import { promisify } from "util";

const execAsync = promisify(exec);

const currentUser = "boro_vtori"

export class CanSnapshot {
  constructor(private vmName: string) {}

  // Get VM state
  private async getState(): Promise<string> {
    const { stdout, stderr } = await execAsync(`virsh domstate ${this.vmName}`);
    if (stderr) console.error(stderr);
    return stdout.trim(); // remove trailing newline
  }

  // Get resource usage for the VM (CPU % and RAM %)
  private async getResourcesUsage(): Promise<{ cpu: number; ram: number }> {
    // Using 'virsh dominfo' to get memory and CPU info
    const { stdout } = await execAsync(`virsh dominfo ${this.vmName}`);
    const lines = stdout.split("\n");

    let maxMem = 0;
    let usedMem = 0;
    let cpuTime = 0;

    lines.forEach((line) => {
      const [key, value] = line.split(":").map((x) => x.trim());
      if (key === "Max memory") maxMem = parseInt(value); // in KiB
      if (key === "Used memory") usedMem = parseInt(value); // in KiB
      if (key === "CPU time") cpuTime = parseInt(value); // in ns
    });

    // Simple heuristic: CPU load and RAM usage as percentage
    const ramUsage = (usedMem / maxMem) * 100;
    // For CPU, let's assume less than 20% of CPU time in the last period is good
    const cpuUsage = cpuTime / 1e9; // convert ns to seconds (rough estimate)

    return { cpu: cpuUsage, ram: ramUsage };
  }

  // Check if VM can be snapshotted
  async execute(): Promise<boolean> {
    const state = await this.getState();

    if (state === "shut off") {
      return true; // snapshotting offline VM is always safe
    }

    if (state === "running") {
      const usage = await this.getResourcesUsage();

      // Criteria for snapshotting while running:
      // - CPU usage low
      // - RAM usage below 80%
      if (usage.cpu < 20 && usage.ram < 80) {
        return true;
      }
      return false;
    }

    return false; // paused, crashed, or other states are unsafe
  }
}

export class CreateSnapshot {
    private snapshotName: string
    private snapshotsFolderPath: string = "~/snaps"
    private canSnaphst: CanSnapshot
    constructor(private vmName: string) {
       this.snapshotName = this.generateName() 
       this.canSnaphst = new CanSnapshot(this.vmName)
       
    }

    

    private getCurentDate(){

        return  (new Date()).toISOString().replace(/[:.]/g, "-")
 }
 
 private generateName(){
        return `${this.vmName}-${this.getCurentDate()}`
 }

 async extractSnapshot(){ 
   await execAsync(`qemu-img convert -O qcow2 -s ${this.snapshotName} \
  /home/${currentUser}/.local/share/gnome-boxes/images/${this.vmName}.qcow2 \
  ${this.snapshotsFolderPath}/${this.snapshotName}.qcow2`)
 
 }

 async execute(){
        console.log(`Creating snapshot for VM ${this.vmName}`);
        // if(!await this.canSnaphst.execute()){
        //     throw new Error("cant snahot")
        // }



        try {
            const { stdout, stderr } = await execAsync(`
    virsh -c qemu:///session snapshot-create-as ${this.vmName} "${this.snapshotName}"      
        `);

            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }

            console.log(stdout);
        } catch (error: any) {
            console.error(`\u274c Error creating snapshot: ${error.message}`);
        }

        await this.extractSnapshot()
        new FileUpload(`${this.snapshotsFolderPath}/${this.snapshotName}.qcow2`).execute().then(() => {
            console.log(`Snapshot for VM ${this.vmName} uploaded successfully`);
        }).catch(err => {
            console.error(`Error uploading snapshot for VM ${this.vmName}: ${err}`);
        });
 }
}

export class VM {
    constructor(private name: string) {
        console.log(`VM ${name} created`);
    }



    async createSnapshot() {
        return await new CreateSnapshot(this.name).execute
    } 
}

export class Manager {
    private vms: VM[] = []
    constructor() {

        this.vms.push(new VM("archlinux-4"));

    }


    watch() {
        this.vms.forEach(vm => {
            vm.createSnapshot()
        });
        setInterval(() => {
            this.vms.forEach(vm => {
                vm.createSnapshot()
            });
        }, 3600000);
    }
}