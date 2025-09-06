import { execSync } from "child_process";

class SnapshotChecker {
  private vmName: string;

  constructor(vmName: string) {
    this.vmName = vmName;
  }

  /** Public method to check if snapshot is safe */
  public execute(): boolean {
    try {
      if (!this.isDiskActivityLow()) return false;
      if (!this.isCpuUsageLow()) return false;
      if (!this.areUpdatesIdle()) return false;
      if (!this.isDiskSpaceSufficient()) return false;

      return true; // All checks passed
    } catch (err) {
      console.error("Error executing snapshot checks:", err);
      return false;
    }
  }

  /** --- Private step checks --- */

  /** Check if VM disk activity is low */
  private isDiskActivityLow(): boolean {
    const blkStat = execSync(`virsh domblkstat ${this.vmName} vda`).toString();
    const wrMatch = blkStat.match(/wr_bytes\s+(\d+)/);
    if (!wrMatch) return false;
    const wrBytes = parseInt(wrMatch[1], 10);
    if (wrBytes > 10_485_760) { // 10 MB
      console.log("High disk activity");
      return false;
    }
    return true;
  }

  /** Check if VM CPU usage is low */
  private isCpuUsageLow(): boolean {
    const pid = execSync(`pgrep -f "qemu-system.*${this.vmName}"`).toString().trim();
    if (!pid) return false;
    const cpu = parseFloat(execSync(`ps -p ${pid} -o %cpu=`).toString());
    if (cpu > 50) {
      console.log("High CPU usage");
      return false;
    }
    return true;
  }

  /** Check if package updates are idle inside the VM (requires SSH) */
  private areUpdatesIdle(): boolean {
    try {
      const updates = execSync(`ssh ${this.vmName} 'pgrep -x apt || pgrep -x dnf'`).toString().trim();
      if (updates) {
        console.log("Update process running inside VM");
        return false;
      }
    } catch {
      // Skip if SSH fails
    }
    return true;
  }

  /** Check if host has enough disk space */
  private isDiskSpaceSufficient(): boolean {
    const avail = parseInt(
      execSync(`df --output=avail ~/.local/share/gnome-boxes/images/ | tail -1`).toString().trim(),
      10
    );
    if (avail < 5_000_000) { // ~5 GB free
      console.log("Not enough disk space for snapshot");
      return false;
    }
    return true;
  }
}

// --- Example usage ---
const checker = new SnapshotChecker("my-vm"); // replace with your VM name
const safeToSnapshot = checker.execute();
console.log(`Safe to snapshot? ${safeToSnapshot}`);