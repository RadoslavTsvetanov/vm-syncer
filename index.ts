

import { CreateSnapshot, Manager } from "./vm";
import { InternetWatcher } from "./internetWatcher";
import { CreateBucketCommand, CreateSessionCommand } from "@aws-sdk/client-s3";



async function Retrier(thingToRetry: () => Promise<void>, stopIf: () => Promise<boolean>) {

    while (true) {
        if (await stopIf()) break;
        thingToRetry();

    }

}
// Example usage:
const watcher = new InternetWatcher();
watcher.watch((online) => {
  console.log(online ? "🌐 Internet connected" : "❌ Internet disconnected");
}); 

console.log("fr")


new CreateSnapshot("archlinux-4").execute()