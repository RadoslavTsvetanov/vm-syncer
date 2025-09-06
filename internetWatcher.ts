
export class InternetWatcher {
  private checkUrl = "https://www.google.com";
  private intervalMs = 5000; // check every 5s
  private timer?: NodeJS.Timeout;

  constructor(checkUrl?: string, intervalMs?: number) {
    if (checkUrl) this.checkUrl = checkUrl;
    if (intervalMs) this.intervalMs = intervalMs;
  }

  async isConnectedToInternet(): Promise<boolean> {
    try {
      const response = await fetch(this.checkUrl, { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  watch(onStatusChange: (online: boolean) => void) {
    let lastStatus: boolean | null = null;

    this.timer = setInterval(async () => {
      const connected = await this.isConnectedToInternet();
      if (lastStatus === null || connected !== lastStatus) {
        lastStatus = connected;
        onStatusChange(connected);
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
