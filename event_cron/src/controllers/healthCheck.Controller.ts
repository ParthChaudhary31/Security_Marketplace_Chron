import { Request, Response } from "express";
import { RESPONSES, RES_MSG } from "../constant/response";
import { MessageUtil } from "../utils/message";

class healthCheckController {
  healthCheck = async (req: Request, res: Response) => {
    return MessageUtil.success(res, {
      message: RES_MSG.SUCCESS,
      status: RESPONSES.SUCCESS,
      error: false,
    });
  };
}

export default new healthCheckController();
