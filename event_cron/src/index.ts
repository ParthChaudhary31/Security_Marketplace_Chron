import App from "./server";
import config from "./config/configLocal";
const port:number = parseInt(config.PORT ?? "9001")

App.listen(port);