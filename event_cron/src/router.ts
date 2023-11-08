import express, { Application } from "express";
import healthCheckController from "../src/controllers/healthCheck.Controller";

export default function router(server: Application): void {
  server.use(
    "/api/v1/",
    express.Router().get("/healthCheck", healthCheckController.healthCheck)
  );
}

