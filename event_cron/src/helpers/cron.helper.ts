import cron from "node-cron";
import Pools from "../modules/forceVote.module";

class CronHandler {
  public async cronScheduler() {
    cron.schedule("* */5 * * * *", async () => {
      try {
        console.log(
          "====================================================================================================="
        );
        await Pools.checkPosts(); // Call checkNewPools on the myPools instance
      } catch (error) {
        console.log(error);
      }
    });
  }
}

export default new CronHandler();
