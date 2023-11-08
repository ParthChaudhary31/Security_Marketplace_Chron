import express, { Application } from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import compression from "compression";
import cors from "cors";
import dbConnect from "./helpers/db.helper";
import CronHandler from "./helpers/cron.helper";

dotenv.config();

class ExpressServer {
  private app: Application;
  constructor() {
    this.app = express();
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    dbConnect.dbConnection();
    this.initialiseServices();
  }


  private async initialiseServices() {
    await CronHandler.cronScheduler();
  }

  public listen(port: number) {
    this.app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
}

export default new ExpressServer();
