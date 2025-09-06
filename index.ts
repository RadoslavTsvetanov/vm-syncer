

import { Manager } from "./vm";
import { InternetWatcher } from "./internetWatcher";



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



new Manager().watch()