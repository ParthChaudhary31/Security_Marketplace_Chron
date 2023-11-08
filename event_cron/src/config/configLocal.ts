import dotenv from "dotenv";

dotenv.config();
const config = {
  WEB_SOCKET: (process.env.WEB_SOCKET_PROVIDER)?.toString(),
  MONGO_URL: process.env.MONGO_URL,
  PORT: process.env.PORT,
  VOTE_CONTRACT:process.env.VOTE_CONTRACT,
  ESCROW_CONTRACT:process.env.ESCROW_CONTRACT,
  SECRET_KEY: process.env.SECRET_KEY
};

export default config;
